import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getSupabaseClient } from "../services/supabase";
export function useModerator(userId?: string) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let alive = true,
      inFlight = false;
    const check = async () => {
      if (!userId || inFlight || AppState.currentState !== "active") return;
      inFlight = true;
      try {
        const result = await getSupabaseClient().rpc("is_market_moderator");
        if (alive) setAllowed(!result.error && result.data === true);
      } catch {
        if (alive) setAllowed(false);
      } finally {
        inFlight = false;
      }
    };
    setAllowed(false);
    void check();
    const timer = setInterval(() => {
      void check();
    }, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId]);
  return allowed;
}
