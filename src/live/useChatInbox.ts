import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { getSupabaseClient } from "../services/supabase";
import type { ChatSummary } from "./chatService";
export function useChatInbox(userId?: string) {
  const [rows, setRows] = useState<ChatSummary[]>([]),
    [unread, setUnread] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [limit, setLimit] = useState(20),
    [more, setMore] = useState(false),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!userId) {
      setRows([]);
      setUnread(0);
      return;
    }
    let alive = true,
      inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      if (inFlight || !alive || AppState.currentState !== "active") return;
      inFlight = true;
      setBusy(true);
      try {
        const client = getSupabaseClient();
        const [list, count] = await Promise.all([
          client
            .from("chat_inbox")
            .select("*")
            .order("last_at", { ascending: false })
            .order("id", { ascending: false })
            .range(0, limit - 1),
          client.rpc("chat_unread_count"),
        ]);
        if (list.error || count.error) throw Error();
        if (alive) {
          setRows((list.data || []) as ChatSummary[]);
          setUnread(Number(count.data) || 0);
          setMore(list.data?.length === limit);
          setError("");
        }
      } catch {
        if (alive)
          setError(
            "Chats could not refresh. Check your connection and sign-in.",
          );
      } finally {
        inFlight = false;
        if (alive) setBusy(false);
      }
    };
    const start = () => {
      if (timer) clearInterval(timer);
      void load();
      timer = setInterval(() => {
        void load();
      }, 5000);
    };
    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    });
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [userId, limit, revision]);
  return {
    rows,
    unread,
    error,
    busy,
    more,
    refresh,
    loadMore: () => setLimit((v) => v + 20),
  };
}
