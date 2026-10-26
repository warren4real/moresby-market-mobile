import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { ListingModal } from "../components/ListingModal";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ui, palette } from "../theme/marketplace";
import { Icon } from "../components/Icon";
import { Button } from "../components/Button";
import { money } from "../utils/format";
export function ProductScreen() {
  const {
    isOwnProduct,
    selected,
    setSelected,
    setProducts,
    method,
    setMethod,
    saved,
    toggleSaved,
    request,
    openChat,
    openSeller,
    setCategory,
    setSearch,
    setTab,
  } = useMarketplace();
  return (
    <ListingModal
      visible={!!selected}
      onClose={() => setSelected(null)}
      right={
        <Pressable
          accessibilityLabel="Save this listing"
          accessibilityRole="button"
          style={[ui.iconButton, { minWidth: 48, minHeight: 48 }]}
          onPress={() => selected && toggleSaved(selected.id)}
        >
          <Icon
            name={
              selected && saved.includes(selected.id)
                ? "heart"
                : "heart-outline"
            }
          />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={ui.content}>
        {selected && (
          <>
            <Image source={{ uri: selected.image }} style={ui.detailPhoto} />
            <View style={ui.spread}>
              <Text style={ui.eyebrow}>{selected.category}</Text>
              <Text style={ui.badge}>
                {selected.stock < 1
                  ? "Unavailable"
                  : selected.property?.purpose || selected.condition || "New"}
              </Text>
            </View>
            <Text style={ui.title}>{selected.name}</Text>
            <View style={ui.row}>
              <Text style={ui.detailPrice}>
                {money(selected.price)}
                {selected.property?.pricePeriod === "Per month"
                  ? " / month"
                  : selected.property?.pricePeriod === "Per week"
                    ? " / week"
                    : ""}
              </Text>
              {selected.negotiable && (
                <Text style={ui.small}>Open to offers</Text>
              )}
            </View>
            <View style={[ui.row, { marginTop: 10 }]}>
              <Icon name="location-outline" size={15} color={palette.muted} />
              <Text style={ui.small}>
                {[selected.area, selected.province].filter(Boolean).join(", ")}
              </Text>
            </View>
            <Pressable
              style={[ui.panel, ui.row]}
              onPress={() => {
                openSeller(selected.shop);
              }}
            >
              <View style={[ui.profileAvatar, { width: 42, height: 42 }]}>
                <Text style={ui.section}>{selected.shop[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ui.listingTitle}>{selected.shop}</Text>
                <Text style={ui.small}>
                  {selected.sellerType || "Individual"} seller · View listings
                </Text>
              </View>
              <Icon name="chevron-forward" size={17} />
            </Pressable>
            {selected.property && (
              <View style={ui.panel}>
                <Text style={ui.section}>{selected.property.type}</Text>
                <Text style={ui.subtitle}>
                  {selected.property.purpose}
                  {selected.property.bedrooms !== undefined
                    ? ` · ${selected.property.bedrooms} bedrooms`
                    : ""}
                  {selected.property.size
                    ? ` · ${selected.property.size} m²`
                    : ""}
                </Text>
              </View>
            )}
            <Text style={ui.section}>
              {selected.property ? "About this property" : "About this item"}
            </Text>
            <Text style={[ui.subtitle, { marginTop: 10 }]}>
              {selected.description}
            </Text>
            {!selected.property && (
              <>
                <Text style={ui.section}>Handover options</Text>
                <Text style={[ui.small, { marginTop: 6, marginBottom: 12 }]}>
                  Confirm a time and place with the seller.
                </Text>
                {(selected.handovers || ["Shop pickup", "Public meetup"]).map(
                  (m) => (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: method === m }}
                      key={m}
                      onPress={() => setMethod(m)}
                      style={[
                        ui.choice,
                        ui.row,
                        { marginBottom: 8 },
                        method === m && ui.choiceActive,
                      ]}
                    >
                      <Icon
                        name={
                          method === m ? "radio-button-on" : "radio-button-off"
                        }
                        size={18}
                      />
                      <Text style={ui.choiceText}>
                        {m === "Shop pickup" ? "Pickup" : m}
                      </Text>
                    </Pressable>
                  ),
                )}
              </>
            )}
            <View style={ui.notice}>
              <Text style={ui.noticeText}>
                {selected.property
                  ? "Enquire to arrange a viewing. No booking, payment or property agreement is made here."
                  : "Pay at handover. Online payments are not connected."}{" "}
                This is a local preview: orders and chats are saved on your
                device only.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      {selected &&
        (isOwnProduct(selected) ? (
          <View style={ui.detailBar}>
            <View style={{ flex: 1 }}>
              <Button
                title={
                  selected.stock > 0
                    ? selected.property
                      ? "Mark unavailable"
                      : "Mark item sold"
                    : "Make item available"
                }
                onPress={() => {
                  const stock = selected.stock > 0 ? 0 : 1;
                  setProducts((current) =>
                    current.map((p) =>
                      p.id === selected.id ? { ...p, stock } : p,
                    ),
                  );
                  setSelected({ ...selected, stock });
                }}
              />
            </View>
          </View>
        ) : (
          <View style={ui.detailBar}>
            <View style={{ flex: 1 }}>
              <Button
                title="Chat"
                secondary
                onPress={() => openChat(selected)}
              />
            </View>
            <View style={{ flex: 1.6 }}>
              <Button
                title={
                  selected.stock > 0
                    ? selected.property
                      ? "Enquire / viewing"
                      : "Request item"
                    : "Unavailable"
                }
                disabled={selected.stock < 1}
                onPress={() =>
                  selected.property ? openChat(selected) : request()
                }
              />
            </View>
          </View>
        ))}
    </ListingModal>
  );
}
