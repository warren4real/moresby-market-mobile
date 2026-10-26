import {
  deletionConfirmation,
  deleteListingPermanently,
} from "./permanentDeletion";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabaseClient } from "../services/supabase";
import { useAuth } from "./AuthProvider";
import { Button } from "../components/Button";
import { ChoiceField } from "../components/ChoiceField";
import { ProvinceField } from "../components/ProvinceField";
import { Icon, type IconName } from "../components/Icon";
import { ui, palette } from "../theme/marketplace";
import {
  listingImages,
  livePrice,
  type LiveListing,
  type LiveProfile,
} from "./listings";
import { ModerationDashboard } from "./ModerationDashboard";
import { useModerator } from "./useModerator";
import { UnreadBadge } from "../components/UnreadBadge";
import { LiveChats } from "./LiveChats";
import { useChatInbox } from "./useChatInbox";
import { startChat } from "./chatService";
import {
  MarketplacePolicyModal,
  PolicyLinks,
  type PolicyPage,
} from "./MarketplacePolicies";
import { HelpSafety } from "./HelpSafety";
import { AccountSafety } from "./AccountSafety";
import { ListingSafety } from "./ListingSafety";
import { LiveEdit } from "./LiveEdit";
import { LiveSell } from "./LiveSell";
import { ListingModal } from "../components/ListingModal";
import { LiveCard } from "./LiveCard";
import { LiveExplore, initialFilters, type LiveFilters } from "./LiveExplore";
import { applyLiveFilters } from "./listingFilters";
const tabs: [string, IconName, IconName][] = [
  ["Explore", "search-outline", "search"],
  ["Saved", "heart-outline", "heart"],
  ["Sell", "add", "add"],
  ["Chats", "chatbubble-outline", "chatbubble"],
  ["Me", "person-outline", "person"],
];
export function LiveMarketplace({
  onSignIn,
  onDemo,
}: {
  onSignIn: () => void;
  onDemo: () => void;
}) {
  const { session } = useAuth();
  const user = session?.user;
  const client = getSupabaseClient();
  const inbox = useChatInbox(user?.id);
  const moderator = useModerator(user?.id);
  const [tab, setTab] = useState("Explore"),
    [rows, setRows] = useState<LiveListing[]>([]),
    [profile, setProfile] = useState<LiveProfile | null>(null),
    [saved, setSaved] = useState<string[]>([]),
    [filters, setFilters] = useState<LiveFilters>(initialFilters),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [detail, setDetail] = useState<LiveListing | null>(null),
    [editListing, setEditListing] = useState(false),
    [editBusy, setEditBusy] = useState(false),
    [working, setWorking] = useState(false),
    [editing, setEditing] = useState(false),
    [ownCount, setOwnCount] = useState(0),
    [draftVersion, setDraftVersion] = useState(0),
    [helpOpen, setHelpOpen] = useState(false),
    [safetyOpen, setSafetyOpen] = useState(false),
    [safetyBusy, setSafetyBusy] = useState(false),
    [chatId, setChatId] = useState<string | null>(null),
    [moderationOpen, setModerationOpen] = useState(false),
    [moderationBusy, setModerationBusy] = useState(false);
  const [policyPage, setPolicyPage] = useState<PolicyPage | null>(null);
  const generation = useRef(0),
    scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  useEffect(() => {
    let alive = true;
    if (user) {
      client
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data, error }) => {
          if (alive) {
            if (error) setError("Your profile could not be loaded.");
            else setProfile(data);
          }
        });
      client
        .from("saved_listings")
        .select("listing_id,listing:listings!inner(id)")
        .then(({ data, error }) => {
          if (alive) {
            if (error) setError("Saved items could not be loaded.");
            else setSaved((data || []).map((r) => r.listing_id));
          }
        });
    }
    return () => {
      alive = false;
    };
  }, [user?.id, revision]);
  useEffect(() => {
    let alive = true;
    if (user)
      client
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .neq("status", "removed")
        .then(({ count }) => {
          if (alive && count !== null) setOwnCount(count);
        });
    return () => {
      alive = false;
    };
  }, [user?.id, revision]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);
  useEffect(() => {
    if (!["Explore", "Saved", "Me"].includes(tab)) return;
    const request = ++generation.current;
    setBusy(true);
    setError("");
    // Cancel prior requests while typing; filter every page at the server.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          let query = client
            .from("listings")
            .select(
              "*,seller:profiles!listings_owner_id_fkey!inner(display_name,seller_type)",
            );
          if (tab === "Me") {
            if (!user) return;
            query = query.eq("owner_id", user.id);
          } else query = query.neq("status", "removed");
          if (tab === "Saved") {
            if (!saved.length) {
              if (request === generation.current) {
                setRows([]);
                setMore(false);
              }
              return;
            }
            query = query.in("id", saved);
          }
          if (tab === "Explore") query = applyLiveFilters(query, filters);
          else
            query = query
              .order("created_at", { ascending: false })
              .order("id", { ascending: false });
          const result = await query.range(page * 20, page * 20 + 19);
          if (result.error) throw result.error;
          const images = await listingImages(result.data as LiveListing[]);
          if (request !== generation.current) return;
          setRows((old) =>
            page
              ? Array.from(
                  new Map(
                    [...old, ...images].map((row) => [row.id, row]),
                  ).values(),
                )
              : images,
          );
          setMore(images.length === 20);
        } catch {
          if (request === generation.current)
            setError(
              "Could not load listings. Check your connection and tap Retry.",
            );
        } finally {
          if (request === generation.current) setBusy(false);
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [tab, page, filters, revision, saved.join(","), user?.id]);
  const refresh = () => {
    setPage(0);
    setRevision((v) => v + 1);
  };
  const navigate = (next: string) => {
    if (!user && ["Sell", "Saved", "Me", "Chats"].includes(next)) {
      onSignIn();
      return;
    }
    if (next === tab) return;
    generation.current++;
    setRows([]);
    setPage(0);
    setTab(next);
  };
  const changeFilters = (value: LiveFilters) => {
    generation.current++;
    setRows([]);
    setPage(0);
    setFilters(value);
  };
  const save = async (row: LiveListing) => {
    if (!user) {
      onSignIn();
      return;
    }
    if (working) return;
    setWorking(true);
    try {
      const exists = saved.includes(row.id);
      const result = exists
        ? await client
            .from("saved_listings")
            .delete()
            .eq("user_id", user.id)
            .eq("listing_id", row.id)
        : await client
            .from("saved_listings")
            .insert({ user_id: user.id, listing_id: row.id });
      if (result.error) throw result.error;
      setPage(0);
      setSaved((old) =>
        exists ? old.filter((id) => id !== row.id) : [...old, row.id],
      );
    } catch {
      Alert.alert("Not saved", "Please check your connection and retry.");
    } finally {
      setWorking(false);
    }
  };
  const status = async (row: LiveListing, value: string) => {
    if (!user || working) return;
    setWorking(true);
    try {
      const result = await client
        .from("listings")
        .update({ status: value })
        .eq("id", row.id)
        .eq("owner_id", user.id)
        .select("id")
        .single();
      if (result.error) throw result.error;
      setDetail(null);
      refresh();
    } catch {
      Alert.alert("Could not update", "Check your connection and session.");
    } finally {
      setWorking(false);
    }
  };
  const permanentlyDelete = (row: LiveListing) => {
    if (
      !user ||
      working ||
      row.owner_id !== user.id ||
      row.status !== "removed" ||
      row.moderation_removed
    )
      return;
    Alert.alert("Delete permanently?", deletionConfirmation, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete permanently",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setWorking(true);
            try {
              const result = await deleteListingPermanently(row.id);
              setDetail(null);
              refresh();
              Alert.alert(
                "Listing deleted",
                result.retained_evidence
                  ? "Removed from your listings. A private evidence copy and reported photo are retained for moderators; existing chats remain."
                  : "The listing content and photos have been deleted. Existing chats remain.",
              );
            } catch (error) {
              Alert.alert(
                "Deletion not confirmed",
                error instanceof Error ? error.message : "Refresh and retry.",
              );
              refresh();
            } finally {
              setWorking(false);
            }
          })();
        },
      },
    ]);
  };
  const signOut = async () => {
    if (working) return;
    setWorking(true);
    try {
      const result = await client.auth.signOut({ scope: "global" });
      if (result.error) throw result.error;
    } catch {
      Alert.alert("Sign out failed", "Check your connection and retry.");
    } finally {
      setWorking(false);
    }
  };
  const saveProfile = async () => {
    if (!profile || !user) return;
    if (!profile.display_name.trim() || !profile.area.trim()) {
      Alert.alert("Profile details", "Enter a name and general area.");
      return;
    }
    setWorking(true);
    try {
      const { error } = await client
        .from("profiles")
        .update({
          display_name: profile.display_name.trim(),
          province: profile.province,
          area: profile.area.trim(),
          seller_type: profile.seller_type,
        })
        .eq("id", user.id)
        .select("id")
        .single();
      if (error) throw error;
      setEditing(false);
      refresh();
      Alert.alert("Profile saved");
    } catch {
      Alert.alert("Not saved", "Check your connection and retry.");
    } finally {
      setWorking(false);
    }
  };
  const messageSeller = async (row: LiveListing) => {
    if (!user) {
      setDetail(null);
      onSignIn();
      return;
    }
    if (working) return;
    setWorking(true);
    try {
      const id = await startChat(row.id, user.id);
      setDetail(null);
      setChatId(id);
      navigate("Chats");
      inbox.refresh();
    } catch {
      Alert.alert(
        "Could not open chat",
        "Check your connection and sign-in. The listing may be unavailable or an account may be blocked.",
      );
    } finally {
      setWorking(false);
    }
  };
  const location =
    filters.province !== "All PNG"
      ? filters.province
      : profile?.area || "Papua New Guinea";
  return (
    <SafeAreaView style={ui.page} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      {!(tab === "Chats" && chatId) && (
        <>
          <View style={ui.preview}>
            <Text style={ui.previewText}>PNG MARKETPLACE · TEST RELEASE</Text>
          </View>
          <View style={ui.masthead}>
            <View style={ui.spread}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Marketplace home"
                onPress={() => navigate("Explore")}
              >
                <Text style={ui.brand}>
                  moresby<Text style={{ fontWeight: "400" }}>market</Text>
                  <Text style={{ color: "#c79d4c" }}> ✦</Text>
                </Text>
              </Pressable>
              <View style={[ui.row, { gap: 3, maxWidth: "40%" }]}>
                <Icon name="location-outline" size={12} color={palette.muted} />
                <Text style={[ui.pin, { flexShrink: 1 }]} numberOfLines={1}>
                  {location}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scroll}
          style={{ display: tab === "Chats" ? "none" : "flex" }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ui.content}
        >
          {/* Keep the live sell form mounted across tabs so a photo/draft is not lost. */}
          {user && profile && (
            <View style={{ display: tab === "Sell" ? "flex" : "none" }}>
              <LiveSell
                key={draftVersion}
                profile={profile}
                onPublished={() => {
                  setDraftVersion((v) => v + 1);
                  navigate("Me");
                  refresh();
                }}
              />
            </View>
          )}
          {tab === "Explore" && (
            <LiveExplore
              filters={filters}
              onChange={changeFilters}
              onSell={() => navigate("Sell")}
            />
          )}
          {tab === "Saved" && (
            <>
              <Text style={ui.eyebrow}>KEEP YOUR GOOD FINDS CLOSE</Text>
              <Text style={ui.title}>Saved finds</Text>
              <Text style={ui.subtitle}>
                Your favourites, all in one place.
              </Text>
            </>
          )}
          {tab === "Me" && <PolicyLinks onOpen={setPolicyPage} />}
          {tab === "Me" && user && (
            <>
              <Text style={ui.eyebrow}>YOUR CORNER OF THE MARKET</Text>
              <View style={[ui.row, { marginTop: 22, marginBottom: 20 }]}>
                <View style={ui.profileAvatar}>
                  <Text style={{ fontSize: 26, color: palette.green }}>
                    {(profile?.display_name || "Member")[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ui.title, { fontSize: 23 }]}>
                    {profile?.display_name || "Your account"}
                  </Text>
                  <Text style={ui.small}>
                    {profile?.area} · {profile?.seller_type || "Individual"}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Edit profile"
                  onPress={() => setEditing(!editing)}
                >
                  <Icon name="create-outline" />
                </Pressable>
              </View>
              {editing && profile && (
                <View style={ui.panel}>
                  <Text style={ui.fieldLabel}>Public display name</Text>
                  <TextInput
                    accessibilityLabel="Public profile name"
                    style={ui.input}
                    value={profile.display_name}
                    onChangeText={(display_name) =>
                      setProfile({ ...profile, display_name })
                    }
                    maxLength={60}
                  />
                  <ProvinceField
                    value={profile.province}
                    onChange={(province) =>
                      setProfile({ ...profile, province })
                    }
                  />
                  <Text style={ui.fieldLabel}>Town / suburb</Text>
                  <TextInput
                    accessibilityLabel="Public profile area"
                    style={ui.input}
                    value={profile.area}
                    onChangeText={(area) => setProfile({ ...profile, area })}
                    maxLength={80}
                  />
                  <ChoiceField
                    label="Seller type"
                    values={["Individual", "SME", "Company"]}
                    value={profile.seller_type}
                    onChange={(seller_type) =>
                      setProfile({ ...profile, seller_type })
                    }
                  />
                  <Button
                    title="Save public profile"
                    disabled={working}
                    onPress={saveProfile}
                  />
                </View>
              )}
              <View style={[ui.spread, ui.panel]}>
                {[
                  [ownCount, "Listings"],
                  [saved.length, "Saved"],
                ].map(([count, label]) => (
                  <Pressable
                    accessibilityRole="button"
                    key={label}
                    onPress={() => {
                      if (label === "Saved") navigate("Saved");
                    }}
                    style={{ alignItems: "center", flex: 1 }}
                  >
                    <Text style={ui.section}>{count}</Text>
                    <Text style={ui.small}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={ui.menuRow} onPress={() => navigate("Sell")}>
                <Icon name="add-circle-outline" />
                <Text style={ui.menuText}>Sell an item</Text>
                <Icon name="chevron-forward" size={16} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={ui.menuRow}
                onPress={() => setHelpOpen(true)}
              >
                <Icon name="help-circle-outline" />
                <Text style={ui.menuText}>Help & Safety</Text>
                <Icon name="chevron-forward" size={16} />
              </Pressable>
              <Pressable style={ui.menuRow} onPress={() => setSafetyOpen(true)}>
                <Icon name="shield-checkmark-outline" />
                <Text style={ui.menuText}>Safety & account</Text>
                <Icon name="chevron-forward" size={16} />
              </Pressable>
              {moderator && (
                <Pressable
                  accessibilityRole="button"
                  style={ui.menuRow}
                  onPress={() => setModerationOpen(true)}
                >
                  <Icon name="shield-checkmark-outline" />
                  <Text style={ui.menuText}>Moderation dashboard</Text>
                  <Icon name="chevron-forward" size={16} />
                </Pressable>
              )}
              <Pressable style={ui.menuRow} onPress={onDemo}>
                <Icon name="phone-portrait-outline" />
                <Text style={ui.menuText}>Open separate offline demo</Text>
                <Icon name="chevron-forward" size={16} />
              </Pressable>
              <Pressable
                style={ui.menuRow}
                disabled={working}
                onPress={signOut}
              >
                <Icon name="log-out-outline" />
                <Text style={ui.menuText}>Sign out of all devices</Text>
                <Icon name="chevron-forward" size={16} />
              </Pressable>
              <Text style={[ui.small, { marginTop: 12 }]}>
                {user.email} · Only visible to you
              </Text>
              <View style={[ui.spread, { marginTop: 27, marginBottom: 20 }]}>
                <Text style={ui.section}>My listings</Text>
                <Text style={ui.small}>{ownCount} published</Text>
              </View>
            </>
          )}
          {["Explore", "Saved", "Me"].includes(tab) && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh listings"
                onPress={refresh}
              >
                <Text style={[ui.link, { marginBottom: 14 }]}>
                  {busy ? "Loading…" : error ? "Retry" : "Refresh listings"}
                </Text>
              </Pressable>
              {!!error && <Text style={ui.subtitle}>{error}</Text>}
              <View style={ui.grid}>
                {rows.map((row) => (
                  <LiveCard
                    key={row.id}
                    listing={row}
                    saved={saved.includes(row.id)}
                    onOpen={() => {
                      setEditListing(false);
                      setDetail(row);
                    }}
                    onSave={() => {
                      void save(row);
                    }}
                    disabled={working || row.status === "removed"}
                  />
                ))}
              </View>
              {!busy && !error && !rows.length && (
                <View style={ui.empty}>
                  <Icon
                    name={tab === "Saved" ? "heart-outline" : "search-outline"}
                    size={30}
                  />
                  <Text style={ui.section}>
                    {tab === "Saved"
                      ? "No saved finds yet"
                      : tab === "Me"
                        ? "Your next listing starts here"
                        : "Nothing here just yet"}
                  </Text>
                  <Text style={ui.emptyText}>
                    {tab === "Saved"
                      ? "Tap a heart on a listing to save it."
                      : tab === "Me"
                        ? "Take a photo and list something for sale."
                        : "Try another category or change your filters."}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (tab === "Explore")
                        changeFilters({ ...initialFilters });
                      else navigate(tab === "Me" ? "Sell" : "Explore");
                    }}
                  >
                    <Text style={ui.link}>
                      {tab === "Me"
                        ? "Create a listing"
                        : tab === "Saved"
                          ? "Explore listings"
                          : "Show all listings"}
                    </Text>
                  </Pressable>
                </View>
              )}
              {more && (
                <Button
                  title="Load more"
                  disabled={busy}
                  onPress={() => setPage((v) => v + 1)}
                />
              )}
              <Text style={[ui.small, { textAlign: "center", marginTop: 5 }]}>
                Prices in Papua New Guinea kina
              </Text>
            </>
          )}
          {!user && (
            <View style={{ marginTop: 16 }}>
              <Button title="Sign in to buy and sell" onPress={onSignIn} />
            </View>
          )}
        </ScrollView>
        {user && (
          <View style={{ flex: 1, display: tab === "Chats" ? "flex" : "none" }}>
            <LiveChats
              userId={user.id}
              active={tab === "Chats"}
              conversationId={chatId}
              onSelect={setChatId}
              inbox={inbox}
            />
          </View>
        )}
      </KeyboardAvoidingView>
      {!(tab === "Chats" && chatId) && (
        <>
          <View style={ui.tabs}>
            {tabs.map(([label, outline, filled]) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={
                  label === "Chats"
                    ? `Chats, ${inbox.unread} unread messages`
                    : label
                }
                accessibilityState={{ selected: tab === label }}
                key={label}
                onPress={() => navigate(label)}
                style={ui.tab}
              >
                {label === "Chats" && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: -3,
                      right: "20%",
                      zIndex: 1,
                    }}
                  >
                    <UnreadBadge count={inbox.unread} />
                  </View>
                )}
                {label === "Sell" ? (
                  <View style={ui.sellIcon}>
                    <Icon name="add" size={27} color="white" />
                  </View>
                ) : (
                  <Icon
                    name={tab === label ? filled : outline}
                    size={22}
                    color={tab === label ? palette.green : "#919b91"}
                  />
                )}
                <Text
                  style={[
                    ui.tabText,
                    tab === label && {
                      color: palette.green,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <ListingModal
        visible={!!detail}
        onClose={() => {
          if (editBusy) return;
          if (editListing) {
            Alert.alert(
              "Discard changes?",
              "Your unsaved edits will be lost.",
              [
                { text: "Keep editing", style: "cancel" },
                {
                  text: "Discard",
                  style: "destructive",
                  onPress: () => setEditListing(false),
                },
              ],
            );
          } else setDetail(null);
        }}
      >
        {detail && editListing ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={ui.content}
            >
              <LiveEdit
                key={detail.id}
                listing={detail}
                onBusyChange={setEditBusy}
                onCancel={() => setEditListing(false)}
                onSaved={() => {
                  setEditListing(false);
                  setDetail(null);
                  refresh();
                }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <ScrollView contentContainerStyle={ui.content}>
            {detail && (
              <>
                {detail.imageUrl && (
                  <Image
                    source={{ uri: detail.imageUrl }}
                    style={ui.detailPhoto}
                  />
                )}
                <Text style={ui.title}>{detail.title}</Text>
                <Text style={ui.detailPrice}>{livePrice(detail)}</Text>
                <Text style={ui.subtitle}>
                  {detail.area}, {detail.province}
                </Text>
                <Text style={ui.section}>
                  {detail.status === "available"
                    ? detail.property_type || detail.condition
                    : detail.status === "removed"
                      ? "Removed"
                      : "Unavailable"}
                </Text>
                <Text style={[ui.small, { marginTop: 10 }]}>
                  {detail.seller?.display_name || "Local seller"} ·{" "}
                  {detail.seller?.seller_type || "Individual"}
                </Text>
                {detail.category === "Property" && (
                  <Text style={ui.subtitle}>
                    {[
                      detail.purpose,
                      detail.bedrooms !== null
                        ? `${detail.bedrooms} bedrooms`
                        : null,
                      detail.size_sqm !== null ? `${detail.size_sqm} m²` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
                <Text style={[ui.subtitle, { marginTop: 16 }]}>
                  {detail.description}
                </Text>
                <Text style={ui.small}>{detail.handovers.join(" · ")}</Text>
                {detail.owner_id === user?.id && detail.moderation_removed ? (
                  <Text style={ui.subtitle}>
                    This listing was removed by moderation and cannot be
                    reactivated here.
                  </Text>
                ) : detail.owner_id === user?.id ? (
                  <View style={{ gap: 12, marginTop: 20 }}>
                    {detail.status !== "removed" && (
                      <Button
                        title="Edit listing"
                        secondary
                        disabled={working}
                        onPress={() => setEditListing(true)}
                      />
                    )}
                    {!detail.permanently_deleted_at && (
                      <Button
                        title={
                          detail.status === "available"
                            ? "Mark unavailable"
                            : "Make available"
                        }
                        disabled={working}
                        onPress={() =>
                          status(
                            detail,
                            detail.status === "available"
                              ? "unavailable"
                              : "available",
                          )
                        }
                      />
                    )}
                    {detail.status === "removed" && (
                      <Button
                        title={
                          detail.deletion_cleanup_pending
                            ? "Finish deletion cleanup"
                            : "Delete permanently"
                        }
                        danger
                        disabled={working}
                        onPress={() => permanentlyDelete(detail)}
                      />
                    )}
                    {detail.status !== "removed" && (
                      <Button
                        title="Remove listing"
                        secondary
                        disabled={working}
                        onPress={() =>
                          Alert.alert(
                            "Remove this listing?",
                            "It will no longer be shown in public searches.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: () => {
                                  void status(detail, "removed");
                                },
                              },
                            ],
                          )
                        }
                      />
                    )}
                  </View>
                ) : (
                  <View style={{ marginTop: 20 }}>
                    <Button
                      title={
                        saved.includes(detail.id) ? "Unsave" : "Save listing"
                      }
                      secondary
                      disabled={working}
                      onPress={() => {
                        void save(detail);
                      }}
                    />
                    <Button
                      title="Message seller"
                      disabled={working || detail.status !== "available"}
                      onPress={() => {
                        void messageSeller(detail);
                      }}
                    />
                    {detail.status !== "available" && (
                      <Text style={ui.small}>
                        This listing is unavailable for new conversations.
                      </Text>
                    )}
                    <ListingSafety
                      key={detail.id}
                      listing={detail}
                      userId={user?.id}
                      onSignIn={() => {
                        setDetail(null);
                        onSignIn();
                      }}
                      onBlocked={() => {
                        setDetail(null);
                        setRows([]);
                        refresh();
                      }}
                    />
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </ListingModal>
      <MarketplacePolicyModal
        page={policyPage}
        onClose={() => setPolicyPage(null)}
      />
      <ListingModal
        visible={helpOpen}
        title="Help & Safety"
        backLabel="Back to me"
        onClose={() => setHelpOpen(false)}
      >
        <HelpSafety />
      </ListingModal>
      <ListingModal
        visible={safetyOpen}
        title="Safety & account"
        backLabel="Back to me"
        onClose={() => {
          if (!safetyBusy) setSafetyOpen(false);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={ui.content}
          >
            {user && safetyOpen && (
              <AccountSafety
                userId={user.id}
                onBusyChange={setSafetyBusy}
                onChanged={() => {
                  setRows([]);
                  refresh();
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </ListingModal>
      <ListingModal
        visible={moderationOpen && moderator}
        title="Moderation"
        backLabel="Back to me"
        onClose={() => {
          if (!moderationBusy) setModerationOpen(false);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {moderationOpen && moderator && (
            <ModerationDashboard
              onBusyChange={setModerationBusy}
              onChanged={() => {
                setRows([]);
                refresh();
              }}
            />
          )}
        </KeyboardAvoidingView>
      </ListingModal>
    </SafeAreaView>
  );
}
