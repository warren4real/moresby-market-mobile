import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ui } from "../theme/marketplace";
import { Icon, type IconName } from "../components/Icon";
import { Button } from "../components/Button";
import { ListingGrid } from "../components/ListingGrid";
export function MeScreen() {
  const { profile, setProfile, products, orders, saved, setTab, shop, isOwnProduct } =
    useMarketplace();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(profile.name),
    [area, setArea] = useState(profile.area);
  const own = products.filter(isOwnProduct);
  return (
    <>
      <View style={ui.notice}><Text style={ui.noticeText}>Two demo profiles share this iPhone. Create a listing as Seller, switch to Buyer above, open the listing and tap Chat. Switch back to Seller, open Chats and reply. These are local demo profiles, not registered accounts.</Text></View>
      <Text style={ui.eyebrow}>YOUR CORNER OF THE MARKET</Text>
      <View style={[ui.row, { marginTop: 22, marginBottom: 20 }]}>
        <View style={ui.profileAvatar}>
          <Text style={{ fontSize: 26, color: "#23583f" }}>
            {profile.name[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ui.title, { fontSize: 23 }]}>{profile.name}</Text>
          <Text style={ui.small}>{profile.area} · Demo profile</Text>
        </View>
        <Pressable
          accessibilityLabel="Edit profile"
          onPress={() => {
            setName(profile.name);
            setArea(profile.area);
            setEditing(!editing);
          }}
        >
          <Icon name="create-outline" />
        </Pressable>
      </View>
      {editing && (
        <View style={ui.panel}>
          <Text style={ui.fieldLabel}>Display name</Text>
          <TextInput
            accessibilityLabel="Display name"
            style={ui.input}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
          <Text style={ui.fieldLabel}>Suburb</Text>
          <TextInput
            accessibilityLabel="Profile suburb"
            style={ui.input}
            value={area}
            onChangeText={setArea}
            maxLength={60}
          />
          <View style={{ height: 15 }} />
          <Button
            title="Save demo profile"
            disabled={!name.trim() || !area.trim()}
            onPress={() => {
              setProfile({ name: name.trim(), area: area.trim() });
              setEditing(false);
            }}
          />
        </View>
      )}
      <View style={[ui.spread, ui.panel]}>
        {[
          [own.length, "Listings"],
          [saved.length, "Saved"],
          [orders.length, "Orders"],
        ].map(([n, label]) => (
          <View key={label} style={{ alignItems: "center" }}>
            <Text style={ui.section}>{n}</Text>
            <Text style={ui.small}>{label}</Text>
          </View>
        ))}
      </View>
      {[
        ["receipt-outline", "My orders", "Orders"],
        ["storefront-outline", "Local shops & companies", "Shops"],
        ["add-circle-outline", "Sell an item", "Sell"],
      ].map(([icon, label, target]) => (
        <Pressable
          accessibilityRole="button"
          key={target}
          style={ui.menuRow}
          onPress={() => setTab(target)}
        >
          <Icon name={icon as IconName} />
          <Text style={ui.menuText}>{label}</Text>
          <Icon name="chevron-forward" size={16} />
        </Pressable>
      ))}
      <View style={[ui.spread, { marginTop: 27, marginBottom: 20 }]}>
        <Text style={ui.section}>My listings</Text>
        <Text style={ui.small}>{own.length} items</Text>
      </View>
      {own.length ? (
        <ListingGrid products={own} />
      ) : (
        <View style={ui.empty}>
          <Text style={ui.section}>Your next chapter starts here.</Text>
          <Text style={ui.emptyText}>
            Sell one item, or open a shop for your business.
          </Text>
          <Pressable onPress={() => setTab("Sell")}>
            <Text style={ui.link}>Create your first listing →</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
