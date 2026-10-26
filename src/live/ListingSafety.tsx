import React, { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { ChoiceField } from "../components/ChoiceField";
import { getSupabaseClient } from "../services/supabase";
import { ui } from "../theme/marketplace";
import type { LiveListing } from "./listings";
const reasons = [
  "Suspected scam",
  "Prohibited item",
  "Offensive content",
  "Misleading listing",
  "Other",
];
export function ListingSafety({
  listing,
  userId,
  onSignIn,
  onBlocked,
}: {
  listing: LiveListing;
  userId?: string;
  onSignIn: () => void;
  onBlocked: () => void;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(reasons[0]),
    [details, setDetails] = useState(""),
    [busy, setBusy] = useState(false);
  const report = async () => {
    if (!userId) {
      onSignIn();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const result = await getSupabaseClient()
        .from("listing_reports")
        .insert({
          reporter_id: userId,
          listing_id: listing.id,
          reason,
          details: details.trim(),
        });
      if (result.error) {
        if (result.error.code === "23505") {
          Alert.alert(
            "Already reported",
            "Your report for this listing is already recorded.",
          );
          setOpen(false);
          return;
        }
        throw result.error;
      }
      setOpen(false);
      setDetails("");
      Alert.alert(
        "Report submitted",
        "Saved for manual review. Reports do not automatically remove a listing.",
      );
    } catch {
      Alert.alert(
        "Report not submitted",
        "Check your connection and sign-in, or try again later. Reports are limited to 30 per day.",
      );
    } finally {
      setBusy(false);
    }
  };
  const block = () => {
    if (!userId) {
      onSignIn();
      return;
    }
    Alert.alert(
      "Block this seller?",
      "Their listings will be hidden from your signed-in account, and yours from theirs. You can unblock them in Me → Safety & account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                const result = await getSupabaseClient()
                  .from("account_blocks")
                  .insert({
                    blocker_id: userId,
                    blocked_id: listing.owner_id,
                    blocked_name: listing.seller?.display_name || "Seller",
                  });
                if (result.error && result.error.code !== "23505")
                  throw result.error;
                onBlocked();
              } catch {
                Alert.alert(
                  "Could not block",
                  "Check your connection and sign-in, then retry.",
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };
  return (
    <View style={{ gap: 12, marginTop: 24 }}>
      <Button
        title="Report listing"
        secondary
        disabled={busy}
        onPress={() => {
          if (!userId) onSignIn();
          else setOpen(!open);
        }}
      />
      {open && (
        <View style={ui.panel}>
          <Text style={ui.section}>Report this listing</Text>
          <ChoiceField
            label="Reason"
            values={reasons}
            value={reason}
            onChange={setReason}
          />
          <Text style={ui.fieldLabel}>Details (optional)</Text>
          <TextInput
            accessibilityLabel="Report details"
            style={[ui.input, { minHeight: 100 }]}
            multiline
            maxLength={1000}
            value={details}
            onChangeText={setDetails}
            editable={!busy}
          />
          <Text style={ui.small}>
            Only you and the app operator can read this report. Do not include
            passwords, payment details or private addresses. Manual review has
            no guaranteed response time during testing.
          </Text>
          <Button
            title={busy ? "Submitting…" : "Submit report"}
            disabled={busy}
            onPress={report}
          />
          <Button
            title="Cancel report"
            secondary
            disabled={busy}
            onPress={() => setOpen(false)}
          />
        </View>
      )}
      <Button title="Block seller" secondary disabled={busy} onPress={block} />
    </View>
  );
}
