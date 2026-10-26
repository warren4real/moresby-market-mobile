import React, { useEffect, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { Button } from "../components/Button";
import { getSupabaseClient } from "../services/supabase";
import { ui } from "../theme/marketplace";
type Block = { blocked_id: string; blocked_name: string };
type Report = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
};
export function AccountSafety({
  userId,
  onChanged,
  onBusyChange,
}: {
  userId: string;
  onChanged: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [notice, setNotice] = useState("");
  const client = getSupabaseClient();
  const lock = (value: boolean) => {
    setBusy(value);
    onBusyChange(value);
  };
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const [blocked, reported, chatReported] = await Promise.all([
          client
            .from("account_blocks")
            .select("blocked_id,blocked_name")
            .order("created_at", { ascending: false }),
          client
            .from("listing_reports")
            .select("id,reason,status,created_at")
            .order("created_at", { ascending: false })
            .limit(30),
          client
            .from("conversation_reports")
            .select("id,reason,status,created_at")
            .order("created_at", { ascending: false })
            .limit(30),
        ]);
        if (blocked.error || reported.error || chatReported.error)
          throw Error();
        if (alive) {
          setBlocks(blocked.data || []);
          setReports(
            [...(reported.data || []), ...(chatReported.data || [])]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 30),
          );
        }
      } catch {
        if (alive)
          setError(
            "Could not load your safety settings. Retry or sign in again.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, revision]);
  const unblock = async (id: string) => {
    if (busy) return;
    lock(true);
    try {
      const result = await client
        .from("account_blocks")
        .delete()
        .eq("blocker_id", userId)
        .eq("blocked_id", id)
        .select("blocked_id")
        .single();
      if (result.error) throw result.error;
      setRevision((v) => v + 1);
      onChanged();
    } catch {
      Alert.alert(
        "Could not unblock",
        "Check your connection and sign-in, then retry.",
      );
    } finally {
      lock(false);
    }
  };
  const remove = () => {
    if (busy) return;
    if (confirmation !== "DELETE" || !password) {
      setNotice("Type DELETE and enter your current password.");
      return;
    }
    Alert.alert(
      "Permanently delete your account?",
      "This removes your account, public profile, listings, photos, saved items, blocks, conversations, messages and reports involving your listings or submitted by you. This cannot be undone.",
      [
        { text: "Keep account", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            void (async () => {
              lock(true);
              setNotice("");
              try {
                const result = await client.functions.invoke("delete-account", {
                  body: { confirmation, password },
                });
                if (result.error) {
                  let message =
                    "Deletion was not confirmed. Check your connection. If sign-in no longer works, ask the app operator to check cleanup.";
                  try {
                    message =
                      (await result.error.context.json()).error || message;
                  } catch {}
                  throw Error(message);
                }
                if (!result.data?.deleted)
                  throw Error("Deletion was not confirmed.");
                setPassword("");
                setConfirmation("");
                const out = await client.auth.signOut({ scope: "local" });
                if (out.error)
                  throw Error(
                    "Your account was deleted. Restart the app to clear the remaining local sign-in.",
                  );
                Alert.alert(
                  "Account deleted",
                  "Your shared marketplace account and its data have been removed. The separate offline demo is unchanged.",
                );
              } catch (error) {
                setNotice(
                  error instanceof Error
                    ? error.message
                    : "Deletion could not finish.",
                );
              } finally {
                setPassword("");
                lock(false);
              }
            })();
          },
        },
      ],
    );
  };
  return (
    <View style={{ gap: 16 }}>
      <Text style={ui.title}>Safety & account</Text>
      <Text style={ui.section}>Blocked sellers</Text>
      <Text style={ui.small}>
        Blocking hides listings both ways while signed in. Public listings can
        still be viewed when signed out. Existing photo links may work for up to
        ten minutes. It does not affect the separate offline demo.
      </Text>
      {loading ? (
        <Text style={ui.small}>Loading…</Text>
      ) : error ? (
        <>
          <Text style={ui.subtitle}>{error}</Text>
          <Button
            title="Retry"
            secondary
            onPress={() => setRevision((v) => v + 1)}
          />
        </>
      ) : (
        <>
          {!blocks.length && (
            <Text style={ui.small}>You have not blocked anyone.</Text>
          )}
          {blocks.map((block) => (
            <View key={block.blocked_id} style={ui.panel}>
              <Text style={ui.section}>{block.blocked_name}</Text>
              <Button
                title="Unblock seller"
                secondary
                disabled={busy}
                onPress={() => {
                  void unblock(block.blocked_id);
                }}
              />
            </View>
          ))}
          <Text style={ui.section}>Your recent reports</Text>
          {!reports.length && (
            <Text style={ui.small}>No reports submitted.</Text>
          )}
          {reports.map((report) => (
            <View key={report.id} style={ui.panel}>
              <Text style={ui.fieldLabel}>{report.reason}</Text>
              <Text style={ui.small}>
                {report.status} ·{" "}
                {new Date(report.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </>
      )}
      <Text style={ui.section}>Delete account</Text>
      <Text style={ui.small}>
        Permanently removes your shared account, conversations (for both
        participants) and marketplace data. Your listings are hidden and all
        sessions revoked before cleanup. This cannot be undone. Previously
        downloaded copies or device caches cannot be recalled.
      </Text>
      {!deleting ? (
        <Button
          title="Delete my account…"
          secondary
          disabled={busy}
          onPress={() => setDeleting(true)}
        />
      ) : (
        <>
          <Text style={ui.fieldLabel}>Current password</Text>
          <TextInput
            accessibilityLabel="Deletion password"
            style={ui.input}
            secureTextEntry
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />
          <Text style={ui.fieldLabel}>Type DELETE to confirm</Text>
          <TextInput
            accessibilityLabel="Deletion confirmation"
            style={ui.input}
            autoCapitalize="characters"
            autoCorrect={false}
            value={confirmation}
            onChangeText={setConfirmation}
            editable={!busy}
          />
          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={ui.subtitle}>
              {notice}
            </Text>
          )}
          <Button
            title={busy ? "Deleting…" : "Permanently delete account"}
            disabled={busy}
            onPress={remove}
          />
          <Button
            title="Cancel deletion"
            secondary
            disabled={busy}
            onPress={() => {
              setDeleting(false);
              setPassword("");
              setConfirmation("");
              setNotice("");
            }}
          />
        </>
      )}
    </View>
  );
}
