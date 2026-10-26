create table public.chat_conversations (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id) on delete cascade,
 buyer_id uuid not null references auth.users(id) on delete cascade,
 seller_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(listing_id,buyer_id),check(buyer_id<>seller_id)
);
create index chat_buyer on public.chat_conversations(buyer_id);
create index chat_seller on public.chat_conversations(seller_id);
alter table public.chat_conversations enable row level security;
revoke all on public.chat_conversations from public,anon,authenticated;
grant select on public.chat_conversations to authenticated;
grant insert(listing_id,buyer_id) on public.chat_conversations to authenticated;
create policy chat_participant_read on public.chat_conversations for select to authenticated using(
 (buyer_id=auth.uid() or seller_id=auth.uid()) and private.active_account()
 and private.seller_visible(case when buyer_id=auth.uid() then seller_id else buyer_id end));
create policy chat_buyer_create on public.chat_conversations for insert to authenticated with check(
 buyer_id=auth.uid() and private.active_account() and exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=seller_id and l.owner_id<>auth.uid() and l.status='available'));
create function private.prepare_chat() returns trigger language plpgsql set search_path='' as $$
begin
 -- Seller is derived from the visible listing, never from caller input.
 select owner_id into new.seller_id from public.listings where id=new.listing_id and status='available';
 if new.seller_id is null then raise exception 'Listing is unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.buyer_id::text,1));
 if (select count(*) from public.chat_conversations where buyer_id=new.buyer_id and created_at>now()-interval '1 day')>=50 then raise exception 'Daily conversation limit reached';end if;
 return new;
end;$$;
revoke all on function private.prepare_chat() from public;
create trigger prepare_chat before insert on public.chat_conversations for each row execute function private.prepare_chat();

create table public.chat_messages (
 id uuid primary key,
 sequence integer generated always as identity unique,
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index chat_message_order on public.chat_messages(conversation_id,sequence desc);
create index chat_message_sender on public.chat_messages(sender_id,created_at desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from public,anon,authenticated;
grant select on public.chat_messages to authenticated;
grant insert(id,conversation_id,sender_id,body) on public.chat_messages to authenticated;
create policy messages_read on public.chat_messages for select to authenticated using(exists(select 1 from public.chat_conversations c where c.id=conversation_id));
create policy messages_send on public.chat_messages for insert to authenticated with check(sender_id=auth.uid() and private.active_account() and exists(
 select 1 from public.chat_conversations c join public.listings l on l.id=c.listing_id where c.id=conversation_id and l.status<>'removed'));
create function private.message_limit() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,2));
 if (select count(*) from public.chat_messages where sender_id=new.sender_id and created_at>now()-interval '1 minute')>=30
 or (select count(*) from public.chat_messages where sender_id=new.sender_id and created_at>now()-interval '1 day')>=500 then raise exception 'Message limit reached';end if;
 return new;
end;$$;
revoke all on function private.message_limit() from public;
create trigger limit_chat_messages before insert on public.chat_messages for each row execute function private.message_limit();

create table public.chat_reads (
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 last_read_sequence integer not null default 0 check(last_read_sequence>=0),
 primary key(conversation_id,user_id)
);
create index chat_reads_user on public.chat_reads(user_id);
alter table public.chat_reads enable row level security;
revoke all on public.chat_reads from public,anon,authenticated;
grant select,insert on public.chat_reads to authenticated;
grant update(last_read_sequence) on public.chat_reads to authenticated;
create policy reads_own on public.chat_reads for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.chat_conversations c where c.id=conversation_id));
create policy reads_create on public.chat_reads for insert to authenticated with check(user_id=auth.uid() and private.active_account() and exists(select 1 from public.chat_conversations c where c.id=conversation_id));
create policy reads_update on public.chat_reads for update to authenticated using(user_id=auth.uid() and private.active_account() and exists(select 1 from public.chat_conversations c where c.id=conversation_id)) with check(user_id=auth.uid() and private.active_account() and exists(select 1 from public.chat_conversations c where c.id=conversation_id));
create function private.clamp_chat_read() returns trigger language plpgsql set search_path='' as $$
begin
 if new.last_read_sequence>coalesce((select max(sequence) from public.chat_messages where conversation_id=new.conversation_id),0) then raise exception 'Invalid read position';end if;
 if tg_op='UPDATE' then new.last_read_sequence=greatest(old.last_read_sequence,new.last_read_sequence);end if;
 return new;
end;$$;
revoke all on function private.clamp_chat_read() from public;
create trigger clamp_chat_read before insert or update on public.chat_reads for each row execute function private.clamp_chat_read();
create function public.mark_chat_read(target uuid,last_message uuid) returns void language sql security invoker set search_path='' as $$
 insert into public.chat_reads(conversation_id,user_id,last_read_sequence)
 select target,auth.uid(),m.sequence from public.chat_messages m where m.id=last_message and m.conversation_id=target
 on conflict(conversation_id,user_id) do update set last_read_sequence=greatest(public.chat_reads.last_read_sequence,excluded.last_read_sequence);
$$;
revoke all on function public.mark_chat_read(uuid,uuid) from public,anon;
grant execute on function public.mark_chat_read(uuid,uuid) to authenticated;

create view public.chat_inbox with(security_invoker=true) as
select c.id,c.listing_id,c.buyer_id,c.seller_id,c.created_at,
 case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end as other_id,
 p.display_name as other_name,l.title as listing_title,l.status as listing_status,
 (select m.body from public.chat_messages m where m.conversation_id=c.id order by m.sequence desc limit 1) as last_body,
 coalesce((select m.created_at from public.chat_messages m where m.conversation_id=c.id order by m.sequence desc limit 1),c.created_at) as last_at,
 (select count(*) from public.chat_messages m where m.conversation_id=c.id and m.sender_id<>auth.uid()
 and m.sequence>coalesce((select r.last_read_sequence from public.chat_reads r where r.conversation_id=c.id and r.user_id=auth.uid()),0)) as unread_count
from public.chat_conversations c
left join public.listings l on l.id=c.listing_id
left join public.profiles p on p.id=case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end;
revoke all on public.chat_inbox from public,anon,authenticated;
grant select on public.chat_inbox to authenticated;
create function public.chat_unread_count() returns bigint language sql stable security invoker set search_path='' as $$select coalesce(sum(unread_count),0)::bigint from public.chat_inbox;$$;
revoke all on function public.chat_unread_count() from public,anon;
grant execute on function public.chat_unread_count() to authenticated;

create table public.conversation_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
 reason text not null check(reason in ('Suspected scam','Harassment or threats','Spam','Other')),
 details text not null default '' check(char_length(details)<=1000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),unique(reporter_id,conversation_id)
);
create index conversation_reports_chat on public.conversation_reports(conversation_id);
alter table public.conversation_reports enable row level security;
revoke all on public.conversation_reports from public,anon,authenticated;
grant select on public.conversation_reports to authenticated;
grant insert(reporter_id,conversation_id,reason,details) on public.conversation_reports to authenticated;
create policy chat_reports_read on public.conversation_reports for select to authenticated using(reporter_id=auth.uid() and private.active_account());
create policy chat_reports_create on public.conversation_reports for insert to authenticated with check(reporter_id=auth.uid() and private.active_account() and exists(select 1 from public.chat_conversations c where c.id=conversation_id));
create function private.chat_report_limit() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text,3));
 if (select count(*) from public.conversation_reports where reporter_id=new.reporter_id and created_at>now()-interval '1 day')>=30 then raise exception 'Daily report limit reached';end if;
 return new;
end;$$;
revoke all on function private.chat_report_limit() from public;
create trigger limit_chat_reports before insert on public.conversation_reports for each row execute function private.chat_report_limit();

-- Operator review is intentionally explicit and audited. Only trusted service
-- credentials can call this; ordinary users cannot retrieve a review transcript.
create table private.chat_review_audit (
 id uuid primary key default gen_random_uuid(),report_id uuid,
 operator_label text not null,review_reason text not null,created_at timestamptz not null default now()
);
alter table private.chat_review_audit enable row level security;
revoke all on private.chat_review_audit from public,anon,authenticated;
create policy chat_audit_service on private.chat_review_audit to service_role using(true) with check(true);
create function private.review_chat_report(report uuid,operator_label text,review_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid;transcript jsonb;
begin
 if char_length(trim(operator_label)) not between 1 and 100 or char_length(trim(review_reason)) not between 1 and 300 then raise exception 'Operator and review reason are required';end if;
 select conversation_id into target from public.conversation_reports where id=report;
 if target is null then raise exception 'Report not found';end if;
 insert into private.chat_review_audit(report_id,operator_label,review_reason) values(report,operator_label,review_reason);
 select coalesce(jsonb_agg(row_to_json(m) order by m.sequence),'[]'::jsonb) into transcript from (select id,sequence,sender_id,body,created_at from public.chat_messages where conversation_id=target order by sequence desc limit 100) m;
 return transcript;
end;$$;
revoke all on function private.review_chat_report(uuid,text,text) from public,anon,authenticated;
grant execute on function private.review_chat_report(uuid,text,text) to service_role;
create function public.review_chat_report(report uuid,operator_label text,review_reason text) returns jsonb language sql security invoker set search_path='' as $$select private.review_chat_report(report,operator_label,review_reason);$$;
revoke all on function public.review_chat_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_chat_report(uuid,text,text) to service_role;
