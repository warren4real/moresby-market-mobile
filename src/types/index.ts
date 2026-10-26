export type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  shop: string;
  area: string;
  image: string;
  stock: number;
  condition?: "New" | "Like new" | "Good" | "Fair";
  sellerType?: "Individual" | "SME" | "Company";
  description?: string;
  negotiable?: boolean;
  createdAt?: string;
  owned?: boolean;
  ownerId?: string;
  handovers?: string[];
  province?: string;
  property?: {
    type: string;
    purpose: string;
    pricePeriod: "Total" | "Per month" | "Per week";
    bedrooms?: number;
    size?: number;
  };
};
export type Order = {
  id: string;
  buyerId?: string;
  product: Product;
  method: string;
  status: "Requested" | "Confirmed" | "Completed" | "Cancelled";
};
export type Shop = { name: string; area: string };

export type Message = { id: string; text: string; createdAt: string; senderId?: string };
export type Conversation = {
  id: string;
  buyerId?: string;
  sellerId?: string;
  product: Product;
  messages: Message[];
  readCounts?: Record<string, number>;
};
export type Profile = { name: string; area: string };
