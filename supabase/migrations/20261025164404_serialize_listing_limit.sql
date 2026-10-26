-- Serialize the rolling listing count per owner so concurrent publications
-- cannot all pass the limit before any of them commits.
create or replace function private.listing_limit() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,5));
 if (select count(*) from public.listings where owner_id=new.owner_id and created_at>now()-interval '1 day')>=20 then
  raise exception 'Daily listing limit reached'; end if;
 return new;
end; $$;
revoke all on function private.listing_limit() from public;
