import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { UnreadBadge } from "../components/UnreadBadge";
import { suggestedBuyerMessages } from "../data/demoProfiles";
import { Button } from "../components/Button";
import { ChoiceField } from "../components/ChoiceField";
import { getSupabaseClient } from "../services/supabase";
import { ui, palette } from "../theme/marketplace";
import {
  chatRequestId,
  mergeChatMessages,
  sendChatMessage,
  type ChatMessage,
  type ChatSummary,
} from "./chatService";
import type { useChatInbox } from "./useChatInbox";
const privacy =
  "Messages are stored on our servers. Only participants can access them in the app. Authorized operators can review stored messages for support and reports. This chat is not end-to-end encrypted.";
type Draft = { text: string; requestId: string; sentText: string };
export function LiveChats({
  userId,
  active,
  conversationId,
  onSelect,
  inbox,
}: {
  userId: string;
  active: boolean;
  conversationId: string | null;
  onSelect: (id: string | null) => void;
  inbox: ReturnType<typeof useChatInbox>;
}) {
  const drafts = useRef<Record<string, Draft>>({});
  if (conversationId)
    return (
      <ChatThread
        key={conversationId}
        id={conversationId}
        userId={userId}
        active={active}
        initialDraft={drafts.current[conversationId]}
        onDraft={(draft) => {
          drafts.current[conversationId] = draft;
        }}
        onBack={() => onSelect(null)}
        onChanged={inbox.refresh}
      />
    );
  return (
    <ScrollView contentContainerStyle={ui.content}>
      <Text style={ui.eyebrow}>GOOD DEALS START WITH A HELLO</Text>
      <Text style={ui.title}>Your conversations</Text>
      <View style={ui.notice}>
        <Text style={ui.noticeText}>{privacy}</Text>
      </View>
      <Button
        title={inbox.busy ? "Refreshing…" : "Refresh chats"}
        secondary
        onPress={inbox.refresh}
      />
      {!!inbox.error && <Text style={ui.subtitle}>{inbox.error}</Text>}
      {!inbox.rows.length && !inbox.busy && !inbox.error && (
        <Text style={ui.subtitle}>
          No conversations yet. Open another seller’s available listing and tap
          Message seller.
        </Text>
      )}
      {inbox.rows.map((chat) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chat with ${chat.other_name || "Member"}${Number(chat.unread_count) ? ", unread messages" : ""}`}
          key={chat.id}
          style={ui.menuRow}
          onPress={() => onSelect(chat.id)}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={ui.section}>{chat.other_name || "Member"}</Text>
            <Text style={ui.small}>
              {chat.listing_title || "Listing no longer available"}
            </Text>
            <Text numberOfLines={2} style={ui.subtitle}>
              {chat.last_body || "Start the conversation"}
            </Text>
          </View>
          <UnreadBadge count={Number(chat.unread_count)} />
        </Pressable>
      ))}
      {inbox.more && (
        <Button
          title="Load more conversations"
          secondary
          disabled={inbox.busy}
          onPress={inbox.loadMore}
        />
      )}
    </ScrollView>
  );
}
function ChatThread({
  id,
  userId,
  active,
  initialDraft,
  onDraft,
  onBack,
  onChanged,
}: {
  id: string;
  userId: string;
  active: boolean;
  initialDraft?: Draft;
  onDraft: (draft: Draft) => void;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [chat, setChat] = useState<ChatSummary | null>(null),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [text, setText] = useState(initialDraft?.text || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [locked, setLocked] = useState(false),
    [revision, setRevision] = useState(0),
    [older, setOlder] = useState(false),
    [loadingOlder, setLoadingOlder] = useState(false),
    [reportOpen, setReportOpen] = useState(false),
    [reason, setReason] = useState("Suspected scam"),
    [details, setDetails] = useState("");
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null),
    pending = useRef({
      id: initialDraft?.requestId || "",
      text: initialDraft?.sentText || "",
    }),
    latest = useRef(messages),
    alive = useRef(true),
    foreground = useRef(AppState.currentState === "active"),
    atBottom = useRef(true),
    marking = useRef(false),
    lastMarked = useRef(""),
    callbacks = useRef({ onDraft, onChanged });
  callbacks.current = { onDraft, onChanged };
  latest.current = messages;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    callbacks.current.onDraft({
      text,
      requestId: pending.current.id,
      sentText: pending.current.text,
    });
  }, [text]);
  const markRead = async () => {
    if (!active || !foreground.current || !atBottom.current || marking.current)
      return;
    const last = latest.current.at(-1);
    if (!last || last.id === lastMarked.current) return;
    marking.current = true;
    try {
      const result = await getSupabaseClient().rpc("mark_chat_read", {
        target: id,
        last_message: last.id,
      });
      if (!result.error) {
        lastMarked.current = last.id;
        callbacks.current.onChanged();
      }
    } finally {
      marking.current = false;
    }
  };
  useEffect(() => {
    if (active && !locked) void markRead().catch(() => {});
  }, [messages, active, locked]);
  useEffect(() => {
    if (!active) return;
    let valid = true,
      inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      if (!valid || inFlight || !foreground.current) return;
      inFlight = true;
      try {
        const client = getSupabaseClient();
        const summary = await client
          .from("chat_inbox")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (summary.error) throw summary.error;
        if (!summary.data) {
          if (valid) {
            setLocked(true);
            setMessages([]);
            setChat(null);
            setError(
              "This conversation is no longer accessible. An account may have been blocked, deleted or signed out.",
            );
          }
          return;
        }
        let replies: string[] = [];
        if (summary.data.buyer_id === userId) {
          const listing = await client
            .from("listings")
            .select("category,negotiable")
            .eq("id", summary.data.listing_id)
            .maybeSingle();
          replies = suggestedBuyerMessages({
            property: listing.data?.category === "Property",
            negotiable: listing.data?.negotiable === true,
          });
        }
        const result = await client
          .from("chat_messages")
          .select("*")
          .eq("conversation_id", id)
          .order("sequence", { ascending: false })
          .limit(50);
        if (result.error) throw result.error;
        if (valid) {
          setChat(summary.data as ChatSummary);
          setSuggestions(replies);
          setLocked(false);
          setError("");
          setMessages((old) =>
            mergeChatMessages(old, (result.data || []) as ChatMessage[]),
          );
          if (!latest.current.length) setOlder(result.data?.length === 50);
        }
      } catch {
        if (valid)
          setError(
            "Could not refresh this chat. Your unsent message is kept here. Retry when connected.",
          );
      } finally {
        inFlight = false;
      }
    };
    const start = () => {
      if (timer) clearInterval(timer);
      void load();
      timer = setInterval(() => {
        void load();
      }, 5000);
    };
    foreground.current = AppState.currentState === "active";
    if (foreground.current) start();
    const sub = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active";
      if (foreground.current) start();
      else if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    });
    return () => {
      valid = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [id, active, revision]);
  const loadOlder = async () => {
    const first = messages[0];
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    atBottom.current = false;
    try {
      const result = await getSupabaseClient()
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", id)
        .lt("sequence", first.sequence)
        .order("sequence", { ascending: false })
        .limit(50);
      if (result.error) throw result.error;
      if (alive.current) {
        setMessages((old) =>
          mergeChatMessages(old, (result.data || []) as ChatMessage[]),
        );
        setOlder(result.data?.length === 50);
      }
    } catch {
      if (alive.current)
        setError("Older messages could not load. Please retry.");
    } finally {
      if (alive.current) setLoadingOlder(false);
    }
  };
  const send = async () => {
    if (
      busy ||
      locked ||
      !chat ||
      chat.listing_status === null ||
      chat.listing_status === "removed"
    )
      return;
    const body = text.trim();
    if (!body || body.length > 2000) return;
    if (pending.current.text !== body || !pending.current.id)
      pending.current = { id: chatRequestId(), text: body };
    callbacks.current.onDraft({
      text,
      requestId: pending.current.id,
      sentText: body,
    });
    setBusy(true);
    setError("");
    try {
      const message = await sendChatMessage(
        id,
        userId,
        body,
        pending.current.id,
      );
      if (alive.current) {
        atBottom.current = true;
        setMessages((old) => mergeChatMessages(old, [message]));
        pending.current = { id: "", text: "" };
        setText("");
        callbacks.current.onChanged();
      }
    } catch {
      if (alive.current)
        setError(
          "Message not confirmed. Check your connection or sign-in and retry. Blocking, a removed listing or sending limits can also stop delivery.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const block = () => {
    if (!chat) return;
    Alert.alert(
      "Block this member?",
      "This conversation and your listings will be hidden from each other while signed in. Unblock in Me → Safety & account.",
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
                    blocked_id: chat.other_id,
                    blocked_name: chat.other_name || "Member",
                  });
                if (result.error && result.error.code !== "23505")
                  throw result.error;
                callbacks.current.onChanged();
                onBack();
              } catch {
                if (alive.current)
                  setError("Could not block. Check your connection and retry.");
              } finally {
                if (alive.current) setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };
  const report = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await getSupabaseClient()
        .from("conversation_reports")
        .insert({
          reporter_id: userId,
          conversation_id: id,
          reason,
          details: details.trim(),
        });
      if (result.error && result.error.code !== "23505") throw result.error;
      setReportOpen(false);
      setDetails("");
      Alert.alert(
        "Report recorded",
        "Authorized operators can review this conversation. Reports await manual review.",
      );
    } catch {
      setError(
        "Could not report this conversation. Check your connection and retry later.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          padding: 16,
          gap: 8,
          borderBottomWidth: 1,
          borderColor: palette.line,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to all chats"
            disabled={busy}
            onPress={onBack}
            style={{ minHeight: 48, minWidth: 80, justifyContent: "center" }}
          >
            <Text style={ui.link}>← All chats</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={ui.section}>
              {chat?.other_name || "Conversation"}
            </Text>
            <Text numberOfLines={1} style={ui.small}>
              {chat?.listing_title || "Listing no longer available"}
            </Text>
          </View>
        </View>
        <Text style={ui.small}>
          Standard private chat · Operator access for support and reports · No
          end-to-end encryption
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12 }}
        scrollEventThrottle={100}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
          atBottom.current =
            contentOffset.y + layoutMeasurement.height >=
            contentSize.height - 40;
          if (atBottom.current) void markRead().catch(() => {});
        }}
        onContentSizeChange={() => {
          if (atBottom.current)
            scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        {!!error && (
          <Text accessibilityLiveRegion="polite" style={ui.subtitle}>
            {error}
          </Text>
        )}
        <Button
          title="Refresh conversation"
          secondary
          onPress={() => setRevision((v) => v + 1)}
        />
        {!locked && (
          <View style={{ gap: 10 }}>
            <Button
              title="Report conversation"
              secondary
              disabled={busy || !chat}
              onPress={() => setReportOpen(!reportOpen)}
            />
            <Button
              title="Block member"
              secondary
              disabled={busy || !chat}
              onPress={block}
            />
          </View>
        )}
        {reportOpen && (
          <View style={ui.panel}>
            <ChoiceField
              label="Reason"
              values={[
                "Suspected scam",
                "Harassment or threats",
                "Spam",
                "Other",
              ]}
              value={reason}
              onChange={setReason}
            />
            <TextInput
              accessibilityLabel="Conversation report details"
              style={ui.input}
              placeholder="Details (optional)"
              multiline
              maxLength={1000}
              value={details}
              onChangeText={setDetails}
            />
            <Text style={ui.small}>
              The operator can review recent messages in this conversation. Do
              not add passwords or payment credentials.
            </Text>
            <Button
              title="Submit conversation report"
              disabled={busy}
              onPress={report}
            />
            <Button
              title="Cancel report"
              secondary
              disabled={busy}
              onPress={() => setReportOpen(false)}
            />
          </View>
        )}
        {older && !locked && (
          <Button
            title={loadingOlder ? "Loading…" : "Load older messages"}
            secondary
            disabled={loadingOlder}
            onPress={loadOlder}
          />
        )}
        {!messages.length && !locked && chat && (
          <Text style={ui.subtitle}>Say hello and ask about the listing.</Text>
        )}
        {messages.map((message) => (
          <View
            key={message.id}
            style={{
              alignSelf:
                message.sender_id === userId ? "flex-end" : "flex-start",
              backgroundColor:
                message.sender_id === userId ? palette.mint : palette.wash,
              padding: 14,
              borderRadius: 16,
              maxWidth: "90%",
            }}
          >
            <Text style={{ color: palette.ink, fontSize: 16 }} selectable>
              {message.body}
            </Text>
            <Text style={[ui.small, { marginTop: 6 }]}>
              {message.sender_id === userId
                ? "You"
                : chat?.other_name || "Member"}{" "}
              · {new Date(message.created_at).toLocaleString()}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View
        style={{
          padding: 12,
          gap: 8,
          borderTopWidth: 1,
          borderColor: palette.line,
        }}
      >
        {(locked ||
          !chat?.listing_status ||
          chat.listing_status === "removed") && (
          <Text style={ui.small}>
            Sending is unavailable for this conversation or listing.
          </Text>
        )}
        {!locked &&
          chat?.buyer_id === userId &&
          !!chat.listing_status &&
          chat.listing_status !== "removed" &&
          suggestions.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={ui.small}>Quick replies · tap to edit</Text>
              <ScrollView
                horizontal
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                {suggestions.map((reply) => (
                  <Pressable
                    key={reply}
                    accessibilityRole="button"
                    accessibilityLabel={`Use suggested message: ${reply}`}
                    disabled={busy}
                    style={ui.pill}
                    onPress={() => setText(reply)}
                  >
                    <Text style={ui.pillText}>{reply}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        <TextInput
          accessibilityLabel="Message text"
          style={[ui.input, { minHeight: 48, maxHeight: 130 }]}
          placeholder="Write a message…"
          multiline
          maxLength={2000}
          value={text}
          onChangeText={setText}
          editable={!busy && !locked}
        />
        <Button
          title={busy ? "Sending…" : "Send message"}
          disabled={
            busy ||
            locked ||
            !chat?.listing_status ||
            chat.listing_status === "removed" ||
            !text.trim()
          }
          onPress={send}
        />
      </View>
    </View>
  );
}
