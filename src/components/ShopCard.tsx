import React from "react";
import { Pressable, Text, View } from "react-native";
import type { Product } from "../types";
import { styles as s } from "../theme";
export function ShopCard({
  name,
  index: i,
  products,
  onOpen,
}: {
  name: string;
  index: number;
  products: Product[];
  onOpen: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={s.shopRow}>
      <View
        style={[
          s.avatar,
          {
            backgroundColor: ["#e6dec9", "#dce8dc", "#e9ded5"][i % 3],
          },
        ]}
      >
        <Text style={s.avatarText}>
          {name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.shopName}>{name}</Text>
        <Text style={s.small}>
          {products.find((p) => p.shop === name)?.area} ·{" "}
          {products.filter((p) => p.shop === name).length} products
        </Text>
      </View>
      <Text style={s.link}>↗</Text>
    </Pressable>
  );
}
