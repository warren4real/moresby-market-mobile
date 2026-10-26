-- Verified fixtures only; every inserted record is rolled back.
begin;
set local statement_timeout='15s';
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('61111111-1111-4111-8111-111111111111','listing-limit-check@example.invalid',now(),'{"display_name":"Listing limit fixture"}');
insert into auth.sessions(id,user_id) values
 ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','61111111-1111-4111-8111-111111111111');
insert into public.listing_assets(path,owner_id) values
 ('61111111-1111-4111-8111-111111111111/limit-test.jpg','61111111-1111-4111-8111-111111111111');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"61111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
do $$
declare i integer; lock_key bigint:=hashtextextended('61111111-1111-4111-8111-111111111111',5);
begin
 for i in 1..20 loop
  insert into public.listings(owner_id,title,description,price,category,condition,province,area,image_path)
  values('61111111-1111-4111-8111-111111111111','Limit fixture '||i,'Disposable test',1,'Other Items','Good','Morobe','Lae','61111111-1111-4111-8111-111111111111/limit-test.jpg');
 end loop;
 if (select count(*) from public.listings where owner_id='61111111-1111-4111-8111-111111111111')<>20 then raise exception '20 valid inserts did not succeed'; end if;
 if not exists(select 1 from pg_locks where locktype='advisory' and pid=pg_backend_pid() and granted and mode='ExclusiveLock' and objsubid=1 and classid=((lock_key >> 32) & 4294967295)::oid and objid=(lock_key & 4294967295)::oid) then raise exception 'Owner transaction lock was not held by trigger'; end if;
 begin
  insert into public.listings(owner_id,title,description,price,category,condition,province,area,image_path)
  values('61111111-1111-4111-8111-111111111111','Over limit','Disposable test',1,'Other Items','Good','Morobe','Lae','61111111-1111-4111-8111-111111111111/limit-test.jpg');
  raise exception '21st listing incorrectly accepted';
 exception when raise_exception then
  if sqlerrm<>'Daily listing limit reached' then raise; end if;
 end;
end $$;
rollback;
select '20 allowed, 21st rejected, expected owner lock held; fixtures rolled back' as result;
