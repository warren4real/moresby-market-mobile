-- Private progress marker makes deletion fail closed across cleanup retries.
create table private.account_deletions (
 user_id uuid primary key, requested_at timestamptz not null default now(), completed_at timestamptz
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated;

create table public.account_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 blocked_name text not null check(char_length(blocked_name) between 1 and 60),
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
create index account_blocks_target on public.account_blocks(blocked_id);
alter table public.account_blocks enable row level security;
revoke all on public.account_blocks from public,anon,authenticated;
grant select,insert,delete on public.account_blocks to authenticated;
create policy blocks_read on public.account_blocks for select to authenticated using(blocker_id=auth.uid() and private.active_account());
create policy blocks_insert on public.account_blocks for insert to authenticated with check(blocker_id=auth.uid() and private.active_account());
create policy blocks_delete on public.account_blocks for delete to authenticated using(blocker_id=auth.uid() and private.active_account());

-- No arbitrary viewer ID: only the verified caller is used for block checks.
create function private.seller_visible(seller uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.account_deletions d where d.user_id=seller)
 and not exists(select 1 from public.account_blocks b where
 (b.blocker_id=auth.uid() and b.blocked_id=seller) or (b.blocker_id=seller and b.blocked_id=auth.uid()));
$$;
revoke all on function private.seller_visible(uuid) from public;
grant usage on schema private to anon;
grant execute on function private.seller_visible(uuid) to anon,authenticated;
create or replace function private.active_account() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and not exists(select 1 from private.account_deletions d where d.user_id=auth.uid())
 and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
 where u.id=auth.uid() and u.email_confirmed_at is not null
 and s.id=nullif(auth.jwt()->>'session_id','')::uuid and (s.not_after is null or s.not_after>now()));
$$;
alter policy profile_read on public.profiles using(private.seller_visible(id));
alter policy listing_read on public.listings using((status<>'removed' or owner_id=auth.uid()) and private.seller_visible(owner_id));

create table public.listing_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 listing_id uuid not null references public.listings(id) on delete cascade,
 reason text not null check(reason in ('Suspected scam','Prohibited item','Offensive content','Misleading listing','Other')),
 details text not null default '' check(char_length(details)<=1000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),
 unique(reporter_id,listing_id)
);
create index listing_reports_listing on public.listing_reports(listing_id);
alter table public.listing_reports enable row level security;
revoke all on public.listing_reports from public,anon,authenticated;
grant select on public.listing_reports to authenticated;
grant insert(reporter_id,listing_id,reason,details) on public.listing_reports to authenticated;
create policy reports_read on public.listing_reports for select to authenticated using(reporter_id=auth.uid() and private.active_account());
create policy reports_insert on public.listing_reports for insert to authenticated with check(reporter_id=auth.uid() and private.active_account() and exists(select 1 from public.listings l where l.id=listing_id and l.owner_id<>auth.uid() and l.status<>'removed'));
create function private.report_limit() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text,0));
 if (select count(*) from public.listing_reports where reporter_id=new.reporter_id and created_at>now()-interval '1 day')>=30 then raise exception 'Daily report limit reached';end if;
 return new;
end;$$;
revoke all on function private.report_limit() from public;
create trigger limit_reports before insert on public.listing_reports for each row execute function private.report_limit();

-- Service-only deletion transaction. Public wrapper is invoker, never a public
-- SECURITY DEFINER endpoint; password reauthentication happens in the Edge handler.
create function private.begin_account_deletion(target uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into private.account_deletions(user_id) values(target) on conflict do nothing;
 delete from auth.sessions where user_id=target;
end;$$;
revoke all on function private.begin_account_deletion(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.begin_account_deletion(uuid) to service_role;
create function public.begin_account_deletion(target uuid) returns void language sql security invoker set search_path='' as $$select private.begin_account_deletion(target);$$;
revoke all on function public.begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;
create function private.finish_account_deletion(target uuid) returns void language sql security definer set search_path='' as $$update private.account_deletions set completed_at=now() where user_id=target;$$;
revoke all on function private.finish_account_deletion(uuid) from public,anon,authenticated;
grant execute on function private.finish_account_deletion(uuid) to service_role;
create function public.finish_account_deletion(target uuid) returns void language sql security invoker set search_path='' as $$select private.finish_account_deletion(target);$$;
revoke all on function public.finish_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.finish_account_deletion(uuid) to service_role;
