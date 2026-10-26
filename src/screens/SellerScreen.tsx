import React from "react";
import { Alert, Image, Linking, Pressable, Text, TextInput, View } from "react-native";
import { persistPhoto } from "../services/photos";
import * as ImagePicker from "expo-image-picker";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ProvinceField } from "../components/ProvinceField";
import { ChoiceField } from "../components/ChoiceField";
import { propertyTypes, purposesFor, marketplaceCategories } from "../data/categories";
import { ui, palette } from "../theme/marketplace";
import { Icon } from "../components/Icon";
import { Button } from "../components/Button";
import type { Product } from "../types";
export function SellerScreen() {
  const { products, setProducts, profile, shop, setShop, setTab, sellerDraft, activeProfileId, isOwnProduct } =
    useMarketplace();
  const { mode, setMode, name, setName, price, setPrice, area, setArea, description, setDescription, condition, setCondition, category, setCategory, photo, setPhoto, photoLink, setPhotoLink, negotiable, setNegotiable, businessName, setBusinessName, meetup, setMeetup, pickup, setPickup, province, setProvince, propertyType, setPropertyType, purpose, setPurpose, period, setPeriod, bedrooms, setBedrooms, size, setSize } = sellerDraft;
  const isProperty = category === "Property";
  const pickPhoto = async (camera = false) => {
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(camera ? "Camera access" : "Photo access", camera ? "Allow camera access in Settings to photograph your listing. You can also choose an existing photo." : "Allow photo access in Settings, or use an image link.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => { void Linking.openSettings(); } },
        ]);
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: false };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        setPhoto(await persistPhoto(result.assets[0].uri));
        setPhotoLink("");
      }
    } catch {
      Alert.alert("Could not add photo", "Try again or choose an existing photo from your library.");
    }
  };
  const applyPhotoLink = () => {
    if (!/^https:\/\/[^\s]+$/i.test(photoLink.trim())) {
      Alert.alert("Image link", "Paste a complete HTTPS image link. For a title like ‘Land for sale’, use Listing title below. Your selected photo has been kept.");
      return;
    }
    setPhoto(photoLink.trim());
  };
  const publish = () => {
    const amount = Number(price);
    if (
      !name.trim() ||
      !price.trim() ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !area.trim() ||
      !description.trim() ||
      !photo
    ) {
      Alert.alert(
        "Complete your listing",
        "Add a photo, title, price, suburb and description. A price of 0 means free.",
      );
      return;
    }
    if (!/^(https:\/\/|data:image\/|file:\/\/)/i.test(photo)) {
      Alert.alert(
        "Photo link",
        "Choose an image or use a public HTTPS photo link.",
      );
      return;
    }
    if (isProperty && ((propertyType !== "Land & Lots" && bedrooms && (!Number.isInteger(Number(bedrooms)) || Number(bedrooms) < 0)) || (size && (!Number.isFinite(Number(size)) || Number(size) <= 0)))) {
      Alert.alert("Property details", "Enter a whole number of bedrooms and a positive area in square metres."); return;
    }
    if (!isProperty && !meetup && !pickup) {
      Alert.alert(
        "Choose a handover",
        "Offer a public meetup, pickup, or both.",
      );
      return;
    }
    if (mode !== "Individual" && !businessName.trim()) {
      Alert.alert(
        "Your business name",
        "Please enter the shop or company name.",
      );
      return;
    }
    const seller =
      mode === "Individual"
        ? profile.name === "Your profile"
          ? "Local seller"
          : profile.name
        : businessName.trim();
    if (mode !== "Individual") setShop({ name: seller, area: area.trim() });
    const listing: Product = {
      id: Date.now(),
      name: name.trim(),
      price: amount,
      category,
      shop: seller,
      area: area.trim(),
      image: photo,
      stock: 1,
      condition: isProperty ? undefined : condition,
      province,
      property: isProperty ? { type: propertyType, purpose, pricePeriod: purpose === "For sale" ? "Total" : period as "Per month" | "Per week", bedrooms: propertyType !== "Land & Lots" && bedrooms ? Number(bedrooms) : undefined, size: size ? Number(size) : undefined } : undefined,
      sellerType: mode,
      negotiable,
      description: description.trim(),
      createdAt: new Date().toISOString(),
      owned: true,
      ownerId: activeProfileId,
      handovers: isProperty ? ["Arrange a viewing"] : [
        ...(meetup ? ["Public meetup"] : []),
        ...(pickup ? ["Shop pickup"] : []),
      ],
    };
    setProducts((current) => [listing, ...current]);
    setName("");
    setPrice("");
    setDescription("");
    setPhoto("");
    setPhotoLink("");
    setTab("Me");
    Alert.alert(
      "Demo listing created",
      "Your item appears in the marketplace on this device. It has not been published online.",
    );
  };
  return (
    <>
      <Text style={ui.eyebrow}>MAKE ROOM FOR SOMETHING NEW</Text>
      <Text style={ui.title}>What are you selling?</Text>
      <Text style={ui.subtitle}>
        One pre-loved item or your business collection. Everyone has a place
        here.
      </Text>
      <View style={ui.choices}>
        {(["Individual", "SME", "Company"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === value }}
            onPress={() => setMode(value)}
            style={[ui.choice, mode === value && ui.choiceActive]}
          >
            <Text style={ui.choiceText}>
              {value === "Individual"
                ? "Sell an item"
                : value === "SME"
                  ? "SME / Shop"
                  : "Company"}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode !== "Individual" && (
        <>
          <Text style={ui.fieldLabel}>Shop or company name</Text>
          <TextInput
            accessibilityLabel="Business name"
            value={businessName}
            onChangeText={setBusinessName}
            maxLength={60}
            style={ui.input}
            placeholder="Your business name"
          />
        </>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add listing photo"
        onPress={() => pickPhoto(false)}
        style={ui.photoPicker}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <>
            <Icon name="camera-outline" size={32} />
            <Text style={ui.link}>Add a photo</Text>
            <Text style={ui.small}>
              Show the real item, including any faults
            </Text>
          </>
        )}
      </Pressable>
      <View style={[ui.choices, { marginTop: 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Take a listing photo" style={ui.choice} onPress={() => pickPhoto(true)}><Text style={ui.choiceText}>Take a photo</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a listing photo" style={ui.choice} onPress={() => pickPhoto(false)}><Text style={ui.choiceText}>Choose from library</Text></Pressable>
      </View>
      <Text style={ui.fieldLabel}>Image URL (optional alternative)</Text>
      <TextInput accessibilityLabel="Photo URL" value={photoLink} onChangeText={setPhotoLink} autoCapitalize="none" style={ui.input} placeholder="Paste https://… then tap Use image link" />
      {!!photoLink && <Pressable accessibilityRole="button" onPress={applyPhotoLink} style={ui.choice}><Text style={ui.choiceText}>Use image link</Text></Pressable>}
      <Text style={ui.small}>Already chose a photo? Skip the image URL and enter a listing title below.</Text>
      <Text style={ui.fieldLabel}>Listing title</Text>
      <TextInput
        accessibilityLabel="Listing title"
        style={ui.input}
        placeholder="e.g. iPhone 12, good condition"
        value={name}
        onChangeText={setName}
        maxLength={100}
      />
      <Text style={ui.fieldLabel}>Category</Text>
      <View style={ui.choices}>
        {marketplaceCategories.map((c) => (
          <Pressable
            key={c.name}
            accessibilityRole="button"
            accessibilityState={{ selected: category === c.name }}
            style={[ui.choice, category === c.name && ui.choiceActive]}
            onPress={() => setCategory(c.name)}
          >
            <Text style={ui.choiceText}>{c.short}</Text>
          </Pressable>
        ))}
      </View>
      {isProperty && <>
        <ChoiceField label="Property type" values={propertyTypes} value={propertyType} onChange={value => { setPropertyType(value); if (value === "Rooms") { setPurpose("For rent"); setPeriod("Per month"); } }} />
        <ChoiceField label="Listing purpose" values={purposesFor(propertyType)} value={purpose} onChange={value => { setPurpose(value); if (value !== "For sale") setPeriod("Per month"); }} />
        {purpose !== "For sale" && <ChoiceField label="Rent / lease price is" values={["Per month", "Per week"]} value={period} onChange={setPeriod} />}
        {propertyType !== "Land & Lots" && <><Text style={ui.fieldLabel}>Bedrooms (optional)</Text><TextInput accessibilityLabel="Bedrooms" style={ui.input} keyboardType="number-pad" value={bedrooms} onChangeText={setBedrooms} /></>}
        <Text style={ui.fieldLabel}>Area in square metres (optional)</Text><TextInput accessibilityLabel="Property area square metres" style={ui.input} keyboardType="decimal-pad" value={size} onChangeText={setSize} />
      </>}
      {!isProperty && <><Text style={ui.fieldLabel}>Condition</Text>
      <View style={ui.choices}>
        {(["New", "Like new", "Good", "Fair"] as const).map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityState={{ selected: condition === c }}
            onPress={() => setCondition(c)}
            style={[ui.choice, condition === c && ui.choiceActive]}
          >
            <Text style={ui.choiceText}>{c}</Text>
          </Pressable>
        ))}
      </View>
      </>}
      <Text style={ui.fieldLabel}>{isProperty ? `Price (K) · ${purpose === "For sale" ? "total sale price" : period.toLowerCase()}` : "Price (K) · enter 0 for free"}</Text>
      <TextInput
        accessibilityLabel="Price in kina"
        keyboardType="decimal-pad"
        style={ui.input}
        placeholder="0.00"
        value={price}
        onChangeText={setPrice}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: negotiable }}
        onPress={() => setNegotiable(!negotiable)}
        style={[ui.row, { marginTop: 12 }]}
      >
        <Icon name={negotiable ? "checkbox" : "square-outline"} size={21} />
        <Text style={ui.small}>Open to offers</Text>
      </Pressable>
      <ProvinceField value={province} onChange={setProvince} />
      <Text style={ui.fieldLabel}>Town, district or suburb</Text>
      <TextInput
        accessibilityLabel="Listing suburb"
        style={ui.input}
        placeholder="e.g. Boroko"
        value={area}
        onChangeText={setArea}
        maxLength={60}
      />
      <Text style={ui.fieldLabel}>Description and any faults</Text>
      <TextInput
        accessibilityLabel="Listing description"
        style={[ui.input, { minHeight: 100, textAlignVertical: "top" }]}
        multiline
        placeholder="Tell buyers about the item, condition and anything they should know."
        value={description}
        onChangeText={setDescription}
        maxLength={2000}
      />
      {!isProperty && <><Text style={ui.fieldLabel}>How can the buyer collect it?</Text>
      <View style={ui.choices}>
        {[
          ["Public meetup", meetup, () => setMeetup(!meetup)],
          ["Pickup", pickup, () => setPickup(!pickup)],
        ].map(([label, checked, toggle]) => (
          <Pressable
            key={String(label)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!checked }}
            onPress={toggle as () => void}
            style={[ui.choice, !!checked && ui.choiceActive]}
          >
            <Text style={ui.choiceText}>
              {checked ? "✓ " : ""}
              {String(label)}
            </Text>
          </Pressable>
        ))}
      </View>
      </>}
      <View style={ui.notice}>
        <Text style={ui.noticeText}>
          {isProperty ? "Buyers can enquire and arrange a viewing. No property booking, payment or agreement is made in this preview." : "Pay at handover. Agree on details first and choose a public place for meetups."} This preview saves listings on your device only.
        </Text>
      </View>
      <Button title="Create demo listing →" onPress={publish} />
      <Text style={[ui.small, { textAlign: "center", marginTop: 12 }]}>
        {products.filter(isOwnProduct).length} of your listings · No shop
        required to sell an item
      </Text>
    </>
  );
}
