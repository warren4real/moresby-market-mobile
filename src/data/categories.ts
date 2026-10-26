export const propertyTypes = ["Rooms", "Apartments & Houses", "Buildings & Commercial Spaces", "Land & Lots"];
export const propertyPurposes = ["For sale", "For rent", "For lease"];
export function purposesFor(type: string) {
  return type === "Rooms" ? ["For rent"] : propertyPurposes;
}
export const marketplaceCategories = [
  { name: "Property", short: "Property", icon: "home-outline", color: "#e1eee8" },
  {
    name: "Phones & Electronics",
    short: "Electronics",
    icon: "phone-portrait-outline",
    color: "#e1edf8",
  },
  {
    name: "Fashion & Personal Care",
    short: "Fashion",
    icon: "shirt-outline",
    color: "#f8e9e2",
  },
  {
    name: "Home & Living",
    short: "Home & Living",
    icon: "bed-outline",
    color: "#e7edde",
  },
  {
    name: "Tools & Equipment",
    short: "Tools",
    icon: "hammer-outline",
    color: "#f5edd6",
  },
  {
    name: "Local Crafts & Gifts",
    short: "Local Crafts",
    icon: "color-palette-outline",
    color: "#eee5f4",
  },
  {
    name: "Other Items",
    short: "Other Items",
    icon: "grid-outline",
    color: "#e7ecef",
  },
] as const;
export function migrateCategory(category: string) {
  return (
    (
      {
        Electronics: "Phones & Electronics",
        Fashion: "Fashion & Personal Care",
        Home: "Home & Living",
        Stationery: "Other Items",
      } as Record<string, string>
    )[category] || category
  );
}
