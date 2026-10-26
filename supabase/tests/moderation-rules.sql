begin;
-- Disposable fixtures only. Neither the real operator nor real reports are changed.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('11000000-1111-4111-8111-111111111111','moderator-fixture@example.invalid',now(),'{"display_name":"Fixture moderator"}'),
 ('22000000-2222-4222-8222-222222222222','seller-fixture@example.invalid',now(),'{"display_name":"Fixture seller"}'),
 ('33000000-3333-4333-8333-333333333333','reporter-fixture@example.invalid',now(),'{"display_name":"Fixture buyer","role":"moderator"}');
insert into auth.sessions(id,user_id) values
 ('11000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11000000-1111-4111-8111-111111111111'),
 ('22000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22000000-2222-4222-8222-222222222222'),
 ('33000000-cccc-4ccc-8ccc-cccccccccccc','33000000-3333-4333-8333-333333333333');
insert into private.moderator_accounts(user_id,granted_reason) values('11000000-1111-4111-8111-111111111111','Disposable test only');
insert into public.listing_assets(path,owner_id) values('22000000-2222-4222-8222-222222222222/mod.jpg','22000000-2222-4222-8222-222222222222');
insert into public.listings(id,owner_id,title,description,price,category,condition,province,area,image_path)
select id::uuid,'22000000-2222-4222-8222-222222222222','Disposable moderation listing','Disposable',1,'Other Items','Good','Morobe','Lae','22000000-2222-4222-8222-222222222222/mod.jpg'
from unnest(array['44000000-dddd-4ddd-8ddd-dddddddddddd','55000000-dddd-4ddd-8ddd-dddddddddddd','66000000-dddd-4ddd-8ddd-dddddddddddd']) id;
insert into public.chat_conversations(id,listing_id,buyer_id) values('77000000-dddd-4ddd-8ddd-dddddddddddd','55000000-dddd-4ddd-8ddd-dddddddddddd','33000000-3333-4333-8333-333333333333');
-- The deletion/report serialization trigger now requires the fixture reporter's
-- current verified session even when an operator seeds disposable report rows.
select set_config('request.jwt.claims','{"sub":"33000000-3333-4333-8333-333333333333","role":"authenticated","session_id":"33000000-cccc-4ccc-8ccc-cccccccccccc"}',true);
insert into public.listing_reports(id,reporter_id,listing_id,reason,created_at) values
 ('88000000-dddd-4ddd-8ddd-dddddddddddd','33000000-3333-4333-8333-333333333333','44000000-dddd-4ddd-8ddd-dddddddddddd','Other','2000-01-01'),
 ('99000000-dddd-4ddd-8ddd-dddddddddddd','33000000-3333-4333-8333-333333333333','66000000-dddd-4ddd-8ddd-dddddddddddd','Other','2000-01-01');
insert into public.conversation_reports(id,reporter_id,conversation_id,reason,created_at) values('aa000000-dddd-4ddd-8ddd-dddddddddddd','33000000-3333-4333-8333-333333333333','77000000-dddd-4ddd-8ddd-dddddddddddd','Spam','2000-01-01');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33000000-3333-4333-8333-333333333333","role":"authenticated","session_id":"33000000-cccc-4ccc-8ccc-cccccccccccc","user_metadata":{"role":"moderator"}}',true);
insert into public.chat_messages(id,conversation_id,sender_id,body) values('bb000000-dddd-4ddd-8ddd-dddddddddddd','77000000-dddd-4ddd-8ddd-dddddddddddd',auth.uid(),'Disposable private message');
do $$begin
 if public.is_market_moderator() then raise exception 'User metadata granted moderator access';end if;
 begin insert into private.moderator_accounts(user_id,granted_reason) values(auth.uid(),'Self promote');raise exception 'Self promotion allowed';exception when insufficient_privilege then null;end;
 begin perform public.moderation_queue('listing');raise exception 'Ordinary account read queue';exception when insufficient_privilege then null;end;
 begin perform public.moderation_report('listing','88000000-dddd-4ddd-8ddd-dddddddddddd');raise exception 'Ordinary account read report';exception when insufficient_privilege then null;end;
 begin perform public.moderation_conversation('aa000000-dddd-4ddd-8ddd-dddddddddddd','Forged review');raise exception 'Ordinary account read transcript';exception when insufficient_privilege then null;end;
 begin perform public.moderation_decide('listing','88000000-dddd-4ddd-8ddd-dddddddddddd','removed_listing','Forged decision','pending');raise exception 'Ordinary account moderated';exception when insufficient_privilege then null;end;
 begin perform * from private.moderation_audit;raise exception 'Audit exposed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims','{"sub":"11000000-1111-4111-8111-111111111111","role":"authenticated","session_id":"11000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
do $$declare queue jsonb;detail jsonb;transcript jsonb;begin
 if not public.is_market_moderator() then raise exception 'Operator not recognized';end if;
 queue=public.moderation_queue('listing');
 if not jsonb_path_exists(queue,'$[*] ? (@.id == "88000000-dddd-4ddd-8ddd-dddddddddddd")') then raise exception 'Queue fixture missing';end if;
 if exists(select 1 from public.listing_reports where id='88000000-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Moderator bypassed ordinary report RLS directly';end if;
 detail=public.moderation_report('conversation','aa000000-dddd-4ddd-8ddd-dddddddddddd');
 if detail ? 'messages' then raise exception 'Transcript opened automatically';end if;
 begin perform public.moderation_conversation('aa000000-dddd-4ddd-8ddd-dddddddddddd',' ');raise exception 'Empty reason accepted';exception when raise_exception then if sqlerrm='Empty reason accepted' then raise;end if;end;
 transcript=public.moderation_conversation('aa000000-dddd-4ddd-8ddd-dddddddddddd','Disposable transcript test');
 if jsonb_array_length(transcript)<>1 then raise exception 'Transcript missing';end if;
 begin perform public.moderation_decide('listing','88000000-dddd-4ddd-8ddd-dddddddddddd','removed_listing',' ','pending');raise exception 'Empty decision accepted';exception when raise_exception then if sqlerrm='Empty decision accepted' then raise;end if;end;
 perform public.moderation_decide('listing','88000000-dddd-4ddd-8ddd-dddddddddddd','removed_listing','Disposable removal','pending');
 begin perform public.moderation_decide('listing','88000000-dddd-4ddd-8ddd-dddddddddddd','dismissed','Stale competing decision','pending');raise exception 'Stale decision overwrote';exception when serialization_failure then null;end;
 perform public.moderation_decide('listing','99000000-dddd-4ddd-8ddd-dddddddddddd','dismissed','Disposable dismissal','pending');
 perform public.moderation_decide('conversation','aa000000-dddd-4ddd-8ddd-dddddddddddd','reviewed','Disposable review without removal','pending');
 if not private.moderator_reported_photo('22000000-2222-4222-8222-222222222222/mod.jpg') then raise exception 'Reported photo permission missing';end if;
 if private.moderator_reported_photo('unreported/no.jpg') then raise exception 'Unreported photo access allowed';end if;
end$$;
reset role;
do $$begin
 if not exists(select 1 from public.listings where id='44000000-dddd-4ddd-8ddd-dddddddddddd' and status='removed' and moderation_removed) then raise exception 'Removal not persisted';end if;
 if not exists(select 1 from public.listings where id='55000000-dddd-4ddd-8ddd-dddddddddddd' and status='available' and not moderation_removed) then raise exception 'Review changed listing';end if;
 if not exists(select 1 from private.moderation_audit where report_id='88000000-dddd-4ddd-8ddd-dddddddddddd' and action='removed_listing' and moderator_id='11000000-1111-4111-8111-111111111111' and note='Disposable removal') then raise exception 'Decision audit missing';end if;
 if not exists(select 1 from private.moderation_audit where report_id='aa000000-dddd-4ddd-8ddd-dddddddddddd' and action='opened_conversation') then raise exception 'Conversation access not audited';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22000000-2222-4222-8222-222222222222","role":"authenticated","session_id":"22000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
do $$begin
 update public.listings set status='available' where id='44000000-dddd-4ddd-8ddd-dddddddddddd';if found then raise exception 'Owner reactivated moderation removal';end if;
 begin update public.listings set moderation_removed=false where id='44000000-dddd-4ddd-8ddd-dddddddddddd';raise exception 'Owner cleared moderation flag';exception when insufficient_privilege then null;end;
 update public.listings set title='Unheld listing still editable' where id='55000000-dddd-4ddd-8ddd-dddddddddddd';if not found then raise exception 'Normal owner edits broken';end if;
end$$;
reset role;
delete from private.moderator_accounts where user_id='11000000-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11000000-1111-4111-8111-111111111111","role":"authenticated","session_id":"11000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
do $$begin if public.is_market_moderator() then raise exception 'Revoked role still active';end if;
 begin perform public.moderation_queue('listing');raise exception 'Revoked operator accessed queue';exception when insufficient_privilege then null;end;
end$$;
reset role;
insert into private.moderator_accounts(user_id,granted_reason) values('11000000-1111-4111-8111-111111111111','Disposable test only');
delete from auth.sessions where user_id='11000000-1111-4111-8111-111111111111';
set local role authenticated;
do $$begin if public.is_market_moderator() then raise exception 'Revoked session still moderator';end if;
 begin perform public.moderation_report('listing','88000000-dddd-4ddd-8ddd-dddddddddddd');raise exception 'Revoked session accessed report';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin begin perform public.moderation_queue('listing');raise exception 'Anonymous moderator access';exception when insufficient_privilege then null;end;end$$;
rollback;
select 'Moderator identity, private queues, audited transcripts/decisions, stale decisions, removal lock, role/session revocation and ordinary owner edits passed' as result;
