grant usage on schema private to service_role;
-- Preserve foreign-key identities for chats/reports; erase public listing content.
alter table public.listings add column permanently_deleted_at timestamptz, add column deletion_cleanup_pending boolean not null default false;
alter table public.listings alter column image_path drop not null;
revoke insert on public.listings from authenticated;
grant insert(id,owner_id,title,description,price,category,condition,province,area,image_path,negotiable,handovers,property_type,purpose,price_period,bedrooms,size_sqm) on public.listings to authenticated;
alter policy listing_read on public.listings using((permanently_deleted_at is null or (owner_id=auth.uid() and deletion_cleanup_pending and private.active_account())) and ((status<>'removed') or owner_id=auth.uid()) and private.seller_visible(owner_id));
alter policy listing_edit on public.listings using(owner_id=auth.uid() and private.active_account() and not moderation_removed and permanently_deleted_at is null)
with check(owner_id=auth.uid() and private.active_account() and not moderation_removed and permanently_deleted_at is null and exists(select 1 from public.listing_assets a where a.path=image_path and a.owner_id=auth.uid()));
alter table public.listings add constraint deleted_listing_stays_removed check(permanently_deleted_at is null or (status='removed' and image_path is null));
create table private.listing_deletions (
 listing_id uuid primary key references public.listings(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 original_photo text not null,
 evidence jsonb,
 requested_at timestamptz not null default now(), completed_at timestamptz
);
create index listing_deletions_owner on private.listing_deletions(owner_id);
alter table private.listing_deletions enable row level security;
revoke all on private.listing_deletions from public,anon,authenticated;
grant all on private.listing_deletions to service_role;
create policy listing_deletion_service on private.listing_deletions to service_role using(true) with check(true);

create function private.begin_listing_deletion(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.listings; prior private.listing_deletions; keep boolean;
begin
 if not private.active_account() then raise insufficient_privilege using message='Sign in again before deleting a listing.';end if;
 select * into item from public.listings where id=target for update;
 if item.id is null or item.owner_id<>auth.uid() then raise insufficient_privilege using message='This listing cannot be deleted by this account.';end if;
 select * into prior from private.listing_deletions where listing_id=target;
 if prior.listing_id is not null then return jsonb_build_object('id',target,'retained_evidence',prior.evidence is not null,'completed',prior.completed_at is not null);end if;
 if item.status<>'removed' or item.moderation_removed then raise exception 'Remove your listing first. Moderator-removed listings cannot be deleted here.';end if;
 keep=exists(select 1 from public.listing_reports where listing_id=target) or exists(select 1 from public.conversation_reports r join public.chat_conversations c on c.id=r.conversation_id where c.listing_id=target);
 insert into private.listing_deletions(listing_id,owner_id,original_photo,evidence) values(target,auth.uid(),item.image_path,case when keep then to_jsonb(item) else null end);
 update public.listings set permanently_deleted_at=clock_timestamp(),deletion_cleanup_pending=true,title='Listing deleted',description='Listing deleted',price=0,category='Other Items',condition='Fair',province='Deleted',area='Deleted',image_path=null,negotiable=false,handovers=array['Public meetup'],property_type=null,purpose=null,price_period='Total',bedrooms=null,size_sqm=null where id=target;
 delete from public.saved_listings where listing_id=target;
 return jsonb_build_object('id',target,'retained_evidence',keep,'completed',false);
end;$$;
revoke all on function private.begin_listing_deletion(uuid) from public,anon;
grant execute on function private.begin_listing_deletion(uuid) to authenticated;
create function public.begin_listing_deletion(target uuid) returns jsonb language sql security invoker set search_path='' as $$select private.begin_listing_deletion(target);$$;
revoke all on function public.begin_listing_deletion(uuid) from public,anon;
grant execute on function public.begin_listing_deletion(uuid) to authenticated;

-- Serialize evidence-taking with concurrent report creation. No client bypass.
create function private.lock_report_listing() returns trigger language plpgsql security definer set search_path='' as $$
declare item uuid;
begin
 if not private.active_account() or new.reporter_id<>auth.uid() then raise insufficient_privilege;end if;
 if tg_table_name='listing_reports' then item=new.listing_id;else select listing_id into item from public.chat_conversations where id=new.conversation_id;end if;
 perform 1 from public.listings where id=item for update;
 return new;
end;$$;
revoke all on function private.lock_report_listing() from public,anon,authenticated;
create trigger lock_listing_before_report before insert on public.listing_reports for each row execute function private.lock_report_listing();
create trigger lock_listing_before_chat_report before insert on public.conversation_reports for each row execute function private.lock_report_listing();

-- Prevent a late edit upload from registering a new asset after deletion.
create function private.reject_deleted_listing_asset() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.listing_deletions d where d.owner_id=new.owner_id and new.path like d.owner_id::text||'/'||d.listing_id::text||'-%') then raise exception 'Listing deleted';end if;
 return new;
end;$$;
revoke all on function private.reject_deleted_listing_asset() from public,anon,authenticated;
create trigger reject_deleted_listing_asset before insert on public.listing_assets for each row execute function private.reject_deleted_listing_asset();

create function private.deleted_listing_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.listing_deletions d where d.original_photo=p_path or p_path like d.owner_id::text||'/'||d.listing_id::text||'-%');
$$;
revoke all on function private.deleted_listing_photo(text) from public;
grant execute on function private.deleted_listing_photo(text) to anon,authenticated;
alter policy market_photo_read on storage.objects using(bucket_id='market-listing-images' and not private.deleted_listing_photo(name) and (exists(select 1 from public.listings l where l.image_path=name and l.status<>'removed') or (auth.uid() is not null and name like auth.uid()::text||'/%')));
create or replace function private.moderator_reported_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_market_moderator() and (exists(select 1 from public.listings l where l.image_path=p_path and (exists(select 1 from public.listing_reports r where r.listing_id=l.id) or exists(select 1 from public.chat_conversations c join public.conversation_reports r on r.conversation_id=c.id where c.listing_id=l.id))) or exists(select 1 from private.listing_deletions d where d.evidence->>'image_path'=p_path));
$$;
create or replace function private.moderation_queue(p_kind text,p_status text,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_market_moderator();
 if p_kind not in ('listing','conversation') or p_kind is null or p_status not in ('pending','reviewed','dismissed') or p_status is null or p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid queue filter';end if;
 if p_kind='listing' then
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into result from (
 select r.id,r.reason,r.details,r.status,r.created_at,coalesce(d.evidence->>'title',l.title) as target_label,p.display_name as reporter_name
 from public.listing_reports r join public.listings l on l.id=r.listing_id left join private.listing_deletions d on d.listing_id=l.id left join public.profiles p on p.id=r.reporter_id
 where r.status=p_status order by r.created_at,r.id limit 20 offset p_offset) q;
 else
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into result from (
 select r.id,r.reason,r.details,r.status,r.created_at,coalesce(d.evidence->>'title',l.title) as target_label,p.display_name as reporter_name
 from public.conversation_reports r join public.chat_conversations c on c.id=r.conversation_id join public.listings l on l.id=c.listing_id left join private.listing_deletions d on d.listing_id=l.id left join public.profiles p on p.id=r.reporter_id
 where r.status=p_status order by r.created_at,r.id limit 20 offset p_offset) q;
 end if;
 insert into private.moderation_audit(moderator_id,report_kind,report_id,action,note)
 select auth.uid(),p_kind,(entry->>'id')::uuid,'opened_report','Viewed report queue summary' from jsonb_array_elements(result) entry;
 return result;
end;$$;
create or replace function private.moderation_report(p_kind text,p_report uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 into result from public.listings base left join private.listing_deletions d on d.listing_id=base.id cross join lateral jsonb_populate_record(null::public.listings,coalesce(d.evidence,to_jsonb(base))) l left join public.profiles p on p.id=l.owner_id where l.id=item;
 return result;
end;$$;
create or replace view public.chat_inbox with(security_invoker=true) as
select c.id,c.listing_id,c.buyer_id,c.seller_id,c.created_at,
 case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end as other_id,
 p.display_name as other_name,coalesce(l.title,'Listing deleted') as listing_title,coalesce(l.status,'removed') as listing_status,
 (select m.body from public.chat_messages m where m.conversation_id=c.id order by m.sequence desc limit 1) as last_body,
 coalesce((select m.created_at from public.chat_messages m where m.conversation_id=c.id order by m.sequence desc limit 1),c.created_at) as last_at,
 (select count(*) from public.chat_messages m where m.conversation_id=c.id and m.sender_id<>auth.uid()
 and m.sequence>coalesce((select r.last_read_sequence from public.chat_reads r where r.conversation_id=c.id and r.user_id=auth.uid()),0)) as unread_count
from public.chat_conversations c
left join public.listings l on l.id=c.listing_id
left join public.profiles p on p.id=case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end;

-- Only the Edge Function's service credential can obtain cleanup paths or finish.
create function private.listing_cleanup_manifest(target uuid,account uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.listing_deletions;protected text[];
begin
 select * into d from private.listing_deletions where listing_id=target and owner_id=account;
 if d.listing_id is null then raise insufficient_privilege;end if;
 select coalesce(array_agg(distinct path),'{}'::text[]) into protected from (
 select image_path as path from public.listings where owner_id=account and image_path is not null
 union select evidence->>'image_path' from private.listing_deletions where owner_id=account and evidence is not null) q;
 return jsonb_build_object('original_photo',d.original_photo,'protected_paths',protected,'retained_evidence',d.evidence is not null,'completed',d.completed_at is not null);
end;$$;
revoke all on function private.listing_cleanup_manifest(uuid,uuid) from public,anon,authenticated;
grant execute on function private.listing_cleanup_manifest(uuid,uuid) to service_role;
create function public.listing_cleanup_manifest(target uuid,account uuid) returns jsonb language sql security invoker set search_path='' as $$select private.listing_cleanup_manifest(target,account);$$;
revoke all on function public.listing_cleanup_manifest(uuid,uuid) from public,anon,authenticated;
grant execute on function public.listing_cleanup_manifest(uuid,uuid) to service_role;
create function private.finish_listing_deletion(target uuid,account uuid) returns void language plpgsql security definer set search_path='' as $$
declare d private.listing_deletions;
begin
 select * into d from private.listing_deletions where listing_id=target and owner_id=account for update;
 if d.listing_id is null then raise insufficient_privilege;end if;
 delete from public.listing_assets a where a.owner_id=account and (a.path=d.original_photo or a.path like account::text||'/'||target::text||'-%')
 and not exists(select 1 from public.listings l where l.image_path=a.path)
 and not exists(select 1 from private.listing_deletions e where e.evidence->>'image_path'=a.path);
 update private.listing_deletions set completed_at=coalesce(completed_at,clock_timestamp()) where listing_id=target;
 update public.listings set deletion_cleanup_pending=false where id=target;
end;$$;
revoke all on function private.finish_listing_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function private.finish_listing_deletion(uuid,uuid) to service_role;
create function public.finish_listing_deletion(target uuid,account uuid) returns void language sql security invoker set search_path='' as $$select private.finish_listing_deletion(target,account);$$;
revoke all on function public.finish_listing_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.finish_listing_deletion(uuid,uuid) to service_role;
