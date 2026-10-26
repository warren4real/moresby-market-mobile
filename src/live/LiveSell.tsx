import React, { useState } from "react";
import { Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { getSupabaseClient } from "../services/supabase";
import { ProvinceField } from "../components/ProvinceField";
import { ChoiceField } from "../components/ChoiceField";
import { Button } from "../components/Button";
import {
  marketplaceCategories,
  propertyTypes,
  purposesFor,
} from "../data/categories";
import { ui } from "../theme/marketplace";
import type { LiveProfile } from "./listings";
export function LiveSell({
  profile,
  onPublished,
}: {
  profile: LiveProfile | null;
  onPublished: () => void;
}) {
  const [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState(""),
    [category, setCategory] = useState("Other Items"),
    [condition, setCondition] = useState("Good"),
    [province, setProvince] = useState(
      profile?.province || "National Capital District",
    ),
    [area, setArea] = useState(profile?.area || ""),
    [photo, setPhoto] = useState(""),
    [negotiable, setNegotiable] = useState("No"),
    [handover, setHandover] = useState("Public meetup"),
    [type, setType] = useState("Rooms"),
    [purpose, setPurpose] = useState("For rent"),
    [period, setPeriod] = useState("Per month"),
    [bedrooms, setBedrooms] = useState(""),
    [size, setSize] = useState(""),
    [busy, setBusy] = useState(false),
    [requestId, setRequestId] = useState("");
  const isProperty = category === "Property";
  const choose = async (camera: boolean) => {
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo permission",
          "Allow access in iPhone/Android settings, then retry.",
        );
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 0.7,
          });
      if (result.canceled) return;
      const source = result.assets[0];
      const context = ImageManipulator.ImageManipulator.manipulate(source.uri);
      if (Math.max(source.width, source.height) > 1600)
        context.resize(
          source.width >= source.height ? { width: 1600 } : { height: 1600 },
        );
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.7,
      });
      setPhoto(saved.uri);
      setRequestId("");
    } catch {
      Alert.alert(
        "Photo could not be prepared",
        "Choose another photo or try again.",
      );
    }
  };
  const publish = async () => {
    if (busy) return;
    const amount = Number(price),
      beds = bedrooms.trim() ? Number(bedrooms) : null,
      sqm = size.trim() ? Number(size) : null;
    if (
      !name.trim() ||
      !description.trim() ||
      !price.trim() ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 9999999999.99 ||
      !area.trim() ||
      !photo
    ) {
      Alert.alert(
        "Complete your listing",
        "Add a title, description, valid price, area and photo.",
      );
      return;
    }
    if (
      isProperty &&
      ((type !== "Land & Lots" &&
        beds !== null &&
        (!Number.isInteger(beds) || beds < 0 || beds > 1000)) ||
        (sqm !== null &&
          (!Number.isFinite(sqm) || sqm <= 0 || sqm > 1000000000)))
    ) {
      Alert.alert("Property details", "Check the bedrooms and area size.");
      return;
    }
    setBusy(true);
    try {
      // UUID from the platform-backed crypto module is not needed for auth; this
      // RFC 4122 random request ID deduplicates retries of the same publish action.
      const id =
        requestId ||
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const n = Math.floor(Math.random() * 16);
          return (c === "x" ? n : (n & 3) | 8).toString(16);
        });
      setRequestId(id);
      const fields = {
        id,
        title: name.trim(),
        description: description.trim(),
        price: amount,
        category,
        condition: isProperty ? null : condition,
        province,
        area: area.trim(),
        negotiable: negotiable === "Yes",
        handovers: [isProperty ? "Arrange a viewing" : handover],
        property_type: isProperty ? type : null,
        purpose: isProperty ? purpose : null,
        price_period: isProperty
          ? purpose === "For sale"
            ? "Total"
            : period
          : "Total",
        bedrooms: isProperty && type !== "Land & Lots" ? beds : null,
        size_sqm: isProperty ? sqm : null,
      };
      const body = new FormData();
      body.append("listing", JSON.stringify(fields));
      body.append("photo", new File(photo));
      const { data, error } = await getSupabaseClient().functions.invoke(
        "publish-listing",
        { body },
      );
      if (error) {
        let message =
          error.name === "FunctionsFetchError"
            ? "The photo could not be sent. Check your connection and retry without leaving this form."
            : "The server could not publish the listing. Please retry.";
        try {
          message = (await error.context.json()).error || message;
        } catch {}
        throw Error(message);
      }
      if (!data?.id)
        throw Error(
          "Publication was not confirmed. Retry without changing the form.",
        );
      Alert.alert(
        "Listing published",
        "Your listing is now visible in Explore.",
      );
      onPublished();
    } catch (error) {
      Alert.alert(
        "Not published",
        error instanceof Error ? error.message : "Please retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <Text style={ui.eyebrow}>MAKE ROOM FOR SOMETHING NEW</Text>
      <Text style={ui.title}>What are you selling?</Text>
      <Text style={ui.subtitle}>
        One pre-loved item or your business collection. Everyone has a place
        here.
      </Text>
      {photo && <Image source={{ uri: photo }} style={ui.detailPhoto} />}
      <View style={ui.choices}>
        <Button
          title="Take a photo"
          secondary
          disabled={busy}
          onPress={() => {
            void choose(true);
          }}
        />
        <Button
          title="Choose photo"
          secondary
          disabled={busy}
          onPress={() => {
            void choose(false);
          }}
        />
      </View>
      <Text style={ui.fieldLabel}>Title</Text>
      <TextInput
        accessibilityLabel="Shared listing title"
        style={ui.input}
        value={name}
        onChangeText={setName}
        maxLength={100}
      />
      <ChoiceField
        label="Category"
        values={marketplaceCategories.map((c) => c.name)}
        value={category}
        onChange={setCategory}
      />
      {isProperty ? (
        <>
          <ChoiceField
            label="Property type"
            values={propertyTypes}
            value={type}
            onChange={(v) => {
              setType(v);
              if (v === "Rooms") setPurpose("For rent");
            }}
          />
          <ChoiceField
            label="Purpose"
            values={purposesFor(type)}
            value={purpose}
            onChange={setPurpose}
          />
          {purpose !== "For sale" && (
            <ChoiceField
              label="Price period"
              values={["Per month", "Per week"]}
              value={period}
              onChange={setPeriod}
            />
          )}
          {type !== "Land & Lots" && (
            <>
              <Text style={ui.fieldLabel}>Bedrooms (optional)</Text>
              <TextInput
                style={ui.input}
                value={bedrooms}
                onChangeText={setBedrooms}
                keyboardType="number-pad"
              />
            </>
          )}
          <Text style={ui.fieldLabel}>Size in m² (optional)</Text>
          <TextInput
            style={ui.input}
            value={size}
            onChangeText={setSize}
            keyboardType="decimal-pad"
          />
        </>
      ) : (
        <ChoiceField
          label="Condition"
          values={["New", "Like new", "Good", "Fair"]}
          value={condition}
          onChange={setCondition}
        />
      )}
      <Text style={ui.fieldLabel}>
        Price in kina
        {isProperty && purpose !== "For sale"
          ? ` · ${period.toLowerCase()}`
          : ""}
      </Text>
      <TextInput
        style={ui.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <ChoiceField
        label="Open to offers"
        values={["No", "Yes"]}
        value={negotiable}
        onChange={setNegotiable}
      />
      <ProvinceField value={province} onChange={setProvince} />
      <Text style={ui.fieldLabel}>Town / suburb</Text>
      <TextInput
        style={ui.input}
        value={area}
        onChangeText={setArea}
        maxLength={80}
      />
      <Text style={ui.fieldLabel}>Description</Text>
      <TextInput
        style={[ui.input, { minHeight: 100 }]}
        multiline
        value={description}
        onChangeText={setDescription}
        maxLength={2000}
      />
      {!isProperty && (
        <ChoiceField
          label="Collection"
          values={["Public meetup", "Pickup"]}
          value={handover}
          onChange={setHandover}
        />
      )}
      <View style={ui.notice}>
        <Text style={ui.noticeText}>
          Publishing makes the listing and its general location visible to other
          users. Do not include a private home address or contact details.
          Payments are not connected.
        </Text>
      </View>
      <Button
        title={busy ? "Validating and publishing…" : "Publish test listing"}
        disabled={busy}
        onPress={publish}
      />
    </View>
  );
}
