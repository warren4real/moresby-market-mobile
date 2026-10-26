import React from "react";
import { View, Text, Pressable } from "react-native";
import { useMarketplace } from "../state/MarketplaceProvider";
import { demoProfiles } from "../data/demoProfiles";
import { UnreadBadge } from "./UnreadBadge";
import { ui } from "../theme/marketplace";
export function DemoProfileSwitcher() {
 const { activeProfileId, switchProfile, profileName, ready, unreadCount } = useMarketplace();
 return <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: "#f5f7f3" }}>
  <Text style={ui.small}>ON-DEVICE DEMO · Switch who you are</Text>
  <View style={[ui.row, { marginTop: 6 }]}>{demoProfiles.map(p => <Pressable key={p.id} disabled={!ready} accessibilityRole="button" accessibilityLabel={`Use demo ${p.label.toLowerCase()} profile`} accessibilityState={{ selected: p.id === activeProfileId }} onPress={() => switchProfile(p.id)} style={[ui.choice, { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }, p.id === activeProfileId && ui.choiceActive]}><Text style={ui.choiceText}>{p.id === activeProfileId ? "✓ " : ""}{p.label}: {profileName(p.id)}</Text><UnreadBadge count={unreadCount(p.id)} /></Pressable>)}</View>
 </View>;
}
