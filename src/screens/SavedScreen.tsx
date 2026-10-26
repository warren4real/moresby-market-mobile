import React from "react";
import { Pressable, Text, View } from "react-native";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ui } from "../theme/marketplace";
import { ListingGrid } from "../components/ListingGrid";
import { Icon } from "../components/Icon";
export function SavedScreen() {
  const { products, saved, setTab } = useMarketplace();
  const finds = products.filter((p) => saved.includes(p.id));
  return (
    <>
      <Text style={ui.eyebrow}>KEEP THE GOOD FINDS</Text>
      <Text style={ui.title}>Your saved items</Text>
      <Text style={ui.subtitle}>A little collection of things you love.</Text>
      {finds.length ? (
        <ListingGrid products={finds} />
      ) : (
        <View style={ui.empty}>
          <Icon name="heart-outline" size={38} />
          <Text style={ui.section}>Found something you like?</Text>
          <Text style={ui.emptyText}>
            Tap the heart on a listing to keep it here.
          </Text>
          <Pressable onPress={() => setTab("Explore")}>
            <Text style={ui.link}>Explore the market →</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
