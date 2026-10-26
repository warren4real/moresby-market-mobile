-- Disposable accounts/messages; no email or external message is sent.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('a1000000-1111-4111-8111-111111111111','chat-seller@example.invalid',now()),
 ('b2000000-2222-4222-8222-222222222222','chat-buyer@example.invalid',now()),
 ('c3000000-3333-4333-8333-333333333333','chat-outsider@example.invalid',now());
insert into auth.sessions(id,user_id) values
 ('a1000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-1111-4111-8111-111111111111'),
 ('b2000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b2000000-2222-4222-8222-222222222222'),
 ('c3000000-cccc-4ccc-8ccc-cccccccccccc','c3000000-3333-4333-8333-333333333333');
insert into public.listing_assets(path,owner_id) values('a1000000-1111-4111-8111-111111111111/chat.jpg','a1000000-1111-4111-8111-111111111111');
insert into public.listings(id,owner_id,title,description,price,category,condition,province,area,image_path) values('d4000000-dddd-4ddd-8ddd-dddddddddddd','a1000000-1111-4111-8111-111111111111','Chat fixture','Disposable',1,'Other Items','Good','Morobe','Lae','a1000000-1111-4111-8111-111111111111/chat.jpg');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b2000000-2222-4222-8222-222222222222","role":"authenticated","session_id":"b2000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
insert into public.chat_conversations(listing_id,buyer_id) values('d4000000-dddd-4ddd-8ddd-dddddddddddd',auth.uid());
do $$declare chat uuid;begin
 select id into chat from public.chat_conversations where listing_id='d4000000-dddd-4ddd-8ddd-dddddddddddd';
 if not exists(select 1 from public.chat_conversations where id=chat and seller_id='a1000000-1111-4111-8111-111111111111') then raise exception 'Seller not derived';end if;
 insert into public.chat_messages(id,conversation_id,sender_id,body) values('b2000000-eeee-4eee-8eee-eeeeeeeeeeee',chat,auth.uid(),'Disposable buyer hello');
 begin insert into public.chat_messages(id,conversation_id,sender_id,body) values(gen_random_uuid(),chat,'a1000000-1111-4111-8111-111111111111','Forged');raise exception 'Sender impersonation accepted';exception when insufficient_privilege then null;end;
 begin update public.chat_messages set body='Rewritten' where conversation_id=chat;raise exception 'Message edit allowed';exception when insufficient_privilege then null;end;
 begin update public.chat_conversations set seller_id=auth.uid() where id=chat;raise exception 'Participants mutable';exception when insufficient_privilege then null;end;
 begin insert into public.chat_reads(conversation_id,user_id,last_read_sequence) values(chat,'a1000000-1111-4111-8111-111111111111',0);raise exception 'Other receipt changed';exception when insufficient_privilege then null;end;
 if public.chat_unread_count()<>0 then raise exception 'Own message counted unread';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"a1000000-1111-4111-8111-111111111111","role":"authenticated","session_id":"a1000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
do $$declare chat uuid;begin
 select id into chat from public.chat_conversations where listing_id='d4000000-dddd-4ddd-8ddd-dddddddddddd';
 if public.chat_unread_count()<>1 then raise exception 'Recipient unread missing';end if;
 perform public.mark_chat_read(chat,'b2000000-eeee-4eee-8eee-eeeeeeeeeeee');
 if public.chat_unread_count()<>0 then raise exception 'Read cursor not advanced';end if;
 insert into public.chat_messages(id,conversation_id,sender_id,body) values('a1000000-eeee-4eee-8eee-eeeeeeeeeeee',chat,auth.uid(),'Disposable seller reply');
 begin insert into public.chat_reads(conversation_id,user_id,last_read_sequence) values(chat,auth.uid(),2147483647) on conflict(conversation_id,user_id) do update set last_read_sequence=excluded.last_read_sequence;raise exception 'Future receipt accepted';exception when raise_exception then if sqlerrm='Future receipt accepted' then raise;end if;end;
end$$;
select set_config('request.jwt.claims','{"sub":"c3000000-3333-4333-8333-333333333333","role":"authenticated","session_id":"c3000000-cccc-4ccc-8ccc-cccccccccccc"}',true);
do $$begin
 if exists(select 1 from public.chat_messages) or exists(select 1 from public.chat_conversations) or exists(select 1 from public.chat_inbox) or exists(select 1 from public.chat_reads) then raise exception 'Private chat leaked to outsider';end if;
 begin perform public.review_chat_report(gen_random_uuid(),'attacker','forged');raise exception 'Operator transcript exposed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"sub":"b2000000-2222-4222-8222-222222222222","role":"authenticated","session_id":"b2000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
do $$declare chat uuid;begin
 select id into chat from public.chat_conversations where listing_id='d4000000-dddd-4ddd-8ddd-dddddddddddd';
 if public.chat_unread_count()<>1 then raise exception 'Reply unread missing';end if;
 insert into public.conversation_reports(reporter_id,conversation_id,reason) values(auth.uid(),chat,'Spam');
end$$;
insert into public.account_blocks(blocker_id,blocked_id,blocked_name) values(auth.uid(),'a1000000-1111-4111-8111-111111111111','Seller');
do $$begin if exists(select 1 from public.chat_messages) or exists(select 1 from public.chat_inbox) then raise exception 'Blocked chat visible';end if;end$$;
select set_config('request.jwt.claims','{"sub":"a1000000-1111-4111-8111-111111111111","role":"authenticated","session_id":"a1000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
do $$begin
 if exists(select 1 from public.chat_messages) then raise exception 'Block not two way for chat';end if;
 if exists(select 1 from public.conversation_reports) then raise exception 'Private report exposed';end if;
end$$;
reset role;
-- Operator review produces a durable access record, not an unlogged transcript endpoint.
do $$declare report uuid;data jsonb;begin
 select id into report from public.conversation_reports where reporter_id='b2000000-2222-4222-8222-222222222222';
 data=private.review_chat_report(report,'automated-fixture','Disposable privacy check');
 if jsonb_array_length(data)<>2 or not exists(select 1 from private.chat_review_audit where report_id=report) then raise exception 'Operator review not audited';end if;
end$$;
delete from public.account_blocks where blocker_id='b2000000-2222-4222-8222-222222222222';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b2000000-2222-4222-8222-222222222222","role":"authenticated","session_id":"b2000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
do $$begin if (select count(*) from public.chat_messages)<>2 then raise exception 'Unblock did not restore chat';end if;end$$;
reset role;
update public.listings set status='removed' where id='d4000000-dddd-4ddd-8ddd-dddddddddddd';
set local role authenticated;
do $$declare chat uuid;begin
 select id into chat from public.chat_conversations where listing_id='d4000000-dddd-4ddd-8ddd-dddddddddddd';
 if (select count(*) from public.chat_messages)<>2 then raise exception 'Removed listing lost private history';end if;
 begin insert into public.chat_messages(id,conversation_id,sender_id,body) values(gen_random_uuid(),chat,auth.uid(),'Removed send');raise exception 'Removed listing send allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select private.begin_account_deletion('b2000000-2222-4222-8222-222222222222');
set local role authenticated;
do $$begin if exists(select 1 from public.chat_messages) then raise exception 'Revoked account read chat';end if;end$$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin begin perform * from public.chat_inbox;raise exception 'Anonymous inbox exposed';exception when insufficient_privilege then null;end;begin perform * from public.chat_messages;raise exception 'Anonymous messages exposed';exception when insufficient_privilege then null;end;end$$;
reset role;
delete from auth.users where id='b2000000-2222-4222-8222-222222222222';
do $$begin if exists(select 1 from public.chat_conversations where buyer_id='b2000000-2222-4222-8222-222222222222') or exists(select 1 from public.chat_messages where id in ('a1000000-eeee-4eee-8eee-eeeeeeeeeeee','b2000000-eeee-4eee-8eee-eeeeeeeeeeee')) then raise exception 'Deleted conversations retained';end if;end$$;
rollback;
select 'Chat participation, sender integrity, unread isolation, blocks, report privacy, audited review and deletion cascades passed' as result;
