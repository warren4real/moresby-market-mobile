import "react-native-url-polyfill/auto";
import { protectedSessionStorage } from "./sessionStorage";
import { AUTH_STORAGE_KEY } from "./nativeAuth";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

// Live accounts use a protected storage namespace separate from local demos.
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !key.startsWith("sb_publishable_")) {
    throw new Error(
      "Supabase is not configured. Set the public project URL and publishable key in .env.local.",
    );
  }
  client = createClient(url, key, {
    auth: {
      storage: protectedSessionStorage,
      storageKey: AUTH_STORAGE_KEY,
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
