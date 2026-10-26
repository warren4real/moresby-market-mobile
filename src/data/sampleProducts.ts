import { marketplaceCategories, migrateCategory } from "./categories";
import type { Product } from "../types";
const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=700&q=80`;
export const initialProducts: Product[] = [
  {
    id: 1,
    name: "Everyday woven bag",
    price: 65,
    category: "Fashion",
    shop: "Island Threads",
    area: "Boroko",
    image: image("photo-1590874103328-eac38a683ce7"),
    stock: 12,
  },
  {
    id: 2,
    name: "Wireless headphones",
    price: 120,
    category: "Electronics",
    shop: "Island Threads",
    area: "Boroko",
    image: image("photo-1505740420928-5e560c06d30e"),
    stock: 8,
  },
  {
    id: 3,
    name: "Stoneware coffee mug",
    price: 35,
    category: "Home",
    shop: "The Home Edit",
    area: "Gordons",
    image: image("photo-1514228742587-6b1558fcca3d"),
    stock: 18,
  },
  {
    id: 4,
    name: "Everyday sneakers",
    price: 145,
    category: "Fashion",
    shop: "Island Threads",
    area: "Boroko",
    image: image("photo-1549298916-b41d501d3772"),
    stock: 6,
  },
  {
    id: 5,
    name: "Notebook essentials",
    price: 28,
    category: "Stationery",
    shop: "Made in Moresby",
    area: "Waigani",
    image: image("photo-1531346878377-a5be20888e57"),
    stock: 20,
  },
  {
    id: 6,
    name: "Minimal table lamp",
    price: 95,
    category: "Home",
    shop: "The Home Edit",
    area: "Gordons",
    image: image("photo-1507473885765-e6ed057f782c"),
    stock: 7,
  },
];
export const categories = [
  "All finds",
  ...marketplaceCategories.map((c) => c.name),
];
export function normaliseProduct(p: Product): Product {
  const sample = initialProducts.find((sample) => sample.id === p.id);
  return {
    ...p,
    category: migrateCategory(p.category),
    ownerId: p.ownerId || "demo-seller",
    province: p.province || "National Capital District",
    condition: p.category === "Property" || p.property
      ? undefined
      : p.condition || (p.id === 2 || p.id === 4 ? "Like new" : "New"),
    sellerType:
      p.sellerType || (p.id === 2 || p.id === 4 ? "Individual" : "SME"),
    negotiable: p.negotiable ?? (p.id === 2 || p.id === 4),
    description:
      p.description ||
      (sample
        ? "Illustrative sample listing for this marketplace preview. Confirm details, condition and any faults with the seller."
        : "Ask the seller for more details about this item."),
    handovers: p.handovers || ["Shop pickup", "Public meetup"],
  };
}
