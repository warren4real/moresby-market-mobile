import { useEffect, useState } from "react";
import type { Product, Profile, Shop } from "../types";

// Owned by the provider so switching screens does not discard an unfinished listing.
export function useSellerDraft(profile: Profile, shop: Shop | null, ready: boolean) {
  const [mode, setMode] = useState<"Individual" | "SME" | "Company">(
    "Individual",
  );
  const [name, setName] = useState(""),
    [price, setPrice] = useState(""),
    [area, setArea] = useState(
      profile.area === "Port Moresby" ? "" : profile.area,
    ),
    [description, setDescription] = useState(""),
    [condition, setCondition] =
      useState<NonNullable<Product["condition"]>>("Good"),
    [category, setCategory] = useState("Other Items"),
    [photo, setPhoto] = useState(""),
    [photoLink, setPhotoLink] = useState(""),
    [negotiable, setNegotiable] = useState(false),
    [businessName, setBusinessName] = useState(shop?.name || ""),
    [meetup, setMeetup] = useState(true),
    [pickup, setPickup] = useState(false);
  const [province, setProvince] = useState("National Capital District");
  const [propertyType, setPropertyType] = useState("Rooms");
  const [purpose, setPurpose] = useState("For rent");
  const [period, setPeriod] = useState("Per month");
  const [bedrooms, setBedrooms] = useState("");
  const [size, setSize] = useState("");
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (ready && !seeded) {
      setArea(current => current || (profile.area === "Port Moresby" ? "" : profile.area));
      setBusinessName(current => current || shop?.name || "");
      setSeeded(true);
    }
  }, [ready, seeded, profile.area, shop?.name]);
  return { mode, setMode, name, setName, price, setPrice, area, setArea, description, setDescription, condition, setCondition, category, setCategory, photo, setPhoto, photoLink, setPhotoLink, negotiable, setNegotiable, businessName, setBusinessName, meetup, setMeetup, pickup, setPickup, province, setProvince, propertyType, setPropertyType, purpose, setPurpose, period, setPeriod, bedrooms, setBedrooms, size, setSize };
}
