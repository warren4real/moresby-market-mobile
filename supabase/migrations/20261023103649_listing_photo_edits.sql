-- Only validated assets belonging to the current owner can replace a photo.
grant update(image_path) on public.listings to authenticated;
alter policy listing_edit on public.listings
using (owner_id=auth.uid() and private.active_account())
with check (owner_id=auth.uid() and private.active_account()
 and exists(select 1 from public.listing_assets a where a.path=image_path and a.owner_id=auth.uid()));
