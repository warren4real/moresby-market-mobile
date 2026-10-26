-- Guests must not evaluate the signed-in-only active_account helper.
-- Keep the existing authenticated rule, including owner cleanup visibility.
alter policy listing_read on public.listings to authenticated;
create policy listing_public_read on public.listings for select to anon
using (permanently_deleted_at is null and status <> 'removed' and private.seller_visible(owner_id));
