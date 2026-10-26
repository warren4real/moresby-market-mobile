import React, { useState } from "react";
import { Alert, Image, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { File } from "expo-file-system";
import { Button } from "../components/Button";
import { getSupabaseClient } from "../services/supabase";
import { ui } from "../theme/marketplace";
import type { LiveListing } from "./listings";
import { listingEditPayload } from "./listingEdits";
export function LiveEdit({
  listing,
  onSaved,
  onCancel,
  onBusyChange,
}: {
  listing: LiveListing;
  onSaved: () => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [title, setTitle] = useState(listing.title),
    [description, setDescription] = useState(listing.description),
    [price, setPrice] = useState(String(listing.price)),
    [photo, setPhoto] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = (value: boolean) => {
    setBusy(value);
    onBusyChange(value);
  };
  const choose = async (camera: boolean) => {
    if (busy) return;
    lock(true);
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo permission",
          "Allow access in phone settings, then retry.",
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
    } catch {
      Alert.alert(
        "Photo could not be prepared",
        "Choose another photo or try again.",
      );
    } finally {
      lock(false);
    }
  };
  const save = async () => {
    if (busy) return;
    lock(true);
    try {
      const fields = listingEditPayload(listing, title, description, price);
      const body = new FormData();
      body.append("listing", JSON.stringify(fields));
      if (photo) body.append("photo", new File(photo));
      const { data, error } = await getSupabaseClient().functions.invoke(
        "edit-listing",
        { body },
      );
      if (error) {
        let message =
          "Changes could not be saved. Check your connection and retry.";
        try {
          message = (await error.context.json()).error || message;
        } catch {}
        throw Error(message);
      }
      if (!data?.id)
        throw Error(
          "The save was not confirmed. Refresh listings before retrying.",
        );
      onSaved();
      Alert.alert(
        "Listing updated",
        "Your changes are now saved to the marketplace.",
      );
    } catch (error) {
      Alert.alert(
        "Changes not saved",
        error instanceof Error ? error.message : "Please retry.",
      );
    } finally {
      lock(false);
    }
  };
  return (
    <View>
      <Text style={ui.title}>Edit listing</Text>
      <Text style={ui.subtitle}>
        Update your title, price, description or photo. Your current
        availability stays the same.
      </Text>
      {!!(photo || listing.imageUrl) && (
        <Image
          source={{ uri: photo || listing.imageUrl }}
          style={ui.detailPhoto}
        />
      )}
      <View style={ui.choices}>
        <Button
          title="Take replacement photo"
          secondary
          disabled={busy}
          onPress={() => {
            void choose(true);
          }}
        />
        <Button
          title="Choose replacement photo"
          secondary
          disabled={busy}
          onPress={() => {
            void choose(false);
          }}
        />
        {!!photo && (
          <Button
            title="Keep original photo"
            secondary
            disabled={busy}
            onPress={() => setPhoto("")}
          />
        )}
      </View>
      <Text style={ui.fieldLabel}>Title</Text>
      <TextInput
        accessibilityLabel="Edit listing title"
        style={ui.input}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        editable={!busy}
      />
      <Text style={ui.fieldLabel}>
        Price in kina
        {listing.price_period !== "Total"
          ? ` · ${listing.price_period.toLowerCase()}`
          : ""}
      </Text>
      <TextInput
        accessibilityLabel="Edit listing price"
        style={ui.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        editable={!busy}
      />
      <Text style={ui.fieldLabel}>Description</Text>
      <TextInput
        accessibilityLabel="Edit listing description"
        style={[ui.input, { minHeight: 120 }]}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        editable={!busy}
      />
      <Button
        title={busy ? "Saving…" : "Save changes"}
        disabled={busy}
        onPress={save}
      />
      <Button
        title="Cancel editing"
        secondary
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}
