import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  shop: string;
  area: string;
  image: string;
  stock: number;
};
type Order = {
  id: string;
  product: Product;
  method: string;
  status: "Requested" | "Confirmed" | "Completed" | "Cancelled";
};
type Shop = { name: string; area: string };
const green = "#23583f";
const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=700&q=80`;
const initialProducts: Product[] = [
  {
    id: 1,
    name: "Everyday woven bag",
    price: 65,
    category: "Fashion",
    shop: "Island Threads",
    area: "Boroko",
    image: image("photo-1590874103328-eac38a683ce7"),
    stock: 12,
  },
  {
    id: 2,
    name: "Wireless headphones",
    price: 120,
    category: "Electronics",
    shop: "Island Threads",
    area: "Boroko",
    image: image("photo-1505740420928-5e560c06d30e"),
    stock: 8,
  },
  {
    id: 3,
    name: "Stoneware coffee mug",
    price: 35,
    category: "Home",
    shop: "The Home Edit",
    area: "Gordons",
    image: image("photo-1514228742587-6b1558fcca3d"),
    stock: 18,
  },
  {
    id: 4,
    name: "Everyday sneakers",
    price: 145,
    category: "Fashion",
    shop: "Island Threads",
    area: "Boroko",
    image: image("photo-1549298916-b41d501d3772"),
    stock: 6,
  },
  {
    id: 5,
    name: "Notebook essentials",
    price: 28,
    category: "Stationery",
    shop: "Made in Moresby",
    area: "Waigani",
    image: image("photo-1531346878377-a5be20888e57"),
    stock: 20,
  },
  {
    id: 6,
    name: "Minimal table lamp",
    price: 95,
    category: "Home",
    shop: "The Home Edit",
    area: "Gordons",
    image: image("photo-1507473885765-e6ed057f782c"),
    stock: 7,
  },
];
const categories = [
  "All finds",
  "Fashion",
  "Electronics",
  "Home",
  "Stationery",
];
const money = (n: number) => `K ${n.toFixed(2)}`;
const storageKey = "moresby-native-demo-v1";
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, disabled && { opacity: 0.4 }]}
    >
      <Text style={[s.buttonText, secondary && { color: green }]}>{title}</Text>
    </Pressable>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Market />
    </SafeAreaProvider>
  );
}
function Market() {
  const [tab, setTab] = useState("Discover"),
    [category, setCategory] = useState("All finds"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Product | null>(null),
    [method, setMethod] = useState("Shop pickup"),
    [orders, setOrders] = useState<Order[]>([]),
    [products, setProducts] = useState(initialProducts),
    [saved, setSaved] = useState<number[]>([]),
    [shop, setShop] = useState<Shop | null>(null),
    [shopName, setShopName] = useState(""),
    [area, setArea] = useState(""),
    [newName, setNewName] = useState(""),
    [price, setPrice] = useState(""),
    [photoUrl, setPhotoUrl] = useState(""),
    [ready, setReady] = useState(false),
    [activeShop, setActiveShop] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data.orders)) setOrders(data.orders);
          if (Array.isArray(data.products)) setProducts(data.products);
          if (Array.isArray(data.saved)) setSaved(data.saved);
          if (data.shop) setShop(data.shop);
        }
      })
      .catch(() =>
        Alert.alert("Local storage", "Your saved demo could not be loaded."),
      )
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready)
      AsyncStorage.setItem(
        storageKey,
        JSON.stringify({ orders, products, saved, shop }),
      ).catch(() =>
        Alert.alert(
          "Storage full",
          "Your latest demo changes could not be saved.",
        ),
      );
  }, [orders, products, saved, shop, ready]);
  const request = () => {
    if (!selected) return;
    setOrders((current) => [
      {
        id: Date.now().toString(),
        product: selected,
        method,
        status: "Requested",
      },
      ...current,
    ]);
    setSelected(null);
    setTab("Orders");
    Alert.alert(
      "Demo request created",
      "This request is saved on this device only. No seller has been contacted and no payment has been taken.",
    );
  };
  const advance = (order: Order) => {
    if (order.status === "Requested") {
      const p = products.find((p) => p.id === order.product.id);
      if (!p || p.stock < 1) {
        Alert.alert(
          "Unavailable",
          "There is not enough stock to confirm this request.",
        );
        return;
      }
      setProducts((current) =>
        current.map((p) =>
          p.id === order.product.id ? { ...p, stock: p.stock - 1 } : p,
        ),
      );
    }
    setOrders((current) =>
      current.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: order.status === "Requested" ? "Confirmed" : "Completed",
            }
          : o,
      ),
    );
  };
  const cancel = (order: Order) => {
    if (order.status === "Confirmed")
      setProducts((current) =>
        current.map((p) =>
          p.id === order.product.id ? { ...p, stock: p.stock + 1 } : p,
        ),
      );
    setOrders((current) =>
      current.map((o) =>
        o.id === order.id ? { ...o, status: "Cancelled" } : o,
      ),
    );
  };
  const filtered = products.filter(
    (p) =>
      (category === "All finds" || p.category === category) &&
      `${p.name} ${p.shop} ${p.area}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!activeShop || p.shop === activeShop),
  );
  const showProduct = (p: Product) => {
    setMethod("Shop pickup");
    setSelected(p);
  };
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.demo}>
        <Text style={s.demoText}>
          LOCAL PREVIEW · SAMPLE SHOPS · NO REAL PAYMENTS
        </Text>
      </View>
      <View style={s.header}>
        <View style={s.logo}>
          <Text style={s.logoText}>m</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.wordmark}>
            moresby<Text style={{ fontWeight: "400" }}>market</Text>
          </Text>
          <Text style={s.location}>Port Moresby, PNG</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View orders"
          onPress={() => setTab("Orders")}
          style={s.orderBadge}
        >
          <Text style={{ color: green, fontWeight: "700" }}>
            {orders.length}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {tab === "Discover" && (
          <>
            <View style={s.searchBox}>
              <TextInput
                accessibilityLabel="Search products and shops"
                placeholder="Search products, shops, local finds…"
                placeholderTextColor="#7b857d"
                value={search}
                onChangeText={setSearch}
                style={s.search}
              />
            </View>
            {!search && !activeShop && (
              <View style={s.hero}>
                <Text style={s.eyebrow}>YOUR CITY. YOUR SHOPS.</Text>
                <Text style={s.heroTitle}>
                  Good finds.{"\n"}
                  <Text style={{ color: "#6b8865" }}>Closer to home.</Text>
                </Text>
                <Text style={s.heroBody}>
                  Discover something you love from shops around Port Moresby.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTab("Shops")}
                >
                  <Text style={s.heroLink}>Meet the local shops ↗</Text>
                </Pressable>
                <Image
                  source={{ uri: initialProducts[0].image }}
                  style={s.heroImage}
                />
              </View>
            )}
            {activeShop && (
              <View style={s.shopCover}>
                <Pressable onPress={() => setActiveShop(null)}>
                  <Text style={s.link}>← All products</Text>
                </Pressable>
                <Text style={s.heading}>{activeShop}</Text>
                <Text style={s.small}>
                  Sample shop · Pickup and meetup by agreement
                </Text>
              </View>
            )}
            <View style={s.sectionHeader}>
              <Text style={s.heading}>
                {search ? "Search results" : "Find your favourite"}
              </Text>
              <Text style={s.small}>{filtered.length} finds</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 18 }}
            >
              {categories.map((c) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: c === category }}
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[s.chip, c === category && s.activeChip]}
                >
                  <Text
                    style={[s.chipText, c === category && { color: "white" }]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={s.grid}>
              {filtered.map((p) => (
                <View key={p.id} style={s.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${p.name}`}
                    onPress={() => showProduct(p)}
                  >
                    <Image source={{ uri: p.image }} style={s.productImage} />
                    <View style={s.cardBody}>
                      <Text style={s.small}>{p.shop}</Text>
                      <Text style={s.productName}>{p.name}</Text>
                      <Text style={s.price}>{money(p.price)}</Text>
                      <Text style={s.small}>
                        ⌖ {p.area} ·{" "}
                        {p.stock > 0 ? "Pickup available" : "Out of stock"}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Save ${p.name}`}
                    onPress={() =>
                      setSaved((current) =>
                        current.includes(p.id)
                          ? current.filter((id) => id !== p.id)
                          : [...current, p.id],
                      )
                    }
                    style={s.heart}
                  >
                    <Text style={{ fontSize: 20, color: green }}>
                      {saved.includes(p.id) ? "♥" : "♡"}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
            {!filtered.length && (
              <Text style={s.empty}>
                No matching products. Try another search or category.
              </Text>
            )}
            <View style={s.note}>
              <Text style={s.noteText}>
                Shop pickup or an agreed public meetup. Seller delivery is
                arranged directly; fees must be confirmed before ordering.
              </Text>
            </View>
          </>
        )}
        {tab === "Shops" && (
          <>
            <Text style={s.eyebrow}>A LITTLE LOCAL GOES A LONG WAY</Text>
            <Text style={s.pageTitle}>Meet your local shops.</Text>
            <Text style={s.subtitle}>
              Sample shops to explore the mobile experience.
            </Text>
            {Array.from(new Set(products.map((p) => p.shop))).map((name, i) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                onPress={() => {
                  setActiveShop(name);
                  setCategory("All finds");
                  setSearch("");
                  setTab("Discover");
                }}
                style={s.shopRow}
              >
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
            ))}
          </>
        )}
        {tab === "Orders" && (
          <>
            <Text style={s.pageTitle}>Your local finds.</Text>
            <Text style={s.subtitle}>From order request to handover.</Text>
            <View style={s.note}>
              <Text style={s.noteText}>
                Demo controls simulate both buyer and seller. No messages,
                deliveries or payments are sent.
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
                  <Image
                    source={{ uri: o.product.image }}
                    style={s.orderImage}
                  />
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
        )}
        {tab === "Your shop" && (
          <>
            <Text style={s.eyebrow}>SELL LOCAL. GROW LOCAL.</Text>
            <Text style={s.pageTitle}>
              {shop ? `Hello, ${shop.name}.` : "Give your shop a home."}
            </Text>
            <Text style={s.subtitle}>
              Your demo shop stays on this device. Real registration and
              identity checks come later.
            </Text>
            {!shop ? (
              <>
                <Text style={s.label}>Shop name</Text>
                <TextInput
                  style={s.input}
                  value={shopName}
                  onChangeText={setShopName}
                  maxLength={60}
                  placeholder="Your shop name"
                />
                <Text style={s.label}>Port Moresby suburb</Text>
                <TextInput
                  style={s.input}
                  value={area}
                  onChangeText={setArea}
                  maxLength={60}
                  placeholder="e.g. Boroko"
                />
                <Button
                  title="Create demo shop →"
                  onPress={() => {
                    if (!shopName.trim() || !area.trim()) {
                      Alert.alert(
                        "A little more detail",
                        "Please enter your shop name and suburb.",
                      );
                      return;
                    }
                    setShop({ name: shopName.trim(), area: area.trim() });
                  }}
                />
              </>
            ) : (
              <>
                <View style={s.shopCover}>
                  <Text style={s.heading}>
                    {products.filter((p) => p.shop === shop.name).length}{" "}
                    products
                  </Text>
                  <Text style={s.small}>
                    ⌖ {shop.area} · Your sample storefront
                  </Text>
                </View>
                <Text style={s.heading}>Add your first finds</Text>
                <Text style={s.label}>Product name</Text>
                <TextInput
                  style={s.input}
                  value={newName}
                  onChangeText={setNewName}
                  maxLength={100}
                  placeholder="What are you selling?"
                />
                <Text style={s.label}>Price in kina</Text>
                <TextInput
                  style={s.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="65.00"
                />
                <Text style={s.label}>Product photo URL (optional)</Text>
                <TextInput
                  style={s.input}
                  value={photoUrl}
                  onChangeText={setPhotoUrl}
                  autoCapitalize="none"
                  placeholder="https://…"
                />
                <Text style={s.small}>
                  No photo? An illustrative sample photo will be used. New
                  products start with 1 demo unit in stock.
                </Text>
                <View style={{ height: 16 }} />
                <Button
                  title="Add demo product"
                  onPress={() => {
                    const amount = Number(price);
                    if (
                      !newName.trim() ||
                      !Number.isFinite(amount) ||
                      amount <= 0
                    ) {
                      Alert.alert(
                        "Check your product",
                        "Enter a name and a price greater than zero.",
                      );
                      return;
                    }
                    if (photoUrl && !/^https:\/\//i.test(photoUrl)) {
                      Alert.alert(
                        "Photo link",
                        "Use a public HTTPS image URL.",
                      );
                      return;
                    }
                    setProducts((current) => [
                      {
                        id: Date.now(),
                        name: newName.trim(),
                        price: amount,
                        category: "Fashion",
                        shop: shop.name,
                        area: shop.area,
                        image: photoUrl || initialProducts[0].image,
                        stock: 1,
                      },
                      ...current,
                    ]);
                    setNewName("");
                    setPrice("");
                    setPhotoUrl("");
                    Alert.alert(
                      "Product added",
                      "Your sample listing is now visible in Discover.",
                    );
                  }}
                />
                {products
                  .filter((p) => p.shop === shop.name)
                  .map((p) => (
                    <View key={p.id} style={s.shopRow}>
                      <Image source={{ uri: p.image }} style={s.orderImage} />
                      <View>
                        <Text style={s.productName}>{p.name}</Text>
                        <Text style={s.small}>
                          {money(p.price)} · {p.stock} in stock
                        </Text>
                      </View>
                    </View>
                  ))}
              </>
            )}
          </>
        )}
      </ScrollView>
      <View style={s.tabs}>
        {[
          ["Discover", "⌂"],
          ["Shops", "▦"],
          ["Orders", "▤"],
          ["Your shop", "♧"],
        ].map(([name, icon]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === name }}
            accessibilityLabel={name}
            key={name}
            onPress={() => setTab(name)}
            style={s.tab}
          >
            <Text style={[s.tabIcon, tab === name && { color: green }]}>
              {icon}
            </Text>
            <Text
              style={[
                s.tabText,
                tab === name && { color: green, fontWeight: "700" },
              ]}
            >
              {name}
            </Text>
            {tab === name && <View style={s.tabDot} />}
          </Pressable>
        ))}
      </View>
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={s.content}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelected(null)}
              >
                <Text style={s.link}>← Back to the market</Text>
              </Pressable>
              {selected && (
                <>
                  <Image
                    source={{ uri: selected.image }}
                    style={s.detailImage}
                  />
                  <Text style={s.eyebrow}>
                    {selected.shop} · {selected.area}
                  </Text>
                  <Text style={s.pageTitle}>{selected.name}</Text>
                  <Text style={[s.price, { fontSize: 29 }]}>
                    {money(selected.price)}
                  </Text>
                  <Text style={s.subtitle}>
                    Illustrative sample product. Confirm size, material,
                    condition and availability with the seller before a real
                    purchase.
                  </Text>
                  <Text style={s.label}>Choose your handover</Text>
                  {["Shop pickup", "Public meetup", "Seller delivery"].map(
                    (m) => (
                      <Pressable
                        key={m}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: method === m }}
                        onPress={() => setMethod(m)}
                        style={[
                          s.method,
                          method === m && {
                            borderColor: green,
                            backgroundColor: "#eaf1e7",
                          },
                        ]}
                      >
                        <Text style={{ color: green, fontWeight: "600" }}>
                          {method === m ? "●" : "○"} {m}
                        </Text>
                      </Pressable>
                    ),
                  )}
                  <View style={s.note}>
                    <Text style={s.noteText}>
                      Pay at handover. Online wallets are not connected.
                      Delivery availability and any fee must be agreed with the
                      seller; the displayed price excludes delivery.
                    </Text>
                  </View>
                  <Button
                    disabled={selected.stock < 1}
                    title={
                      selected.stock > 0
                        ? "Create demo order request →"
                        : "Out of stock"
                    }
                    onPress={request}
                  />
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fafbf7" },
  demo: {
    backgroundColor: "#203b31",
    paddingVertical: 8,
    alignItems: "center",
  },
  demoText: { color: "#e3ece1", fontSize: 8, letterSpacing: 1 },
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderColor: "#e4e8e1",
  },
  logo: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: green,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "white", fontSize: 31, fontWeight: "800", lineHeight: 35 },
  wordmark: {
    color: "#203b31",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -1,
  },
  location: { color: "#7b857d", fontSize: 11, marginTop: 3 },
  orderBadge: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: "#eaf1e7",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, paddingBottom: 35 },
  searchBox: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dfe5db",
    borderRadius: 12,
    marginBottom: 20,
  },
  search: { padding: 15, fontSize: 13, color: "#203b31" },
  hero: {
    backgroundColor: "#e8eee3",
    borderRadius: 20,
    padding: 24,
    overflow: "hidden",
    minHeight: 265,
    marginBottom: 27,
  },
  eyebrow: {
    color: green,
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: "700",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -1.7,
    color: "#203b31",
    maxWidth: 280,
    zIndex: 1,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 20,
    color: "#617365",
    maxWidth: 200,
    marginTop: 13,
    zIndex: 1,
  },
  heroLink: {
    fontSize: 12,
    color: green,
    fontWeight: "700",
    marginTop: 20,
    zIndex: 1,
  },
  heroImage: {
    position: "absolute",
    width: 115,
    height: 125,
    right: -25,
    bottom: 8,
    borderRadius: 10,
    transform: [{ rotate: "-13deg" }],
    opacity: 0.55,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#203b31",
    letterSpacing: -0.5,
  },
  small: { fontSize: 11, lineHeight: 18, color: "#7b857d" },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#dfe5db",
    backgroundColor: "white",
    marginRight: 8,
  },
  activeChip: { backgroundColor: green, borderColor: green },
  chipText: { fontSize: 12, color: green },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  card: {
    width: "47.7%",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e4e8e1",
    borderRadius: 14,
    overflow: "hidden",
  },
  productImage: { width: "100%", aspectRatio: 1, backgroundColor: "#e8eee3" },
  cardBody: { padding: 12 },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#203b31",
    lineHeight: 20,
    marginVertical: 5,
  },
  price: { fontSize: 20, fontWeight: "700", color: green, marginVertical: 7 },
  heart: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    padding: 15,
    backgroundColor: "#eaf1e7",
    borderRadius: 12,
    marginVertical: 20,
  },
  noteText: { fontSize: 11, lineHeight: 18, color: "#50654f" },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#e4e8e1",
    paddingTop: 12,
    paddingBottom: 5,
    backgroundColor: "white",
  },
  tab: { flex: 1, alignItems: "center", gap: 4 },
  tabIcon: { fontSize: 24, color: "#97a18f" },
  tabText: { fontSize: 10, color: "#87917f" },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: green,
    marginTop: 2,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "700",
    letterSpacing: -1,
    color: "#203b31",
    marginVertical: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#71806d",
    lineHeight: 21,
    marginBottom: 20,
  },
  shopRow: {
    padding: 18,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e4e8e1",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
  },
  avatar: {
    height: 50,
    width: 50,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: green },
  shopName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#203b31",
    marginBottom: 4,
  },
  link: { color: green, fontSize: 13, fontWeight: "600", paddingVertical: 8 },
  empty: { textAlign: "center", color: "#71806d", padding: 30 },
  emptyBox: {
    padding: 22,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#c8d5be",
    borderRadius: 14,
    marginTop: 20,
  },
  button: {
    backgroundColor: green,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 11,
    alignItems: "center",
  },
  buttonText: { color: "white", fontSize: 13, fontWeight: "700" },
  secondary: { backgroundColor: "#eaf1e7" },
  orderCard: {
    backgroundColor: "white",
    padding: 17,
    borderWidth: 1,
    borderColor: "#e4e8e1",
    borderRadius: 14,
    marginTop: 15,
  },
  orderTop: {
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  orderImage: { width: 65, height: 65, borderRadius: 10 },
  status: { fontSize: 9, letterSpacing: 1, color: green, fontWeight: "700" },
  label: {
    fontSize: 12,
    color: green,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ced8c8",
    borderRadius: 10,
    backgroundColor: "white",
    color: "#203b31",
    marginBottom: 16,
  },
  shopCover: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#e8eee3",
    marginBottom: 22,
  },
  detailImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
    marginVertical: 20,
  },
  method: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#dce4d7",
    borderRadius: 10,
    marginBottom: 10,
  },
});
