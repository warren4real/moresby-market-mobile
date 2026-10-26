import React from "react";
import { Text } from "react-native";
import { styles as s } from "../theme";

import { useMarketplace } from "../state/MarketplaceProvider";
import { ShopCard } from "../components/ShopCard";
export function ShopsScreen() {
  const { products, openSeller } =
    useMarketplace();
  return (
    <>
      <Text style={s.eyebrow}>A LITTLE LOCAL GOES A LONG WAY</Text>
      <Text style={s.pageTitle}>Meet your local shops.</Text>
      <Text style={s.subtitle}>
        Sample shops to explore the mobile experience.
      </Text>
      {Array.from(new Set(products.map((p) => p.shop))).map((name, i) => (
        <ShopCard
          key={name}
          name={name}
          index={i}
          products={products}
          onOpen={() => openSeller(name)}
        />
      ))}
    </>
  );
}
