import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, AppState, Linking } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../services/supabase";
import { protectedSessionStorage } from "../services/sessionStorage";
import { nativeFlowOptions } from "../services/nativeAuth";
import { createAuthLinkHandler } from "./authLinks";
import { recoveryState } from "./recoveryState";
export { AUTH_REDIRECT } from "./authLinks";
const recoveryStore = recoveryState(protectedSessionStorage);
const AuthContext = createContext<{
  session: Session | null;
  ready: boolean;
  recovery: boolean;
  finishRecovery: () => Promise<void>;
  cancelRecovery: () => Promise<void>;
  error: string;
  retry: () => void;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [recovery, setRecovery] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const handler = useRef<ReturnType<typeof createAuthLinkHandler> | null>(null);
  useEffect(() => {
    let alive = true,
      changed = false;
    let client;
    try {
      client = getSupabaseClient();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Supabase is not configured. Check the app configuration and retry.",
      );
      setReady(true);
      return () => {
        alive = false;
      };
    }
    const persistFailure = () => {
      if (alive)
        setError(
          "Your account state could not be saved. Unlock your phone and tap Retry.",
        );
    };
    const subscription = client.auth.onAuthStateChange((event, value) => {
      if (!alive || event === "INITIAL_SESSION") return;
      changed = true;
      setSession(value);
      if (event === "PASSWORD_RECOVERY" && value) {
        setRecovery(true);
        setTimeout(() => {
          void recoveryStore.begin(value.user.id).catch(persistFailure);
        }, 0);
      }
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        setRecovery(false);
        setTimeout(() => {
          void recoveryStore.clear().catch(persistFailure);
        }, 0);
      }
    });
    void (async () => {
      try {
        const result = await client.auth.getSession();
        if (result.error) throw result.error;
        const pending = await recoveryStore.pending(
          result.data.session?.user.id,
        );
        if (alive && !changed) {
          setSession(result.data.session);
          setRecovery(pending);
        }
      } catch {
        if (alive)
          setError(
            "Saved sign-in could not be loaded. Unlock your phone and retry.",
          );
      } finally {
        if (alive) setReady(true);
      }
    })();
    if (!handler.current)
      handler.current = createAuthLinkHandler(
        async (code, options) =>
          client.auth.exchangeCodeForSession(
            code,
            await nativeFlowOptions(protectedSessionStorage, options?.flowId),
          ),
        (reason) =>
          Alert.alert(
            "Sign-in link needs attention",
            reason === "missing_verifier"
              ? "This phone no longer has the matching sign-in request. Use Resend confirmation or request a new recovery email here, then open only the newest link."
              : reason === "network"
                ? "The sign-in request could not reach the server. Check your connection, then request a fresh link from this phone."
                : "This link could not finish signing you in. It may have expired or already been used. Request a fresh link on this phone. If you already confirmed your email, you can sign in with your password.",
          ),
      );
    const handle = handler.current;
    const links = Linking.addEventListener("url", ({ url }) => {
      void handle(url);
    });
    void Linking.getInitialURL()
      .then((url) => {
        if (alive && url) void handle(url);
      })
      .catch(() => {});
    const visibility = AppState.addEventListener("change", (state) => {
      if (state === "active") client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    if (AppState.currentState === "active") client.auth.startAutoRefresh();
    return () => {
      alive = false;
      subscription.data.subscription.unsubscribe();
      links.remove();
      visibility.remove();
      client.auth.stopAutoRefresh();
    };
  }, [attempt]);
  const finishRecovery = async () => {
    await recoveryStore.clear();
    setRecovery(false);
  };
  const cancelRecovery = async () => {
    const result = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (result.error) throw result.error;
    await finishRecovery();
  };
  return (
    <AuthContext.Provider
      value={{
        session,
        ready,
        recovery,
        finishRecovery,
        cancelRecovery,
        error,
        retry: () => {
          setError("");
          setReady(false);
          setAttempt((v) => v + 1);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw Error("Missing AuthProvider");
  return value;
}
