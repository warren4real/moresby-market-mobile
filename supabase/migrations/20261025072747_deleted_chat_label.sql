create function private.deleted_chat_title(target uuid) returns text language sql stable security definer set search_path='' as $$
 select case when l.permanently_deleted_at is not null then 'Listing deleted' else 'Listing no longer available' end
 from public.listings l where l.id=target and private.active_account() and exists(select 1 from public.chat_conversations c where c.listing_id=l.id and (c.buyer_id=auth.uid() or c.seller_id=auth.uid()) and private.seller_visible(case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end));
$$;
revoke all on function private.deleted_chat_title(uuid) from public,anon;
grant execute on function private.deleted_chat_title(uuid) to authenticated;
create or replace view public.chat_inbox with(security_invoker=true) as
select c.id,c.listing_id,c.buyer_id,c.seller_id,c.created_at,
 case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end as other_id,
 p.display_name as other_name,coalesce(l.title,private.deleted_chat_title(c.listing_id),'Listing no longer available') as listing_title,coalesce(l.status,'removed') as listing_status,
 (select m.body from public.chat_messages m where m.conversation_id=c.id order by m.sequence desc limit 1) as last_body,
 coalesce((select m.created_at from public.chat_messages m where m.conversation_id=c.id order by m.sequence desc limit 1),c.created_at) as last_at,
 (select count(*) from public.chat_messages m where m.conversation_id=c.id and m.sender_id<>auth.uid()
 and m.sequence>coalesce((select r.last_read_sequence from public.chat_reads r where r.conversation_id=c.id and r.user_id=auth.uid()),0)) as unread_count
from public.chat_conversations c
left join public.listings l on l.id=c.listing_id
left join public.profiles p on p.id=case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end;

