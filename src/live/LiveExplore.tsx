import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon, type IconName } from "../components/Icon";
import { ChoiceField } from "../components/ChoiceField";
import { ProvinceField } from "../components/ProvinceField";
import {
  marketplaceCategories,
  propertyTypes,
  propertyPurposes,
} from "../data/categories";
import { palette, ui } from "../theme/marketplace";
export const initialFilters = {
  search: "",
  province: "All PNG",
  locality: "",
  category: "All finds",
  condition: "All",
  seller: "Everyone",
  sort: "Latest",
  propertyType: "All property",
  purpose: "Any purpose",
};
export type LiveFilters = typeof initialFilters;
export function LiveExplore({
  filters: f,
  onChange,
  onSell,
}: {
  filters: LiveFilters;
  onChange: (value: LiveFilters) => void;
  onSell: () => void;
}) {
  const [sheet, setSheet] = useState<"categories" | "sort" | null>(null);
  const change = (value: Partial<LiveFilters>) => onChange({ ...f, ...value });
  const category = (value: string) =>
    change({
      category: value,
      propertyType: "All property",
      purpose: "Any purpose",
    });
  return (
    <>
      <View style={ui.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse categories"
          style={ui.iconButton}
          onPress={() => setSheet("categories")}
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
            value={f.search}
            onChangeText={(search) => change({ search })}
            returnKeyType="search"
          />
          {!!f.search && (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => change({ search: "" })}
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
            accessibilityState={{ selected: f.category === c.name }}
            key={c.name}
            style={ui.category}
            onPress={() =>
              category(f.category === c.name ? "All finds" : c.name)
            }
          >
            <View
              style={[
                ui.categoryIcon,
                { backgroundColor: c.color },
                f.category === c.name && {
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
      <Pressable accessibilityRole="button" onPress={onSell} style={ui.callout}>
        <Icon name="sparkles-outline" size={22} />
        <View style={{ flex: 1 }}>
          <Text style={ui.calloutTitle}>Someone nearby is looking for it.</Text>
          <Text style={ui.calloutText}>
            One item or a whole shop. Start selling locally.
          </Text>
        </View>
        <Icon name="arrow-forward" size={18} />
      </Pressable>
      <ProvinceField
        all
        value={f.province}
        onChange={(province) => change({ province, locality: "" })}
      />
      <TextInput
        accessibilityLabel="Filter by town or suburb"
        style={[ui.input, { marginTop: 8, marginBottom: 16 }]}
        placeholder="Town, district or suburb (optional)"
        value={f.locality}
        onChangeText={(locality) => change({ locality })}
      />
      {f.category === "Property" && (
        <>
          <ChoiceField
            label="Property type"
            values={["All property", ...propertyTypes]}
            value={f.propertyType}
            onChange={(propertyType) =>
              change({ propertyType, purpose: "Any purpose" })
            }
          />
          <ChoiceField
            label="Looking to"
            values={[
              "Any purpose",
              ...(f.propertyType === "Rooms" ? ["For rent"] : propertyPurposes),
            ]}
            value={f.purpose}
            onChange={(purpose) => change({ purpose })}
          />
        </>
      )}
      <View style={ui.spread}>
        <View style={{ flex: 1 }}>
          <Text style={ui.eyebrow}>
            {f.province === "All PNG"
              ? "DISCOVER PNG"
              : f.province.toUpperCase()}
          </Text>
          <Text style={[ui.section, { marginTop: 6 }]}>
            {f.search
              ? "Search results"
              : f.category === "All finds"
                ? "Listings in your selected area"
                : f.category}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort listings"
          style={ui.row}
          onPress={() => setSheet("sort")}
        >
          <Icon name="swap-vertical-outline" size={15} />
          <Text style={ui.link}>
            {f.sort === "Latest" ? "Latest" : "Price"}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ui.pills}
      >
        {(f.category === "Property" ? [] : ["All", "New", "Second-hand"]).map(
          (condition) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: f.condition === condition }}
              key={condition}
              onPress={() => change({ condition })}
              style={[ui.pill, f.condition === condition && ui.pillActive]}
            >
              <Text
                style={[
                  ui.pillText,
                  f.condition === condition && ui.pillSelected,
                ]}
              >
                {condition === "All" ? "All items" : condition}
              </Text>
            </Pressable>
          ),
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter seller type"
          onPress={() =>
            change({
              seller:
                f.seller === "Everyone"
                  ? "Individuals"
                  : f.seller === "Individuals"
                    ? "Businesses"
                    : "Everyone",
            })
          }
          style={ui.pill}
        >
          <Text style={ui.pillText}>
            {f.seller === "Everyone" ? "All sellers" : f.seller} ▾
          </Text>
        </Pressable>
      </ScrollView>
      {f.category !== "All finds" && (
        <Pressable
          onPress={() => category("All finds")}
          style={{ marginBottom: 15 }}
        >
          <Text style={ui.link}>Clear category ×</Text>
        </Pressable>
      )}
      <Modal
        transparent
        visible={!!sheet}
        animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <Pressable style={ui.drawer} onPress={() => setSheet(null)}>
          <Pressable
            style={[ui.sheet, { maxHeight: "85%" }]}
            onPress={() => {}}
          >
            <ScrollView>
              <View style={ui.spread}>
                <Text style={ui.section}>
                  {sheet === "categories"
                    ? "Browse categories"
                    : "Sort listings"}
                </Text>
                <Pressable
                  accessibilityLabel="Close options"
                  onPress={() => setSheet(null)}
                >
                  <Icon name="close" />
                </Pressable>
              </View>
              {sheet === "categories" ? (
                <>
                  {[
                    { name: "All finds", icon: "apps-outline" },
                    ...marketplaceCategories,
                  ].map((c) => (
                    <Pressable
                      key={c.name}
                      style={ui.sheetRow}
                      onPress={() => {
                        category(c.name);
                        setSheet(null);
                      }}
                    >
                      <Icon name={c.icon as IconName} />
                      <Text>
                        {c.name === "All finds" ? "All items" : c.name}
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                ["Latest", "Price: low to high", "Price: high to low"].map(
                  (sort) => (
                    <Pressable
                      key={sort}
                      style={ui.sheetRow}
                      onPress={() => {
                        change({ sort });
                        setSheet(null);
                      }}
                    >
                      <Icon
                        name={
                          f.sort === sort
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                      />
                      <Text>{sort}</Text>
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
