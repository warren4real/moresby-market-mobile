import { persistPhoto } from "./photos";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Order, Product, Shop, Conversation, Profile } from "../types";
export type MarketplaceSnapshot = {
  orders: Order[];
  products: Product[];
  saved: number[];
  shop: Shop | null;
  chats?: Conversation[];
  profile?: Profile;
  buyerProfile?: Profile;
  activeProfileId?: string;
  buyerSaved?: number[];
  buyerShop?: Shop | null;
};
// Retain the existing key so installed demos keep their records after this refactor.
const storageKey = "moresby-native-demo-v1";
// Convert every embedded product photo, including historical order/chat copies.
// Only replace the old snapshot after all file writes succeed.
export async function migratePhotos(data: Partial<MarketplaceSnapshot>) {
  const photos = new Map<string, Promise<string>>();
  const product = async (p: Product): Promise<Product> => {
    if (!photos.has(p.image)) photos.set(p.image, persistPhoto(p.image));
    return { ...p, image: await photos.get(p.image)! };
  };
  return {
    ...data,
    ...(data.products && { products: await Promise.all(data.products.map(product)) }),
    ...(data.orders && { orders: await Promise.all(data.orders.map(async o => ({ ...o, product: await product(o.product) }))) }),
    ...(data.chats && { chats: await Promise.all(data.chats.map(async c => ({ ...c, product: await product(c.product) }))) }),
  };
}
export async function loadMarketplace(): Promise<Partial<MarketplaceSnapshot> | null> {
  const raw = await AsyncStorage.getItem(storageKey);
  if (raw === null) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.products)) {
    throw new Error("Invalid marketplace snapshot");
  }
  const migrated = await migratePhotos(parsed);
  const serialized = JSON.stringify(migrated);
  if (serialized !== raw) await AsyncStorage.setItem(storageKey, serialized);
  return migrated;
}
// Serialize saves so an older, slower photo conversion cannot overwrite a newer save.
let pending: Promise<void> = Promise.resolve();
export function saveMarketplace(data: MarketplaceSnapshot): Promise<void> {
  const save = pending.then(async () => {
    const migrated = await migratePhotos(data);
    await AsyncStorage.setItem(storageKey, JSON.stringify(migrated));
  });
  pending = save.catch(() => {});
  return save;
}
