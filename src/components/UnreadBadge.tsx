import React from "react";
import { View, Text } from "react-native";
export function UnreadBadge({ count }: { count: number }) {
 if (!count) return null;
 return <View accessibilityLabel={`${count} unread messages`} style={{ backgroundColor: "#b83737", borderRadius: 12, minWidth: 20, height: 20, paddingHorizontal: 6, alignSelf: "center", flexShrink: 0, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{count > 99 ? "99+" : count}</Text></View>;
}
