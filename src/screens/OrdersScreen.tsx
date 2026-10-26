import React from "react";
import { Image, Text, View } from "react-native";
import { styles as s } from "../theme";
import { money } from "../utils/format";

import { Button } from "../components/Button";
import { useMarketplace } from "../state/MarketplaceProvider";
export function OrdersScreen() {
  const {
    setTab,
    method,
    orders,
    products,
    shop,
    price,
    request,
    advance,
    cancel,
  } = useMarketplace();
  return (
    <>
      <Text style={s.pageTitle}>Your local finds.</Text>
      <Text style={s.subtitle}>From order request to handover.</Text>
      <View style={s.note}>
        <Text style={s.noteText}>
          Demo controls simulate both buyer and seller. No messages, deliveries
          or payments are sent.
        </Text>
      </View>
      {!orders.length && (
        <View style={s.emptyBox}>
          <Text style={s.heading}>Your first find is waiting.</Text>
          <Text style={s.subtitle}>
            Explore the market and request an item.
          </Text>
          <Button
            title="Explore products →"
            onPress={() => setTab("Discover")}
          />
        </View>
      )}
      {orders.map((o) => (
        <View key={o.id} style={s.orderCard}>
          <View style={s.orderTop}>
            <Image source={{ uri: o.product.image }} style={s.orderImage} />
            <View style={{ flex: 1 }}>
              <Text style={s.status}>{o.status.toUpperCase()}</Text>
              <Text style={s.productName}>{o.product.name}</Text>
              <Text style={s.price}>{money(o.product.price)}</Text>
            </View>
          </View>
          <Text style={s.small}>{o.method} · Pay at handover</Text>
          <Text style={s.small}>
            Order MM-{o.id.slice(-6)} · {o.product.shop}
          </Text>
          {(o.status === "Requested" || o.status === "Confirmed") && (
            <View style={{ gap: 8, marginTop: 15 }}>
              <Button
                title={
                  o.status === "Requested"
                    ? "Seller confirms (demo)"
                    : "Confirm paid & collected (demo)"
                }
                onPress={() => advance(o)}
              />
              <Button
                title="Cancel demo order"
                secondary
                onPress={() => cancel(o)}
              />
            </View>
          )}
        </View>
      ))}
    </>
  );
}
