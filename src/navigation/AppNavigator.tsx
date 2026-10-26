import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ui, palette } from "../theme/marketplace";
import { Icon, type IconName } from "../components/Icon";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { SavedScreen } from "../screens/SavedScreen";
import { SellerScreen } from "../screens/SellerScreen";
import { ChatsScreen } from "../screens/ChatsScreen";
import { MeScreen } from "../screens/MeScreen";
import { ShopsScreen } from "../screens/ShopsScreen";
import { OrdersScreen } from "../screens/OrdersScreen";
import { UnreadBadge } from "../components/UnreadBadge";
import { DemoProfileSwitcher } from "../components/DemoProfileSwitcher";
import { ProductScreen } from "../screens/ProductScreen";
const tabs: [string, IconName, IconName][] = [
  ["Explore", "search-outline", "search"],
  ["Saved", "heart-outline", "heart"],
  ["Sell", "add", "add"],
  ["Chats", "chatbubble-outline", "chatbubble"],
  ["Me", "person-outline", "person"],
];
export function AppNavigator() {
  const { tab, setTab, activeProfileId, unreadCount } = useMarketplace();
  const active =
    tab === "Discover"
      ? "Explore"
      : ["Orders", "Shops", "Your shop"].includes(tab)
        ? "Me"
        : tab;
  return (
    <SafeAreaView style={ui.page} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <View style={ui.preview}>
        <Text style={ui.previewText}>
          PORT MORESBY PREVIEW · SAMPLE LISTINGS
        </Text>
      </View>
      <View style={ui.masthead}>
        <View style={ui.spread}>
          <Pressable
            onPress={() => setTab("Explore")}
            accessibilityRole="button"
            accessibilityLabel="Marketplace home"
          >
            <Text style={ui.brand}>
              moresby<Text style={{ fontWeight: "400" }}>market</Text>
              <Text style={{ color: "#c79d4c" }}> ✦</Text>
            </Text>
          </Pressable>
          <View style={[ui.row, { gap: 3 }]}>
            <Icon name="location-outline" size={12} color={palette.muted} />
            <Text style={ui.pin}>Port Moresby</Text>
          </View>
        </View>
      </View>
      <DemoProfileSwitcher />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          key={`${tab}:${activeProfileId}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ui.content}
        >
          {(tab === "Explore" || tab === "Discover") && <DiscoverScreen />}
          {tab === "Saved" && <SavedScreen />}
          {(tab === "Sell" || tab === "Your shop") && <SellerScreen />}
          {tab === "Chats" && <ChatsScreen />}
          {tab === "Me" && <MeScreen />}
          {tab === "Shops" && (
            <>
              <Pressable onPress={() => setTab("Me")}>
                <Text style={[ui.link, { marginBottom: 20 }]}>
                  ← Back to me
                </Text>
              </Pressable>
              <ShopsScreen />
            </>
          )}
          {tab === "Orders" && (
            <>
              <Pressable onPress={() => setTab("Me")}>
                <Text style={[ui.link, { marginBottom: 20 }]}>
                  ← Back to me
                </Text>
              </Pressable>
              <OrdersScreen />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={ui.tabs}>
        {tabs.map(([label, outline, filled]) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityLabel={label === "Chats" && unreadCount(activeProfileId) ? `Chats, ${unreadCount(activeProfileId)} unread messages` : label}
            accessibilityState={{ selected: active === label }}
            onPress={() => setTab(label)}
            style={ui.tab}
          >
            {label === "Chats" && <View style={{ position: "absolute", top: -4, right: "20%", zIndex: 1 }}><UnreadBadge count={unreadCount(activeProfileId)} /></View>}
            {label === "Sell" ? (
              <View style={ui.sellIcon}>
                <Icon name="add" size={27} color="white" />
              </View>
            ) : (
              <Icon
                name={active === label ? filled : outline}
                size={22}
                color={active === label ? palette.green : "#919b91"}
              />
            )}
            <Text
              style={[
                ui.tabText,
                active === label && { color: palette.green, fontWeight: "700" },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ProductScreen />
    </SafeAreaView>
  );
}
