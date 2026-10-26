import { getSupabaseClient } from "../services/supabase";
export type ChatSummary = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  other_id: string;
  other_name: string | null;
  listing_title: string | null;
  listing_status: string | null;
  last_body: string | null;
  last_at: string;
  unread_count: number;
};
export type ChatMessage = {
  id: string;
  sequence: number;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
// A client request identifier only, never an authentication secret.
export function chatRequestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}
export function mergeChatMessages(old: ChatMessage[], fresh: ChatMessage[]) {
  return Array.from(
    new Map([...old, ...fresh].map((m) => [m.id, m])).values(),
  ).sort((a, b) => a.sequence - b.sequence);
}
export async function startChat(listingId: string, userId: string) {
  const client = getSupabaseClient();
  const existing = await client
    .from("chat_conversations")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id as string;
  const result = await client
    .from("chat_conversations")
    .insert({ listing_id: listingId, buyer_id: userId })
    .select("id")
    .single();
  if (result.error) {
    if (result.error.code === "23505") {
      const retry = await client
        .from("chat_conversations")
        .select("id")
        .eq("listing_id", listingId)
        .eq("buyer_id", userId)
        .single();
      if (!retry.error && retry.data) return retry.data.id as string;
    }
    throw result.error;
  }
  return result.data.id as string;
}
export async function sendChatMessage(
  conversationId: string,
  userId: string,
  text: string,
  id: string,
) {
  const body = text.trim();
  if (!body || body.length > 2000)
    throw Error("Enter a message of 1–2000 characters.");
  const client = getSupabaseClient();
  const result = await client
    .from("chat_messages")
    .insert({ id, conversation_id: conversationId, sender_id: userId, body })
    .select("*")
    .single();
  if (result.error) {
    // A lost response can leave a committed message. Retry the same ID; never
    // treat someone else's UUID or different content as this user's send.
    if (result.error.code === "23505") {
      const prior = await client
        .from("chat_messages")
        .select("*")
        .eq("id", id)
        .eq("conversation_id", conversationId)
        .eq("sender_id", userId)
        .eq("body", body)
        .single();
      if (!prior.error && prior.data) return prior.data as ChatMessage;
    }
    throw result.error;
  }
  return result.data as ChatMessage;
}
