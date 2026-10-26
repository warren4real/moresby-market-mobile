import type { LiveFilters } from "./LiveExplore";
// The filter methods preserve the selected row type, including seller joins.
export function applyLiveFilters<
  T extends {
    eq: (column: string, value: unknown) => T;
    in: (column: string, values: string[]) => T;
    ilike: (column: string, value: string) => T;
    order: (column: string, options: { ascending: boolean }) => T;
  },
>(query: T, f: LiveFilters): T {
  const literal = (value: string) => value.trim().replace(/[%_\\]/g, "");
  if (f.province !== "All PNG") query = query.eq("province", f.province);
  if (f.category !== "All finds") query = query.eq("category", f.category);
  if (literal(f.search)) query = query.ilike("title", `%${literal(f.search)}%`);
  if (literal(f.locality))
    query = query.ilike("area", `%${literal(f.locality)}%`);
  if (f.category === "Property") {
    if (f.propertyType !== "All property")
      query = query.eq("property_type", f.propertyType);
    if (f.purpose !== "Any purpose") query = query.eq("purpose", f.purpose);
  } else if (f.condition === "New") query = query.eq("condition", "New");
  else if (f.condition === "Second-hand")
    query = query.in("condition", ["Like new", "Good", "Fair"]);
  if (f.seller === "Individuals")
    query = query.eq("seller.seller_type", "Individual");
  if (f.seller === "Businesses")
    query = query.in("seller.seller_type", ["SME", "Company"]);
  if (f.sort !== "Latest")
    query = query.order("price", {
      ascending: f.sort === "Price: low to high",
    });
  return query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
}
