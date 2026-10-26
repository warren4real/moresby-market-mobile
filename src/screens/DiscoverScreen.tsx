import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ChoiceField } from "../components/ChoiceField";
import { ProvinceField } from "../components/ProvinceField";
import { propertyTypes, propertyPurposes, marketplaceCategories } from "../data/categories";
import { ui, palette } from "../theme/marketplace";
import { Icon, type IconName } from "../components/Icon";
import { ListingGrid } from "../components/ListingGrid";
export function DiscoverScreen() {
  const {
    provinceFilter, setProvinceFilter, localityFilter, setLocalityFilter, propertyType, setPropertyType, propertyPurpose, setPropertyPurpose,
    category,
    setCategory,
    search,
    setSearch,
    filtered,
    activeShop,
    setActiveShop,
    setTab,
    conditionFilter,
    setConditionFilter,
    sellerFilter,
    setSellerFilter,
    sort,
    setSort,
  } = useMarketplace();
  const [drawer, setDrawer] = useState(false),
    [sortOpen, setSortOpen] = useState(false);
  const reset = () => {
    setProvinceFilter("All PNG"); setLocalityFilter(""); setPropertyType("All property"); setPropertyPurpose("Any purpose");
    setSearch("");
    setCategory("All finds");
    setActiveShop(null);
    setConditionFilter("All");
    setSellerFilter("Everyone");
  };
  return (
    <>
      <View style={ui.row}>
        <Pressable
          accessibilityLabel="Browse categories"
          accessibilityRole="button"
          onPress={() => setDrawer(true)}
          style={ui.iconButton}
        >
          <Icon name="menu-outline" />
        </Pressable>
        <View style={ui.search}>
          <Icon name="search-outline" size={19} color={palette.muted} />
          <TextInput
            accessibilityLabel="Search marketplace"
            placeholder="Find your next good thing"
            placeholderTextColor="#929990"
            style={ui.searchInput}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {!!search && (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
            >
              <Icon name="close-circle" size={17} color={palette.muted} />
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ui.categories}
      >
        {marketplaceCategories.map((c) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: category === c.name }}
            key={c.name}
            style={ui.category}
            onPress={() =>
              setCategory(category === c.name ? "All finds" : c.name)
            }
          >
            <View
              style={[
                ui.categoryIcon,
                { backgroundColor: c.color },
                category === c.name && {
                  borderWidth: 1.5,
                  borderColor: palette.green,
                },
              ]}
            >
              <Icon name={c.icon as IconName} size={27} />
            </View>
            <Text style={ui.categoryText}>{c.short}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={() => setTab("Sell")}
        style={ui.callout}
      >
        <Icon name="sparkles-outline" size={22} />
        <View style={{ flex: 1 }}>
          <Text style={ui.calloutTitle}>Someone nearby is looking for it.</Text>
          <Text style={ui.calloutText}>
            One item or a whole shop. Start selling locally.
          </Text>
        </View>
        <Icon name="arrow-forward" size={18} />
      </Pressable>
      <ProvinceField all value={provinceFilter} onChange={value => { setProvinceFilter(value); setLocalityFilter(""); }} />
      <TextInput accessibilityLabel="Filter by town or suburb" style={[ui.input, { marginTop: 8, marginBottom: 16 }]} placeholder="Town, district or suburb (optional)" value={localityFilter} onChangeText={setLocalityFilter} />
      {category === "Property" && <>
        <ChoiceField label="Property type" values={["All property", ...propertyTypes]} value={propertyType} onChange={value => { setPropertyType(value); setPropertyPurpose("Any purpose"); }} />
        <ChoiceField label="Looking to" values={["Any purpose", ...(propertyType === "Rooms" ? ["For rent"] : propertyPurposes)]} value={propertyPurpose} onChange={setPropertyPurpose} />
      </>}
      {activeShop && (
        <View style={[ui.spread, { marginBottom: 15 }]}>
          <Text style={ui.section}>{activeShop}</Text>
          <Pressable onPress={() => setActiveShop(null)}>
            <Text style={ui.link}>All sellers ×</Text>
          </Pressable>
        </View>
      )}
      <View style={ui.spread}>
        <View>
          <Text style={ui.eyebrow}>{provinceFilter === "All PNG" ? "DISCOVER PNG" : provinceFilter.toUpperCase()}</Text>
          <Text style={[ui.section, { marginTop: 6 }]}>
            {search
              ? "Search results"
              : category === "All finds"
                ? "Listings in your selected area"
                : category}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort listings"
          style={ui.row}
          onPress={() => setSortOpen(true)}
        >
          <Icon name="swap-vertical-outline" size={15} />
          <Text style={ui.link}>{sort === "Latest" ? "Latest" : "Price"}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ui.pills}
      >
        {(category === "Property" ? [] : ["All", "New", "Second-hand"]).map((c) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: conditionFilter === c }}
            key={c}
            onPress={() => setConditionFilter(c)}
            style={[ui.pill, conditionFilter === c && ui.pillActive]}
          >
            <Text
              style={[ui.pillText, conditionFilter === c && ui.pillSelected]}
            >
              {c === "All" ? "All items" : c}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() =>
            setSellerFilter(
              sellerFilter === "Everyone"
                ? "Individuals"
                : sellerFilter === "Individuals"
                  ? "Businesses"
                  : "Everyone",
            )
          }
          style={ui.pill}
        >
          <Text style={ui.pillText}>
            {sellerFilter === "Everyone" ? "All sellers" : sellerFilter} ▾
          </Text>
        </Pressable>
      </ScrollView>
      {category !== "All finds" && (
        <Pressable
          onPress={() => setCategory("All finds")}
          style={{ marginBottom: 15 }}
        >
          <Text style={ui.link}>Clear category ×</Text>
        </Pressable>
      )}
      <ListingGrid products={filtered} />
      {!filtered.length && (
        <View style={ui.empty}>
          <Icon name="search-outline" size={30} />
          <Text style={ui.section}>Nothing here just yet</Text>
          <Text style={ui.emptyText}>
            Try another category or change your filters.
          </Text>
          <Pressable onPress={reset}>
            <Text style={ui.link}>Show all listings</Text>
          </Pressable>
        </View>
      )}
      <Text style={[ui.small, { textAlign: "center", marginTop: 5 }]}>
        {filtered.length} listings · Prices in Papua New Guinea kina
      </Text>
      <Modal
        transparent
        visible={drawer || sortOpen}
        animationType="slide"
        onRequestClose={() => {
          setDrawer(false);
          setSortOpen(false);
        }}
      >
        <Pressable
          style={ui.drawer}
          onPress={() => {
            setDrawer(false);
            setSortOpen(false);
          }}
        >
          <Pressable style={[ui.sheet, { maxHeight: "85%" }]} onPress={() => {}}>
            <ScrollView>
            <View style={ui.spread}>
              <Text style={ui.section}>
                {drawer ? "Browse categories" : "Sort listings"}
              </Text>
              <Pressable
                accessibilityLabel="Close options"
                onPress={() => {
                  setDrawer(false);
                  setSortOpen(false);
                }}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {drawer ? (
              <>
                <Pressable
                  style={ui.sheetRow}
                  onPress={() => {
                    setCategory("All finds");
                    setDrawer(false);
                  }}
                >
                  <Icon name="apps-outline" />
                  <Text>All items</Text>
                </Pressable>
                {marketplaceCategories.map((c) => (
                  <Pressable
                    key={c.name}
                    style={ui.sheetRow}
                    onPress={() => {
                      setCategory(c.name);
                      setDrawer(false);
                    }}
                  >
                    <Icon name={c.icon as IconName} />
                    <Text>{c.name}</Text>
                  </Pressable>
                ))}
              </>
            ) : (
              ["Latest", "Price: low to high", "Price: high to low"].map(
                (value) => (
                  <Pressable
                    key={value}
                    style={ui.sheetRow}
                    onPress={() => {
                      setSort(value);
                      setSortOpen(false);
                    }}
                  >
                    <Icon
                      name={
                        sort === value ? "radio-button-on" : "radio-button-off"
                      }
                    />
                    <Text>{value}</Text>
                  </Pressable>
                ),
              )
            )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
