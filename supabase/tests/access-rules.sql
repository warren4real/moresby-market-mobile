-- Disposable fixtures only; all changes are rolled back even on assertions.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','market-rls-a@example.invalid',now(),'{"display_name":"RLS A"}'),
 ('22222222-2222-4222-8222-222222222222','market-rls-b@example.invalid',now(),'{"display_name":"RLS B"}');
insert into auth.sessions(id,user_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.listing_assets(path,owner_id) values
 ('11111111-1111-4111-8111-111111111111/test.jpg','11111111-1111-4111-8111-111111111111'),
 ('11111111-1111-4111-8111-111111111111/replacement.jpg','11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222/foreign.jpg','22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
insert into public.listings(id,owner_id,title,description,price,category,condition,province,area,image_path) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Access test','Disposable test',10,'Other Items','Good','Morobe','Lae','11111111-1111-4111-8111-111111111111/test.jpg');
insert into public.saved_listings values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
do $$ begin
 if (select count(*) from public.saved_listings)<>0 then raise exception 'Saved items leaked';end if;
 if (select count(*) from public.listing_assets where owner_id<>'22222222-2222-4222-8222-222222222222')<>0 then raise exception 'Assets leaked';end if;
 update public.listings set title='Hacked' where id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Other account changed listing';end if;
 update public.listings set image_path='22222222-2222-4222-8222-222222222222/foreign.jpg' where id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Other account replaced photo';end if;
 update public.profiles set display_name='Hacked' where id='11111111-1111-4111-8111-111111111111';
 if found then raise exception 'Other account changed profile';end if;
 begin
 insert into public.saved_listings values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
 raise exception 'Forged owner allowed';exception when insufficient_privilege then null;end;
 begin
 update public.listings set owner_id='22222222-2222-4222-8222-222222222222';
 raise exception 'Owner reassignment allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
do $$ begin
 update public.listings set title='Edited title',description='Edited description',price=200,image_path='11111111-1111-4111-8111-111111111111/replacement.jpg' where id='33333333-3333-4333-8333-333333333333';
 if not found then raise exception 'Owner edit failed';end if;
 if not exists(select 1 from public.listings where id='33333333-3333-4333-8333-333333333333' and title='Edited title' and description='Edited description' and price=200 and image_path='11111111-1111-4111-8111-111111111111/replacement.jpg' and status='available') then raise exception 'Owner edit not persisted';end if;
 begin
 update public.listings set image_path='22222222-2222-4222-8222-222222222222/foreign.jpg' where id='33333333-3333-4333-8333-333333333333';
 raise exception 'Foreign asset linked';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if not exists(select 1 from public.listings where id='33333333-3333-4333-8333-333333333333' and title='Edited title') then raise exception 'Guest could not browse published listing';end if;
 if has_function_privilege('anon','private.active_account()','execute') then raise exception 'Guest has private session helper access';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
update public.listings set status='removed' where id='33333333-3333-4333-8333-333333333333';
reset role;
delete from auth.sessions where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role authenticated;
do $$ begin
 if private.active_account() then raise exception 'Revoked session active';end if;
 update public.profiles set display_name='Revoked write' where id='11111111-1111-4111-8111-111111111111';
 if found then raise exception 'Revoked session wrote';end if;
 update public.listings set title='Revoked edit',image_path='11111111-1111-4111-8111-111111111111/test.jpg' where id='33333333-3333-4333-8333-333333333333';
 if found then raise exception 'Revoked session edited listing';end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 if exists(select 1 from public.listings where id='33333333-3333-4333-8333-333333333333') then raise exception 'Removed listing public';end if;
 begin perform * from public.saved_listings;raise exception 'Anonymous saved access';exception when insufficient_privilege then null;end;
 begin perform public.rls_auto_enable();raise exception 'Helper exposed';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'Owner isolation, private saves/assets, revoked session and removed listing checks passed' as result;
