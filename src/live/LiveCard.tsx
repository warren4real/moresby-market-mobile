import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Icon } from "../components/Icon";
import { palette, ui } from "../theme/marketplace";
import { livePrice, type LiveListing } from "./listings";
export function LiveCard({
  listing: p,
  saved,
  onOpen,
  onSave,
  disabled,
}: {
  listing: LiveListing;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  const seller = p.seller?.display_name || "Local seller";
  return (
    <View style={ui.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${p.title}`}
        onPress={onOpen}
      >
        <View style={ui.photoBox}>
          {p.imageUrl ? (
            <Image source={{ uri: p.imageUrl }} style={ui.photo} />
          ) : (
            <View
              style={[
                ui.photo,
                { alignItems: "center", justifyContent: "center" },
              ]}
            >
              <Icon name="image-outline" color={palette.muted} />
            </View>
          )}
          <View style={ui.photoTag}>
            <Text style={ui.photoTagText}>
              {p.status === "removed"
                ? "Removed"
                : p.status !== "available"
                  ? "Unavailable"
                  : p.purpose || p.condition}
            </Text>
          </View>
        </View>
      </Pressable>
      <View
        style={[ui.row, { alignItems: "flex-start", marginTop: 9, gap: 4 }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onOpen}>
          <Text style={ui.listingTitle} numberOfLines={2}>
            {p.title}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${saved ? "Unsave" : "Save"} ${p.title}`}
          disabled={disabled}
          hitSlop={10}
          onPress={onSave}
        >
          <Icon
            name={saved ? "heart" : "heart-outline"}
            size={19}
            color={saved ? palette.green : "#8a918b"}
          />
        </Pressable>
      </View>
      <View style={[ui.row, { gap: 5, marginTop: 5, flexWrap: "wrap" }]}>
        <Text style={ui.price}>{livePrice(p)}</Text>
        {p.negotiable && <Text style={ui.condition}>Negotiable</Text>}
      </View>
      <View style={ui.sellerRow}>
        <View style={ui.miniAvatar}>
          <Text style={ui.miniAvatarText}>{seller[0]?.toUpperCase()}</Text>
        </View>
        <Text style={ui.sellerName} numberOfLines={1}>
          {seller}
        </Text>
        {p.seller?.seller_type && p.seller.seller_type !== "Individual" && (
          <Text style={ui.badge}>
            {p.seller.seller_type === "Company" ? "Company" : "Shop"}
          </Text>
        )}
      </View>
      <View style={[ui.row, { gap: 3, marginTop: 4 }]}>
        <Icon name="location-outline" size={10} color={palette.muted} />
        <Text style={ui.small}>
          {p.area}, {p.province}
        </Text>
      </View>
    </View>
  );
}
