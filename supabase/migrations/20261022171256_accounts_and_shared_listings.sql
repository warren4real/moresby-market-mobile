create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
-- Restricted helper needs Auth tables not granted to mobile users. It accepts no
-- user IDs: identity and session come only from the verified JWT.
create function private.active_account() returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
   select 1 from auth.users u join auth.sessions s on s.user_id=u.id
   where u.id=auth.uid() and u.email_confirmed_at is not null
   and s.id=nullif(auth.jwt()->>'session_id','')::uuid
   and (s.not_after is null or s.not_after > now())
 );
$$;
revoke all on function private.active_account() from public;
grant execute on function private.active_account() to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(char_length(trim(display_name)) between 1 and 60),
 province text not null default 'National Capital District' check(char_length(province) between 1 and 80),
 area text not null default 'Port Moresby' check(char_length(trim(area)) between 1 and 80),
 seller_type text not null default 'Individual' check(seller_type in ('Individual','SME','Company'))
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update(display_name,province,area,seller_type) on public.profiles to authenticated;
create policy profile_read on public.profiles for select to anon,authenticated using (true);
create policy profile_edit on public.profiles for update to authenticated using(id=auth.uid() and private.active_account()) with check(id=auth.uid() and private.active_account());
create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),60),''),'Member'));
 return new;
end; $$;
revoke all on function private.create_profile() from public;
create trigger create_market_profile after insert on auth.users for each row execute function private.create_profile();

create table public.listing_assets (
 path text primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 check(path like owner_id::text || '/%')
);
alter table public.listing_assets enable row level security;
revoke all on public.listing_assets from anon, authenticated;
grant select on public.listing_assets to authenticated;
create policy asset_owner_read on public.listing_assets for select to authenticated using(owner_id=auth.uid() and private.active_account());

create table public.listings (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 100),
 description text not null check(char_length(trim(description)) between 1 and 2000),
 price numeric(12,2) not null check(price>=0 and price<=9999999999.99),
 category text not null check(category in ('Property','Phones & Electronics','Fashion & Personal Care','Home & Living','Tools & Equipment','Local Crafts & Gifts','Other Items')),
 condition text check(condition in ('New','Like new','Good','Fair')),
 province text not null check(char_length(trim(province)) between 1 and 80),
 area text not null check(char_length(trim(area)) between 1 and 80),
 image_path text not null references public.listing_assets(path),
 negotiable boolean not null default false,
 handovers text[] not null default array['Public meetup'] check(cardinality(handovers) between 1 and 2 and handovers <@ array['Public meetup','Pickup','Arrange a viewing']),
 property_type text check(property_type in ('Rooms','Apartments & Houses','Buildings & Commercial Spaces','Land & Lots')),
 purpose text check(purpose in ('For sale','For rent','For lease')),
 price_period text not null default 'Total' check(price_period in ('Total','Per month','Per week')),
 bedrooms integer check(bedrooms>=0 and bedrooms<=1000),
 size_sqm numeric check(size_sqm>0 and size_sqm<=1000000000),
 status text not null default 'available' check(status in ('available','unavailable','removed')),
 created_at timestamptz not null default now(),
 constraint property_shape check (
 (category='Property' and condition is null and property_type is not null and purpose is not null and
 (property_type<>'Rooms' or purpose='For rent') and
 ((purpose='For sale' and price_period='Total') or (purpose in ('For rent','For lease') and price_period in ('Per month','Per week'))) and
 (property_type<>'Land & Lots' or bedrooms is null))
 or (category<>'Property' and condition is not null and property_type is null and purpose is null and price_period='Total' and bedrooms is null and size_sqm is null))
);
create index listing_recent on public.listings(created_at desc,id desc);
create index listing_owner on public.listings(owner_id);
create index listing_region on public.listings(province,category,created_at desc);
alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon,authenticated;
grant insert on public.listings to authenticated;
grant update(title,description,price,negotiable,status) on public.listings to authenticated;
create policy listing_read on public.listings for select to anon,authenticated using(status<>'removed' or owner_id=auth.uid());
create policy listing_create on public.listings for insert to authenticated with check (
 owner_id=auth.uid() and private.active_account() and status='available'
 and exists(select 1 from public.listing_assets a where a.path=image_path and a.owner_id=auth.uid())
);
create policy listing_edit on public.listings for update to authenticated using(owner_id=auth.uid() and private.active_account()) with check(owner_id=auth.uid() and private.active_account());
create function private.listing_limit() returns trigger language plpgsql set search_path='' as $$
begin
 if (select count(*) from public.listings where owner_id=new.owner_id and created_at>now()-interval '1 day')>=20 then
 raise exception 'Daily listing limit reached'; end if;
 return new;
end; $$;
revoke all on function private.listing_limit() from public;
create trigger limit_listing_inserts before insert on public.listings for each row execute function private.listing_limit();

create table public.saved_listings (
 user_id uuid not null references auth.users(id) on delete cascade,
 listing_id uuid not null references public.listings(id) on delete cascade,
 primary key(user_id,listing_id)
);
alter table public.saved_listings enable row level security;
revoke all on public.saved_listings from anon,authenticated;
grant select,insert,delete on public.saved_listings to authenticated;
create policy saved_read on public.saved_listings for select to authenticated using(user_id=auth.uid() and private.active_account());
create policy saved_add on public.saved_listings for insert to authenticated with check(user_id=auth.uid() and private.active_account() and exists(select 1 from public.listings where id=listing_id and status<>'removed'));
create policy saved_remove on public.saved_listings for delete to authenticated using(user_id=auth.uid() and private.active_account());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('market-listing-images','market-listing-images',false,1048576,array['image/jpeg']);
-- Only the validated server photo pipeline can write objects. URL creation is
-- permitted for published photos, and owners retain access to their own photos.
create policy market_photo_read on storage.objects for select to anon,authenticated using (
 bucket_id='market-listing-images' and (
 exists(select 1 from public.listings l where l.image_path=name and l.status<>'removed')
 or (auth.uid() is not null and name like auth.uid()::text || '/%')
 )
);
