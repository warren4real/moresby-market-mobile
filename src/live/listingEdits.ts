import type { LiveListing } from "./listings";
export function listingEditPayload(
  listing: LiveListing,
  title: string,
  description: string,
  price: string,
) {
  const amount = Number(price);
  if (
    !title.trim() ||
    title.trim().length > 100 ||
    !description.trim() ||
    description.trim().length > 2000 ||
    !price.trim() ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 9999999999.99
  )
    throw Error("Enter a title, description and valid price in kina.");
  return {
    id: listing.id,
    title: title.trim(),
    description: description.trim(),
    price: amount,
    before: {
      title: listing.title,
      description: listing.description,
      price: Number(listing.price),
      image_path: listing.image_path,
    },
  };
}
