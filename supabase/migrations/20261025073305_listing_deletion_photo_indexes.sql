create index if not exists listing_assets_owner on public.listing_assets(owner_id);
create index if not exists listings_image_path on public.listings(image_path);
create index if not exists saved_listings_listing on public.saved_listings(listing_id);
create index listing_deletions_original_photo on private.listing_deletions(original_photo);
create index listing_deletions_evidence_photo on private.listing_deletions((evidence->>'image_path')) where evidence is not null;
create or replace function private.deleted_listing_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.listing_deletions d where d.original_photo=p_path or
 d.listing_id=case when p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-' then left(split_part(p_path,'/',2),36)::uuid end and d.owner_id::text=split_part(p_path,'/',1))
 and not exists(select 1 from public.listings l where l.image_path=p_path and l.permanently_deleted_at is null);
$$;