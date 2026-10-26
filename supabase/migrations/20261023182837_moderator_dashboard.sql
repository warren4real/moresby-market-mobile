-- Membership is server-managed; profile names and user_metadata never grant access.
create table private.moderator_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now(),granted_reason text not null
);
alter table private.moderator_accounts enable row level security;
revoke all on private.moderator_accounts from public,anon,authenticated;
create policy moderators_service_only on private.moderator_accounts to service_role using(true) with check(true);
create function private.is_market_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select private.active_account() and exists(select 1 from private.moderator_accounts where user_id=auth.uid());
$$;
revoke all on function private.is_market_moderator() from public,anon;
grant execute on function private.is_market_moderator() to authenticated;
create function public.is_market_moderator() returns boolean language sql stable security invoker set search_path='' as $$select private.is_market_moderator();$$;
revoke all on function public.is_market_moderator() from public,anon;
grant execute on function public.is_market_moderator() to authenticated;
create function private.require_market_moderator() returns void language plpgsql security definer set search_path='' as $$
begin if not private.is_market_moderator() then raise insufficient_privilege using message='Moderator access required';end if;end;$$;
revoke all on function private.require_market_moderator() from public,anon,authenticated;

create table private.moderation_audit (
 id uuid primary key default gen_random_uuid(),
 moderator_id uuid references auth.users(id) on delete set null,
 report_kind text not null check(report_kind in ('listing','conversation')),
 report_id uuid not null,
 action text not null check(action in ('opened_report','opened_conversation','reviewed','dismissed','removed_listing')),
 note text not null check(char_length(note) between 1 and 1000),
 created_at timestamptz not null default clock_timestamp()
);
create index moderation_audit_report on private.moderation_audit(report_kind,report_id,created_at desc);
create index moderation_audit_actor on private.moderation_audit(moderator_id);
alter table private.moderation_audit enable row level security;
revoke all on private.moderation_audit from public,anon,authenticated;
create policy moderation_audit_service on private.moderation_audit to service_role using(true) with check(true);

-- Explicit column grants already prevent mobile clients from setting this flag.
alter table public.listings add column moderation_removed boolean not null default false;
alter policy listing_edit on public.listings
using(owner_id=auth.uid() and private.active_account() and not moderation_removed)
with check(owner_id=auth.uid() and private.active_account() and not moderation_removed
 and exists(select 1 from public.listing_assets a where a.path=image_path and a.owner_id=auth.uid()));

create function private.moderation_queue(p_kind text,p_status text,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_market_moderator();
 if p_kind not in ('listing','conversation') or p_kind is null or p_status not in ('pending','reviewed','dismissed') or p_status is null or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid queue filter';end if;
 if p_kind='listing' then
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into result from (
 select r.id,r.reason,r.details,r.status,r.created_at,l.title as target_label,p.display_name as reporter_name
 from public.listing_reports r join public.listings l on l.id=r.listing_id left join public.profiles p on p.id=r.reporter_id
 where r.status=p_status order by r.created_at,r.id limit 20 offset p_offset) q;
 else
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into result from (
 select r.id,r.reason,r.details,r.status,r.created_at,l.title as target_label,p.display_name as reporter_name
 from public.conversation_reports r join public.chat_conversations c on c.id=r.conversation_id join public.listings l on l.id=c.listing_id left join public.profiles p on p.id=r.reporter_id
 where r.status=p_status order by r.created_at,r.id limit 20 offset p_offset) q;
 end if;
 insert into private.moderation_audit(moderator_id,report_kind,report_id,action,note)
 select auth.uid(),p_kind,(entry->>'id')::uuid,'opened_report','Viewed report queue summary' from jsonb_array_elements(result) entry;
 return result;
end;$$;
revoke all on function private.moderation_queue(text,text,integer) from public,anon;
grant execute on function private.moderation_queue(text,text,integer) to authenticated;
create function public.moderation_queue(p_kind text,p_status text default 'pending',p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.moderation_queue(p_kind,p_status,p_offset);$$;
revoke all on function public.moderation_queue(text,text,integer) from public,anon;
grant execute on function public.moderation_queue(text,text,integer) to authenticated;

create function private.moderation_report(p_kind text,p_report uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare report jsonb;item uuid;result jsonb;
begin
 perform private.require_market_moderator();
 if p_kind='listing' then
 select to_jsonb(r),r.listing_id into report,item from public.listing_reports r where id=p_report;
 elsif p_kind='conversation' then
 select to_jsonb(r),c.listing_id into report,item from public.conversation_reports r join public.chat_conversations c on c.id=r.conversation_id where r.id=p_report;
 else raise exception 'Invalid report kind';end if;
 if report is null then raise exception 'Report no longer exists';end if;
 insert into private.moderation_audit(moderator_id,report_kind,report_id,action,note) values(auth.uid(),p_kind,p_report,'opened_report','Opened report details');
 select jsonb_build_object('report',report,'listing',jsonb_build_object('id',l.id,'title',l.title,'description',l.description,'price',l.price,'status',l.status,'image_path',l.image_path,'moderation_removed',l.moderation_removed,'seller_name',p.display_name),
 'history',(select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) from (select a.action,a.note,a.created_at,actor.display_name as moderator_name from private.moderation_audit a left join public.profiles actor on actor.id=a.moderator_id where a.report_kind=p_kind and a.report_id=p_report order by a.created_at desc,a.id desc limit 20) h))
 into result from public.listings l left join public.profiles p on p.id=l.owner_id where l.id=item;
 return result;
end;$$;
revoke all on function private.moderation_report(text,uuid) from public,anon;
grant execute on function private.moderation_report(text,uuid) to authenticated;
create function public.moderation_report(p_kind text,p_report uuid) returns jsonb language sql security invoker set search_path='' as $$select private.moderation_report(p_kind,p_report);$$;
revoke all on function public.moderation_report(text,uuid) from public,anon;
grant execute on function public.moderation_report(text,uuid) to authenticated;

create function private.moderation_conversation(p_report uuid,p_reason text,p_before integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;result jsonb;
begin
 perform private.require_market_moderator();
 if p_reason is null or char_length(trim(p_reason)) not between 1 and 300 or (p_before is not null and p_before<1) then raise exception 'Enter a review reason';end if;
 select conversation_id into target from public.conversation_reports where id=p_report;
 if target is null then raise exception 'Report no longer exists';end if;
 insert into private.moderation_audit(moderator_id,report_kind,report_id,action,note) values(auth.uid(),'conversation',p_report,'opened_conversation',trim(p_reason));
 insert into private.chat_review_audit(report_id,operator_label,review_reason) values(p_report,auth.uid()::text,trim(p_reason));
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sequence),'[]'::jsonb) into result from (
 select m.id,m.sequence,m.sender_id,p.display_name as sender_name,m.body,m.created_at from public.chat_messages m left join public.profiles p on p.id=m.sender_id
 where m.conversation_id=target and (p_before is null or m.sequence<p_before) order by m.sequence desc limit 50) q;
 return result;
end;$$;
revoke all on function private.moderation_conversation(uuid,text,integer) from public,anon;
grant execute on function private.moderation_conversation(uuid,text,integer) to authenticated;
create function public.moderation_conversation(p_report uuid,p_reason text,p_before integer default null) returns jsonb language sql security invoker set search_path='' as $$select private.moderation_conversation(p_report,p_reason,p_before);$$;
revoke all on function public.moderation_conversation(uuid,text,integer) from public,anon;
grant execute on function public.moderation_conversation(uuid,text,integer) to authenticated;

create function private.moderation_decide(p_kind text,p_report uuid,p_action text,p_note text,p_expected text) returns jsonb language plpgsql security definer set search_path='' as $$
declare item uuid;current_status text;next_status text;
begin
 perform private.require_market_moderator();
 if p_note is null or char_length(trim(p_note)) not between 1 and 1000 or p_action is null or p_action not in ('reviewed','dismissed','removed_listing') then raise exception 'Choose a decision and enter a reason';end if;
 if p_kind='listing' then
 select listing_id,status into item,current_status from public.listing_reports where id=p_report for update;
 elsif p_kind='conversation' then
 select c.listing_id,r.status into item,current_status from public.conversation_reports r join public.chat_conversations c on c.id=r.conversation_id where r.id=p_report for update of r;
 else raise exception 'Invalid report kind';end if;
 if current_status is null then raise exception 'Report no longer exists';end if;
 if current_status is distinct from p_expected or current_status<>'pending' then raise exception 'Report changed or already decided. Refresh it before continuing.' using errcode='40001';end if;
 next_status=case when p_action='dismissed' then 'dismissed' else 'reviewed' end;
 if p_action='removed_listing' then update public.listings set status='removed',moderation_removed=true where id=item;end if;
 if p_kind='listing' then update public.listing_reports set status=next_status where id=p_report;
 else update public.conversation_reports set status=next_status where id=p_report;end if;
 insert into private.moderation_audit(moderator_id,report_kind,report_id,action,note) values(auth.uid(),p_kind,p_report,p_action,trim(p_note));
 return jsonb_build_object('status',next_status,'listing_removed',p_action='removed_listing');
end;$$;
revoke all on function private.moderation_decide(text,uuid,text,text,text) from public,anon;
grant execute on function private.moderation_decide(text,uuid,text,text,text) to authenticated;
create function public.moderation_decide(p_kind text,p_report uuid,p_action text,p_note text,p_expected text) returns jsonb language sql security invoker set search_path='' as $$select private.moderation_decide(p_kind,p_report,p_action,p_note,p_expected);$$;
revoke all on function public.moderation_decide(text,uuid,text,text,text) from public,anon;
grant execute on function public.moderation_decide(text,uuid,text,text,text) to authenticated;

create function private.moderator_reported_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_market_moderator() and exists(select 1 from public.listings l where l.image_path=p_path and
 (exists(select 1 from public.listing_reports r where r.listing_id=l.id) or exists(select 1 from public.chat_conversations c join public.conversation_reports r on r.conversation_id=c.id where c.listing_id=l.id)));
$$;
revoke all on function private.moderator_reported_photo(text) from public,anon;
grant execute on function private.moderator_reported_photo(text) to authenticated;
create policy moderator_reported_photo on storage.objects for select to authenticated using(bucket_id='market-listing-images' and private.moderator_reported_photo(name));
