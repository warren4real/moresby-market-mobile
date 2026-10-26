import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../components/Button";
import { ChoiceField } from "../components/ChoiceField";
import { getSupabaseClient } from "../services/supabase";
import { ui } from "../theme/marketplace";
import {
  fetchModerationQueue,
  fetchModerationReport,
  reviewConversation,
  decideReport,
  moderationError,
  type QueueReport,
  type ReportKind,
  type ModerationReport,
  type ReviewMessage,
  type ModerationAction,
} from "./moderationService";
const actionLabels: Record<string, string> = {
  opened_report: "Opened report",
  opened_conversation: "Viewed conversation",
  reviewed: "Marked reviewed",
  dismissed: "Dismissed report",
  removed_listing: "Removed listing",
};
export function ModerationDashboard({
  onBusyChange,
  onChanged,
}: {
  onBusyChange: (busy: boolean) => void;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<ReportKind>("listing"),
    [status, setStatus] = useState("pending"),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<QueueReport[]>([]),
    [more, setMore] = useState(false),
    [selected, setSelected] = useState<ModerationReport | null>(null),
    [photo, setPhoto] = useState(""),
    [messages, setMessages] = useState<ReviewMessage[]>([]),
    [older, setOlder] = useState(false),
    [note, setNote] = useState(""),
    [reviewReason, setReviewReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [visible, setVisible] = useState(AppState.currentState === "active");
  const alive = useRef(true),
    generation = useRef(0),
    locked = useRef(false),
    callbacks = useRef({ onBusyChange, onChanged });
  callbacks.current = { onBusyChange, onChanged };
  const lock = (value: boolean) => {
    locked.current = value;
    if (alive.current) setBusy(value);
    callbacks.current.onBusyChange(value);
  };
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", (state) => {
      const active = state === "active";
      generation.current++;
      setVisible(active);
      setSelected(null);
      setMessages([]);
      setRows([]);
      setPhoto("");
      setError("");
      if (active) setRevision((v) => v + 1);
    });
    return () => {
      alive.current = false;
      generation.current++;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (!visible) return;
    const token = ++generation.current;
    lock(true);
    setError("");
    setRows([]);
    void fetchModerationQueue(kind, status, page)
      .then((data) => {
        if (alive.current && token === generation.current) {
          setRows(data);
          setMore(data.length === 20);
        }
      })
      .catch((err) => {
        if (alive.current && token === generation.current)
          setError(moderationError(err));
      })
      .finally(() => {
        if (alive.current && token === generation.current) lock(false);
      });
    return () => {
      generation.current++;
    };
  }, [kind, status, page, revision, visible]);
  const changeFilter = (label: string) => {
    if (locked.current) return;
    generation.current++;
    setSelected(null);
    setMessages([]);
    setRows([]);
    setPage(0);
    if (label === "Listing reports" || label === "Conversation reports")
      setKind(label === "Listing reports" ? "listing" : "conversation");
    else setStatus(label.toLowerCase());
  };
  const open = async (id: string) => {
    if (locked.current) return;
    const token = ++generation.current;
    lock(true);
    setSelected(null);
    setMessages([]);
    setPhoto("");
    setNote("");
    setReviewReason("");
    setError("");
    try {
      const data = await fetchModerationReport(kind, id);
      if (!alive.current || token !== generation.current) return;
      setSelected(data);
      if (data.listing.image_path) {
        const result = await getSupabaseClient()
          .storage.from("market-listing-images")
          .createSignedUrl(data.listing.image_path, 600);
        if (alive.current && token === generation.current && !result.error)
          setPhoto(result.data.signedUrl);
      }
    } catch (err) {
      if (alive.current && token === generation.current)
        setError(moderationError(err));
    } finally {
      if (alive.current && token === generation.current) lock(false);
    }
  };
  const transcript = async (before: number | null = null) => {
    if (!selected || locked.current) return;
    const token = ++generation.current;
    lock(true);
    setError("");
    try {
      const data = await reviewConversation(
        selected.report.id,
        reviewReason,
        before,
      );
      if (alive.current && token === generation.current) {
        setMessages((old) =>
          before
            ? Array.from(
                new Map([...data, ...old].map((m) => [m.id, m])).values(),
              ).sort((a, b) => a.sequence - b.sequence)
            : data,
        );
        setOlder(data.length === 50);
      }
    } catch (err) {
      if (alive.current && token === generation.current) {
        setMessages([]);
        setError(
          (err as { code?: string }).code
            ? moderationError(err)
            : err instanceof Error
              ? err.message
              : moderationError(err),
        );
      }
    } finally {
      if (alive.current && token === generation.current) lock(false);
    }
  };
  const decide = async (action: ModerationAction) => {
    if (!selected || locked.current) return;
    const token = ++generation.current;
    lock(true);
    setError("");
    try {
      await decideReport(
        kind,
        selected.report.id,
        action,
        note,
        selected.report.status,
      );
      if (alive.current && token === generation.current) {
        setSelected(null);
        setMessages([]);
        setNote("");
        setPage(0);
        setRevision((v) => v + 1);
        callbacks.current.onChanged();
        Alert.alert(
          "Decision saved",
          action === "removed_listing"
            ? "The listing is removed and the decision is recorded."
            : "The report status and decision reason are recorded.",
        );
      }
    } catch (err) {
      if (alive.current && token === generation.current) {
        setMessages([]);
        setError(
          (err as { code?: string }).code
            ? moderationError(err)
            : err instanceof Error
              ? err.message
              : moderationError(err),
        );
      }
    } finally {
      if (alive.current && token === generation.current) lock(false);
    }
  };
  const confirmRemoval = () => {
    if (!selected || !note.trim()) {
      setError("Enter a decision reason first.");
      return;
    }
    Alert.alert(
      "Remove this listing?",
      `“${selected.listing.title}” will disappear from public searches. Its owner will not be able to reactivate it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove listing",
          style: "destructive",
          onPress: () => {
            void decide("removed_listing");
          },
        },
      ],
    );
  };
  if (!visible)
    return (
      <View style={ui.content}>
        <Text style={ui.subtitle}>
          Moderation content is hidden while the app is inactive.
        </Text>
      </View>
    );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[ui.content, { gap: 14 }]}
    >
      <Text style={ui.title}>Moderation</Text>
      <Text style={ui.small}>
        Operator-only review. Access to report details and conversations is
        recorded. Keep private report and message content confidential.
      </Text>
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={ui.subtitle}>
          {error}
        </Text>
      )}
      {selected ? (
        <>
          <Button
            title="← Back to reports"
            secondary
            disabled={busy}
            onPress={() => {
              generation.current++;
              setSelected(null);
              setMessages([]);
              setPhoto("");
              setRevision((v) => v + 1);
            }}
          />
          <Text style={ui.section}>{selected.report.reason}</Text>
          <Text style={ui.small}>
            {selected.report.status} ·{" "}
            {new Date(selected.report.created_at).toLocaleString()}
          </Text>
          <Text style={ui.subtitle}>
            {selected.report.details || "No additional details supplied."}
          </Text>
          <Text style={ui.section}>Related listing</Text>
          {!!photo && <Image source={{ uri: photo }} style={ui.detailPhoto} />}
          <Text style={ui.section}>{selected.listing.title}</Text>
          <Text style={ui.small}>
            {selected.listing.seller_name || "Member"} · K{" "}
            {Number(selected.listing.price).toFixed(2)} ·{" "}
            {selected.listing.status}
          </Text>
          <Text style={ui.subtitle}>{selected.listing.description}</Text>
          {selected.listing.moderation_removed && (
            <Text style={ui.small}>
              This listing has already been removed by moderation.
            </Text>
          )}
          {kind === "conversation" && (
            <View style={ui.panel}>
              <Text style={ui.section}>Reported conversation</Text>
              <Text style={ui.small}>
                Viewing messages requires a reason. Each page opened is logged
                against your moderator account.
              </Text>
              <TextInput
                accessibilityLabel="Conversation review reason"
                style={ui.input}
                placeholder="Why do you need to view these messages?"
                multiline
                maxLength={300}
                value={reviewReason}
                onChangeText={setReviewReason}
                editable={!busy}
              />
              <Button
                title="View reported conversation"
                secondary
                disabled={busy || !reviewReason.trim()}
                onPress={() => {
                  void transcript();
                }}
              />
              {older && messages.length > 0 && (
                <Button
                  title="View older messages"
                  secondary
                  disabled={busy || !reviewReason.trim()}
                  onPress={() => {
                    void transcript(messages[0].sequence);
                  }}
                />
              )}
              {messages.map((m) => (
                <View key={m.id} style={{ paddingVertical: 12 }}>
                  <Text style={ui.fieldLabel}>
                    {m.sender_name || "Member"} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </Text>
                  <Text style={ui.subtitle}>{m.body}</Text>
                </View>
              ))}
            </View>
          )}
          {selected.report.status === "pending" && (
            <View style={ui.panel}>
              <Text style={ui.section}>Record a decision</Text>
              <Text style={ui.small}>
                Reviewed keeps the listing unchanged. Dismissed closes the
                report without action. Removal hides the related listing. Your
                reason is recorded for other moderators.
              </Text>
              <TextInput
                accessibilityLabel="Moderation decision reason"
                style={[ui.input, { minHeight: 100 }]}
                placeholder="Decision reason"
                multiline
                maxLength={1000}
                value={note}
                onChangeText={setNote}
                editable={!busy}
              />
              <Button
                title="Mark reviewed — no removal"
                disabled={busy || !note.trim()}
                onPress={() => {
                  void decide("reviewed");
                }}
              />
              <Button
                title="Dismiss report"
                secondary
                disabled={busy || !note.trim()}
                onPress={() => {
                  void decide("dismissed");
                }}
              />
              <Button
                title={
                  kind === "conversation"
                    ? "Remove related listing"
                    : "Remove listing"
                }
                secondary
                disabled={busy || !note.trim()}
                onPress={confirmRemoval}
              />
            </View>
          )}
          <Text style={ui.section}>Review history</Text>
          {selected.history.map((entry, i) => (
            <View key={i} style={ui.panel}>
              <Text style={ui.fieldLabel}>
                {actionLabels[entry.action] || entry.action}
              </Text>
              <Text style={ui.small}>
                {entry.moderator_name || "Former operator"} ·{" "}
                {new Date(entry.created_at).toLocaleString()}
              </Text>
              <Text style={ui.subtitle}>{entry.note}</Text>
            </View>
          ))}
        </>
      ) : (
        <>
          <ChoiceField
            label="Report type"
            values={["Listing reports", "Conversation reports"]}
            value={
              kind === "listing" ? "Listing reports" : "Conversation reports"
            }
            onChange={changeFilter}
          />
          <ChoiceField
            label="Queue"
            values={["Pending", "Reviewed", "Dismissed"]}
            value={status[0].toUpperCase() + status.slice(1)}
            onChange={changeFilter}
          />
          <Button
            title={busy ? "Loading…" : "Refresh reports"}
            secondary
            disabled={busy}
            onPress={() => setRevision((v) => v + 1)}
          />
          {!busy && !rows.length && !error && (
            <Text style={ui.subtitle}>No reports in this queue.</Text>
          )}
          {rows.map((row) => (
            <View key={row.id} style={ui.panel}>
              <Text style={ui.section}>{row.target_label}</Text>
              <Text style={ui.fieldLabel}>{row.reason}</Text>
              <Text style={ui.small}>
                Reported by {row.reporter_name || "Member"} ·{" "}
                {new Date(row.created_at).toLocaleString()}
              </Text>
              <Text numberOfLines={3} style={ui.subtitle}>
                {row.details || "No additional details."}
              </Text>
              <Button
                title="Review report"
                secondary
                disabled={busy}
                onPress={() => {
                  void open(row.id);
                }}
              />
            </View>
          ))}
          <View style={{ gap: 8 }}>
            {page > 0 && (
              <Button
                title="Previous page"
                secondary
                disabled={busy}
                onPress={() => setPage((v) => v - 1)}
              />
            )}{" "}
            {more && (
              <Button
                title="Next page"
                secondary
                disabled={busy}
                onPress={() => setPage((v) => v + 1)}
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
