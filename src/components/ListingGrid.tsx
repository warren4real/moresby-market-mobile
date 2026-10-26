import React from "react";
import { View } from "react-native";
import type { Product } from "../types";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ui } from "../theme/marketplace";
import { ProductCard } from "./ProductCard";
export function ListingGrid({ products }: { products: Product[] }) {
  const { saved, toggleSaved, showProduct } = useMarketplace();
  return (
    <View style={ui.grid}>
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          saved={saved.includes(p.id)}
          onOpen={showProduct}
          onToggleSaved={() => toggleSaved(p.id)}
        />
      ))}
    </View>
  );
}
