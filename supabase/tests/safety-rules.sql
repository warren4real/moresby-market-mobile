-- Disposable fixtures only, all rows and deletions roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-1111-4111-8111-111111111111','safety-a@example.invalid',now()),
 ('20000000-2222-4222-8222-222222222222','safety-b@example.invalid',now()),
 ('30000000-3333-4333-8333-333333333333','safety-c@example.invalid',now());
insert into auth.sessions(id,user_id) values
 ('10000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-1111-4111-8111-111111111111'),
 ('20000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-2222-4222-8222-222222222222'),
 ('30000000-cccc-4ccc-8ccc-cccccccccccc','30000000-3333-4333-8333-333333333333');
insert into public.listing_assets(path,owner_id) values
 ('10000000-1111-4111-8111-111111111111/safety.jpg','10000000-1111-4111-8111-111111111111'),
 ('20000000-2222-4222-8222-222222222222/safety.jpg','20000000-2222-4222-8222-222222222222');
insert into public.listings(id,owner_id,title,description,price,category,condition,province,area,image_path) values
 ('10000000-dddd-4ddd-8ddd-dddddddddddd','10000000-1111-4111-8111-111111111111','Safety A','Disposable',1,'Other Items','Good','Morobe','Lae','10000000-1111-4111-8111-111111111111/safety.jpg'),
 ('20000000-dddd-4ddd-8ddd-dddddddddddd','20000000-2222-4222-8222-222222222222','Safety B','Disposable',1,'Other Items','Good','Morobe','Lae','20000000-2222-4222-8222-222222222222/safety.jpg');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-1111-4111-8111-111111111111","role":"authenticated","session_id":"10000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
insert into public.listing_reports(reporter_id,listing_id,reason,details) values('10000000-1111-4111-8111-111111111111','20000000-dddd-4ddd-8ddd-dddddddddddd','Suspected scam','Disposable report');
do $$begin
 if (select count(*) from public.listing_reports)<>1 then raise exception 'Own report invisible';end if;
 begin insert into public.listing_reports(reporter_id,listing_id,reason) values('10000000-1111-4111-8111-111111111111','10000000-dddd-4ddd-8ddd-dddddddddddd','Other');raise exception 'Self report accepted';exception when insufficient_privilege then null;end;
 begin update public.listing_reports set status='reviewed';raise exception 'Reporter changed review status';exception when insufficient_privilege then null;end;
 begin perform public.begin_account_deletion('20000000-2222-4222-8222-222222222222');raise exception 'Client deletion RPC exposed';exception when insufficient_privilege then null;end;
 begin insert into public.account_blocks(blocker_id,blocked_id,blocked_name) values('20000000-2222-4222-8222-222222222222','30000000-3333-4333-8333-333333333333','Forged');raise exception 'Forged blocker accepted';exception when insufficient_privilege then null;end;
end$$;
insert into public.saved_listings values('10000000-1111-4111-8111-111111111111','20000000-dddd-4ddd-8ddd-dddddddddddd');
insert into public.account_blocks(blocker_id,blocked_id,blocked_name) values('10000000-1111-4111-8111-111111111111','20000000-2222-4222-8222-222222222222','Safety B');
do $$begin
 if exists(select 1 from public.listings where id='20000000-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Blocked listing visible to blocker';end if;
 if exists(select 1 from public.saved_listings s join public.listings l on l.id=s.listing_id) then raise exception 'Blocked saved listing visible';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"20000000-2222-4222-8222-222222222222","role":"authenticated","session_id":"20000000-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
do $$begin
 if exists(select 1 from public.listings where id='10000000-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Blocking not two way';end if;
 if exists(select 1 from public.account_blocks) then raise exception 'Other blockers exposed';end if;
 if exists(select 1 from public.listing_reports) then raise exception 'Report leaked to reported seller';end if;
 delete from public.account_blocks where blocked_id=auth.uid();if found then raise exception 'Target removed block';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"30000000-3333-4333-8333-333333333333","role":"authenticated","session_id":"30000000-cccc-4ccc-8ccc-cccccccccccc"}',true);
do $$begin
 if (select count(*) from public.listings where id in ('10000000-dddd-4ddd-8ddd-dddddddddddd','20000000-dddd-4ddd-8ddd-dddddddddddd'))<>2 then raise exception 'Unrelated viewer blocked';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-1111-4111-8111-111111111111","role":"authenticated","session_id":"10000000-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
delete from public.account_blocks where blocker_id=auth.uid();
do $$begin if not exists(select 1 from public.listings where id='20000000-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Unblock did not restore access';end if;end$$;
reset role;
select private.begin_account_deletion('10000000-1111-4111-8111-111111111111');
do $$begin if exists(select 1 from auth.sessions where user_id='10000000-1111-4111-8111-111111111111') then raise exception 'Deletion did not revoke sessions';end if;end$$;
set local role authenticated;
do $$begin
 if private.active_account() then raise exception 'Deleting account still active';end if;
 update public.listings set title='Stale token' where id='10000000-dddd-4ddd-8ddd-dddddddddddd';if found then raise exception 'Deleted session edited';end if;
 begin insert into public.listing_reports(reporter_id,listing_id,reason) values('10000000-1111-4111-8111-111111111111','20000000-dddd-4ddd-8ddd-dddddddddddd','Other');raise exception 'Deleting account reported';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$begin
 if exists(select 1 from public.listings where id='10000000-dddd-4ddd-8ddd-dddddddddddd') then raise exception 'Deleting listing public';end if;
 if exists(select 1 from public.profiles where id='10000000-1111-4111-8111-111111111111') then raise exception 'Deleting profile public';end if;
 begin perform * from public.listing_reports;raise exception 'Anonymous reports visible';exception when insufficient_privilege then null;end;
 begin perform public.finish_account_deletion('10000000-1111-4111-8111-111111111111');raise exception 'Anonymous deletion RPC';exception when insufficient_privilege then null;end;
end$$;
reset role;
delete from auth.users where id='10000000-1111-4111-8111-111111111111';
do $$begin
 if exists(select 1 from public.profiles where id='10000000-1111-4111-8111-111111111111') or exists(select 1 from public.listings where owner_id='10000000-1111-4111-8111-111111111111') or exists(select 1 from public.listing_assets where owner_id='10000000-1111-4111-8111-111111111111') or exists(select 1 from public.saved_listings where user_id='10000000-1111-4111-8111-111111111111') or exists(select 1 from public.listing_reports where reporter_id='10000000-1111-4111-8111-111111111111') then raise exception 'Deleted account data retained';end if;
end$$;
rollback;
select 'Report privacy, two-way blocking, unblock, deletion isolation, session revocation and cascade checks passed' as result;
