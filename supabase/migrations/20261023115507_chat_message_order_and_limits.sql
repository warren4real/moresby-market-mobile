-- Serialize each conversation before assigning its visible read position.
-- Identity defaults run before BEFORE triggers; assigning after the lock avoids
-- a late-committing lower sequence becoming invisible to an advanced read cursor.
-- The private definer can count all of this sender's messages, including blocked
-- conversations, so blocking cannot reset the sending rate limit.
create or replace function private.message_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.sender_id is distinct from auth.uid() or not private.active_account() then
 raise insufficient_privilege using message='Verified sender required';end if;
 if not exists(select 1 from public.chat_conversations c where c.id=new.conversation_id
 and (c.buyer_id=auth.uid() or c.seller_id=auth.uid())
 and private.seller_visible(case when c.buyer_id=auth.uid() then c.seller_id else c.buyer_id end)) then
 raise insufficient_privilege using message='Conversation unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.conversation_id::text,4));
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,2));
 if (select count(*) from public.chat_messages where sender_id=new.sender_id and created_at>now()-interval '1 minute')>=30
 or (select count(*) from public.chat_messages where sender_id=new.sender_id and created_at>now()-interval '1 day')>=500 then raise exception 'Message limit reached';end if;
 new.sequence=nextval(pg_get_serial_sequence('public.chat_messages','sequence')::regclass);
 new.created_at=clock_timestamp();
 return new;
end;$$;
revoke all on function private.message_limit() from public,anon,authenticated;
