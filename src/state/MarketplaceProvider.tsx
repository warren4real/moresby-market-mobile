import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { SELLER_ID, BUYER_ID, listingOwner, participants, unreadMessages } from "../data/demoProfiles";
import { useSellerDraft } from "./useSellerDraft";
import { Alert } from "react-native";
import type { Product, Order, Shop, Conversation, Profile } from "../types";
import { initialProducts, normaliseProduct } from "../data/sampleProducts";
import { loadMarketplace, saveMarketplace } from "../services/storage";
function useMarketplaceState() {
  const [tab, setTab] = useState("Explore"),
    [category, setCategory] = useState("All finds"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Product | null>(null),
    [method, setMethod] = useState("Shop pickup"),
    [allOrders, setOrders] = useState<Order[]>([]),
    [products, setProducts] = useState(initialProducts.map(normaliseProduct)),
    [sellerSaved, setSellerSaved] = useState<number[]>([]),
    [sellerShop, setSellerShop] = useState<Shop | null>(null),
    [shopName, setShopName] = useState(""),
    [area, setArea] = useState(""),
    [newName, setNewName] = useState(""),
    [price, setPrice] = useState(""),
    [photoUrl, setPhotoUrl] = useState(""),
    [ready, setReady] = useState(false),
    [activeShop, setActiveShop] = useState<string | null>(null);
  const [storageWritable, setStorageWritable] = useState(false);
  const [conditionFilter, setConditionFilter] = useState("All");
  const [sellerFilter, setSellerFilter] = useState("Everyone");
  const [provinceFilter, setProvinceFilter] = useState("All PNG");
  const [localityFilter, setLocalityFilter] = useState("");
  const [propertyType, setPropertyType] = useState("All property");
  const [propertyPurpose, setPropertyPurpose] = useState("Any purpose");
  const [sort, setSort] = useState("Latest");
  const [chats, setChats] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sellerProfile, setSellerProfile] = useState<Profile>({
    name: "Demo Seller",
    area: "Port Moresby",
  });
  const [activeProfileId, setActiveProfileId] = useState(SELLER_ID);
  const [buyerProfile, setBuyerProfile] = useState<Profile>({ name: "Demo Buyer", area: "Port Moresby" });
  const [buyerSaved, setBuyerSaved] = useState<number[]>([]);
  const [buyerShop, setBuyerShop] = useState<Shop | null>(null);
  const profile = activeProfileId === SELLER_ID ? sellerProfile : buyerProfile;
  const setProfile = activeProfileId === SELLER_ID ? setSellerProfile : setBuyerProfile;
  const saved = activeProfileId === SELLER_ID ? sellerSaved : buyerSaved;
  const setSaved = activeProfileId === SELLER_ID ? setSellerSaved : setBuyerSaved;
  const shop = activeProfileId === SELLER_ID ? sellerShop : buyerShop;
  const setShop = activeProfileId === SELLER_ID ? setSellerShop : setBuyerShop;
  const primaryDraft = useSellerDraft(sellerProfile, sellerShop, ready);
  const secondaryDraft = useSellerDraft(buyerProfile, buyerShop, ready);
  const sellerDraft = activeProfileId === SELLER_ID ? primaryDraft : secondaryDraft;
  const isOwnProduct = (p: Product) => listingOwner(p) === activeProfileId;
  const orders = allOrders.filter(o => (o.buyerId || SELLER_ID) === activeProfileId);
  const visibleChats = chats.filter(c => {
    const members = participants(c);
    return members.buyerId === activeProfileId || members.sellerId === activeProfileId;
  });
  const unreadCount = (id: string) => chats.reduce((count, chat) => count + unreadMessages(chat, id), 0);
  const markConversationRead = (id: string) => {
    setChats(current => current.map(c => {
      const members = participants(c);
      if (c.id !== id || (members.buyerId !== activeProfileId && members.sellerId !== activeProfileId)) return c;
      if (c.readCounts?.[activeProfileId] === c.messages.length) return c;
      return { ...c, readCounts: { ...c.readCounts, [activeProfileId]: c.messages.length } };
    }));
  };
  const openConversation = (id: string) => {
    if (!visibleChats.some(c => c.id === id)) return;
    markConversationRead(id);
    setConversationId(id);
    setTab("Chats");
  };
  const profileName = (id: string) => id === SELLER_ID ? sellerProfile.name : buyerProfile.name;
  const switchProfile = (id: string) => {
    if (id !== SELLER_ID && id !== BUYER_ID) return;
    setActiveProfileId(id);
    setSelected(null);
    setConversationId(null);
    setActiveShop(null);
    setCategory("All finds"); setSearch("");
    setConditionFilter("All"); setSellerFilter("Everyone");
    setProvinceFilter("All PNG"); setLocalityFilter("");
    setPropertyType("All property"); setPropertyPurpose("Any purpose");
  };
  useEffect(() => {
    loadMarketplace()
      .then((data) => {
        if (data) {
          if (Array.isArray(data.orders)) setOrders(data.orders);
          if (Array.isArray(data.products))
            setProducts(
              data.products.map((p) =>
                normaliseProduct({
                  ...p,
                  owned: p.owned ?? (!!data.shop && p.shop === data.shop.name),
                }),
              ),
            );
          if (Array.isArray(data.saved)) setSellerSaved(data.saved);
          if (data.shop) setSellerShop(data.shop);
          if (Array.isArray(data.chats)) setChats(data.chats);
          if (data.profile) setSellerProfile({ ...data.profile, name: data.profile.name === "Your profile" ? "Demo Seller" : data.profile.name });
          if (data.buyerProfile) setBuyerProfile(data.buyerProfile);
          if (Array.isArray(data.buyerSaved)) setBuyerSaved(data.buyerSaved);
          if (data.buyerShop) setBuyerShop(data.buyerShop);
          if (data.activeProfileId === BUYER_ID) setActiveProfileId(BUYER_ID);
        }
        setStorageWritable(true);
      })
      .catch(() =>
        Alert.alert("Local storage", "Your saved demo could not be loaded. Saving is paused to protect existing records. Restart the app to retry; changes made now will not be saved."),
      )
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready && storageWritable)
      saveMarketplace({ orders: allOrders, products, saved: sellerSaved, shop: sellerShop, chats, profile: sellerProfile, buyerProfile, buyerSaved, buyerShop, activeProfileId }).catch(
        () =>
          Alert.alert(
            "Storage full",
            "Your latest demo changes could not be saved.",
          ),
      );
  }, [allOrders, products, sellerSaved, sellerShop, chats, sellerProfile, buyerProfile, buyerSaved, buyerShop, activeProfileId, ready, storageWritable]);
  const request = () => {
    if (!selected) return;
    const currentProduct = products.find(p => p.id === selected.id);
    if (!currentProduct || currentProduct.stock < 1) {
      Alert.alert("Unavailable", "This listing is no longer available.");
      setSelected(currentProduct || null);
      return;
    }
    if (isOwnProduct(currentProduct)) return;
    setOrders((current) => [
      {
        id: Date.now().toString(),
        buyerId: activeProfileId,
        product: currentProduct,
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
      (provinceFilter === "All PNG" || p.province === provinceFilter) &&
      p.area.toLowerCase().includes(localityFilter.trim().toLowerCase()) &&
      (category !== "Property" || ((propertyType === "All property" || p.property?.type === propertyType) && (propertyPurpose === "Any purpose" || p.property?.purpose === propertyPurpose))) &&
      (category === "All finds" || p.category === category) &&
      `${p.name} ${p.shop} ${p.area}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!activeShop || p.shop === activeShop) &&
      (category === "Property" || conditionFilter === "All" ||
        (p.category !== "Property" && !p.property &&
          (conditionFilter === "Second-hand"
            ? p.condition !== "New"
            : p.condition === "New"))) &&
      (sellerFilter === "Everyone" ||
        (sellerFilter === "Individuals"
          ? p.sellerType === "Individual"
          : p.sellerType !== "Individual")),
  );
  if (sort === "Price: low to high") filtered.sort((a, b) => a.price - b.price);
  else if (sort === "Price: high to low")
    filtered.sort((a, b) => b.price - a.price);
  else
    filtered.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );
  const toggleSaved = (id: number) =>
    setSaved((current) =>
      current.includes(id) ? current.filter((n) => n !== id) : [...current, id],
    );
  const openChat = (product: Product) => {
    const current = products.find(p => p.id === product.id);
    if (!current || isOwnProduct(current)) return;
    const sellerId = listingOwner(current);
    const existing = chats.find(c => c.product.id === current.id && participants(c).buyerId === activeProfileId && participants(c).sellerId === sellerId);
    const id = existing?.id || `chat-${current.id}-${activeProfileId}-${sellerId}`;
    if (!existing) setChats(all => [{ id, product: current, buyerId: activeProfileId, sellerId, messages: [] }, ...all]);
    if (existing) markConversationRead(id);
    setConversationId(id); setSelected(null); setTab("Chats");
  };
  const sendMessage = (id: string, text: string) => {
    if (!text.trim()) return;
    setChats(current => current.map(c => {
      const members = participants(c);
      if (c.id !== id || (members.buyerId !== activeProfileId && members.sellerId !== activeProfileId)) return c;
      return { ...c, ...members, messages: [...c.messages, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text: text.trim(), createdAt: new Date().toISOString(), senderId: activeProfileId,
      }] };
    }));
  };
  const showProduct = (p: Product) => {
    const current = products.find(product => product.id === p.id);
    if (!current) {
      Alert.alert("Listing unavailable", "This listing is no longer in the marketplace.");
      return;
    }
    setMethod(current.handovers?.[0] || "Shop pickup");
    setSelected(current);
  };

  const openSeller = (name: string) => {
    setActiveShop(name);
    setSearch("");
    setCategory("All finds");
    setProvinceFilter("All PNG");
    setLocalityFilter("");
    setConditionFilter("All");
    setSellerFilter("Everyone");
    setPropertyType("All property");
    setPropertyPurpose("Any purpose");
    setSelected(null);
    setTab("Explore");
  };
  return {
    sellerDraft, openSeller, activeProfileId, switchProfile, isOwnProduct, profileName,
    visibleChats, unreadCount, markConversationRead, openConversation,
    provinceFilter, setProvinceFilter, localityFilter, setLocalityFilter, propertyType, setPropertyType, propertyPurpose, setPropertyPurpose,
    conditionFilter,
    setConditionFilter,
    sellerFilter,
    setSellerFilter,
    sort,
    setSort,
    chats,
    setChats,
    conversationId,
    setConversationId,
    profile,
    setProfile,
    toggleSaved,
    openChat,
    sendMessage,
    tab,
    setTab,
    category,
    setCategory,
    search,
    setSearch,
    selected,
    setSelected,
    method,
    setMethod,
    orders,
    setOrders,
    products,
    setProducts,
    saved,
    setSaved,
    shop,
    setShop,
    shopName,
    setShopName,
    area,
    setArea,
    newName,
    setNewName,
    price,
    setPrice,
    photoUrl,
    setPhotoUrl,
    ready,
    activeShop,
    setActiveShop,
    request,
    advance,
    cancel,
    filtered,
    showProduct,
  };
}
const MarketplaceContext = createContext<ReturnType<
  typeof useMarketplaceState
> | null>(null);
export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const market = useMarketplaceState();
  return (
    <MarketplaceContext.Provider value={market}>
      {children}
    </MarketplaceContext.Provider>
  );
}
export function useMarketplace() {
  const market = useContext(MarketplaceContext);
  if (!market)
    throw new Error("useMarketplace must be inside MarketplaceProvider");
  return market;
}
