import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import type { Product } from "../types";
import { ui, palette } from "../theme/marketplace";
import { money } from "../utils/format";
import { Icon } from "./Icon";
export function ProductCard({
  product: p,
  saved,
  onOpen,
  onToggleSaved,
}: {
  product: Product;
  saved: boolean;
  onOpen: (p: Product) => void;
  onToggleSaved: () => void;
}) {
  return (
    <View style={ui.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${p.name}`}
        onPress={() => onOpen(p)}
      >
        <View style={ui.photoBox}>
          <Image source={{ uri: p.image }} style={ui.photo} />
          <View style={ui.photoTag}>
            <Text style={ui.photoTagText}>
              {p.stock < 1 ? (p.property ? "Unavailable" : "Sold") : p.property?.purpose || p.condition || "New"}
            </Text>
          </View>
        </View>
      </Pressable>
      <View
        style={[ui.row, { alignItems: "flex-start", marginTop: 9, gap: 4 }]}
      >
        <Pressable style={{ flex: 1 }} onPress={() => onOpen(p)}>
          <Text style={ui.listingTitle} numberOfLines={2}>
            {p.name}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${saved ? "Unsave" : "Save"} ${p.name}`}
          hitSlop={10}
          onPress={onToggleSaved}
        >
          <Icon
            name={saved ? "heart" : "heart-outline"}
            size={19}
            color={saved ? palette.green : "#8a918b"}
          />
        </Pressable>
      </View>
      <View style={[ui.row, { gap: 5, marginTop: 5, flexWrap: "wrap" }]}>
        <Text style={ui.price}>{money(p.price)}{p.property?.pricePeriod === "Per month" ? " / month" : p.property?.pricePeriod === "Per week" ? " / week" : ""}</Text>
        {p.negotiable && <Text style={ui.condition}>Negotiable</Text>}
      </View>
      <View style={ui.sellerRow}>
        <View style={ui.miniAvatar}>
          <Text style={ui.miniAvatarText}>{p.shop[0]?.toUpperCase()}</Text>
        </View>
        <Text style={ui.sellerName} numberOfLines={1}>
          {p.shop}
        </Text>
        {p.sellerType !== "Individual" && (
          <Text style={ui.badge}>
            {p.sellerType === "Company" ? "Company" : "Shop"}
          </Text>
        )}
      </View>
      <View style={[ui.row, { gap: 3, marginTop: 4 }]}>
        <Icon name="location-outline" size={10} color={palette.muted} />
        <Text style={ui.small}>{[p.area, p.province].filter(Boolean).join(", ")}</Text>
      </View>
    </View>
  );
}
