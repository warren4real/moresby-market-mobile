import { getSupabaseClient } from "../services/supabase";
export type LiveProfile = {
  id: string;
  display_name: string;
  province: string;
  area: string;
  seller_type: string;
};
export type LiveListing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string | null;
  province: string;
  area: string;
  image_path: string;
  negotiable: boolean;
  status: string;
  moderation_removed?: boolean;
  permanently_deleted_at?: string | null;
  deletion_cleanup_pending?: boolean;
  property_type: string | null;
  purpose: string | null;
  price_period: string;
  bedrooms: number | null;
  size_sqm: number | null;
  handovers: string[];
  created_at: string;
  imageUrl?: string;
  seller?: Pick<LiveProfile, "display_name" | "seller_type">;
};
export async function listingImages(
  rows: LiveListing[],
): Promise<LiveListing[]> {
  const paths = rows.map((r) => r.image_path).filter(Boolean);
  if (!paths.length) return rows;
  const result = await getSupabaseClient()
    .storage.from("market-listing-images")
    .createSignedUrls(paths, 600);
  if (result.error) throw result.error;
  const signed = new Map(
    result.data.map((item, index) => [paths[index], item.signedUrl]),
  );
  return rows.map((row) => ({
    ...row,
    imageUrl: signed.get(row.image_path) || undefined,
  }));
}
export function livePrice(row: LiveListing) {
  return `K ${Number(row.price).toFixed(2)}${row.price_period === "Per month" ? " / month" : row.price_period === "Per week" ? " / week" : ""}`;
}
