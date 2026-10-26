import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { ui } from "../theme/marketplace";
import { getSupabaseClient } from "../services/supabase";
import { AUTH_REDIRECT, useAuth } from "./AuthProvider";
import { MarketplacePolicyModal, PolicyLinks, type PolicyPage } from "./MarketplacePolicies";
import { completeRecovery } from "./completeRecovery";
export function AuthScreen({
  onDemo,
  onBrowse,
}: {
  onDemo: () => void;
  onBrowse: () => void;
}) {
  const { recovery, finishRecovery, cancelRecovery } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "verify">(
    "signin",
  );
  const [policyPage, setPolicyPage] = useState<PolicyPage | null>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0),
    [passwordChanged, setPasswordChanged] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(
      () => setCooldown((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown > 0]);
  const change = (next: typeof mode) => {
    setMode(next);
    setPassword("");
    setConfirm("");
    setNotice("");
  };
  const submit = async () => {
    if (busy || (!recovery && mode !== "signin" && cooldown > 0)) return;
    if (!recovery && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setNotice("Enter your email address.");
      return;
    }
    if (
      ((recovery && !passwordChanged) || (!recovery && mode === "signup")) &&
      (password.length < 12 || password !== confirm)
    ) {
      setNotice("Use at least 12 characters and matching passwords.");
      return;
    }
    if (!recovery && mode === "signup" && !name.trim()) {
      setNotice("Enter a display name.");
      return;
    }
    setBusy(true);
    setNotice("");
    const auth = getSupabaseClient().auth;
    let passwordUpdated = passwordChanged;
    try {
      if (recovery) {
        await completeRecovery(
          auth,
          password,
          passwordChanged,
          () => {
            setPasswordChanged(true);
            passwordUpdated = true;
          },
          finishRecovery,
        );
        setPassword("");
        setConfirm("");
        Alert.alert("Password updated", "Other sessions have been signed out.");
        return;
      }
      if (mode !== "signin") setCooldown(60);
      if (mode === "verify") {
        const result = await auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: AUTH_REDIRECT },
        });
        if (result.error) throw result.error;
        setNotice(
          "If this address needs confirmation, a fresh email will be sent. Open the newest link on this phone.",
        );
      } else if (mode === "signup") {
        const result = await auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: AUTH_REDIRECT,
            data: { display_name: name.trim() },
          },
        });
        if (result.error) throw result.error;
        setPassword("");
        setConfirm("");
        setNotice(
          "Check your email and open its confirmation link on this phone. Open only the newest link. If already registered, use sign in or recovery.",
        );
      } else if (mode === "forgot") {
        const result = await auth.resetPasswordForEmail(email.trim(), {
          redirectTo: AUTH_REDIRECT,
        });
        if (result.error) throw result.error;
        setNotice(
          "If an account exists for that address, a recovery email will be sent. Open the link on this phone.",
        );
      } else {
        const result = await auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw result.error;
        setPassword("");
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      setNotice(
        recovery && passwordUpdated
          ? "Your password was updated, but completing recovery failed. Tap Finish recovery to retry signing out other sessions."
          : status === 429
            ? "Too many attempts. Wait before trying again."
            : mode === "signin"
              ? "Could not sign in. Check your email/password and confirm your email first."
              : "Could not complete this request. Check your connection and email configuration, then retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={ui.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ui.content}
        >
          <Text style={ui.brand}>MarketPles</Text>
          <Text style={ui.eyebrow}>DEVELOPMENT BACKEND · TEST ACCOUNTS</Text>
          <Text style={ui.title}>
            {recovery
              ? "Choose a new password"
              : mode === "signup"
                ? "Create your account"
                : mode === "forgot"
                  ? "Recover your account"
                  : mode === "verify"
                    ? "Confirm your email"
                    : "Welcome back"}
          </Text>
          <Text style={ui.subtitle}>
            One account to buy and sell. Browse and publish shared listings.
            Private chat is available. Payments are not connected.
          </Text>
          {mode === "signup" && !recovery && (
            <>
              <Text style={ui.fieldLabel}>Public display name</Text>
              <TextInput
                style={ui.input}
                accessibilityLabel="Public display name"
                value={name}
                onChangeText={setName}
                maxLength={60}
              />
            </>
          )}
          {!recovery && (
            <>
              <Text style={ui.fieldLabel}>Private email address</Text>
              <TextInput
                style={ui.input}
                accessibilityLabel="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </>
          )}
          {(recovery
            ? !passwordChanged
            : mode === "signin" || mode === "signup") && (
            <>
              <Text style={ui.fieldLabel}>Password</Text>
              <TextInput
                style={ui.input}
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType={
                  mode === "signup" || recovery ? "newPassword" : "password"
                }
                autoCapitalize="none"
              />
              {(recovery || mode === "signup") && (
                <>
                  <Text style={ui.fieldLabel}>Confirm password</Text>
                  <TextInput
                    style={ui.input}
                    accessibilityLabel="Confirm password"
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </>
              )}
            </>
          )}
          {mode === "signup" && !recovery && (
            <View style={ui.notice}>
              <Text style={ui.noticeText}>
                Test accounts only for now. Your display name, general area and
                published listings are public. Your email and saved items are
                private. No demo chats or listings are uploaded automatically.
                Verification/reset emails depend on the configured email sender.
                Reporting, blocking and account deletion are available in the
                shared marketplace.
              </Text>
            </View>
          )}
          {!recovery && (
            <>
              {mode === "signup" && <Text style={ui.small}>Read our Privacy Policy and Marketplace Rules before creating an account.</Text>}
              <PolicyLinks onOpen={setPolicyPage} />
            </>
          )}
          {!!notice && (
            <Text
              accessibilityLiveRegion="polite"
              style={[ui.subtitle, { marginTop: 12 }]}
            >
              {notice}
            </Text>
          )}
          <Button
            title={
              busy
                ? "Please wait…"
                : recovery
                  ? passwordChanged
                    ? "Finish recovery"
                    : "Update password"
                  : cooldown > 0 && mode !== "signin"
                    ? `Wait ${cooldown}s`
                    : mode === "signup"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send recovery email"
                        : mode === "verify"
                          ? "Resend confirmation"
                          : "Sign in"
            }
            disabled={busy || (!recovery && mode !== "signin" && cooldown > 0)}
            onPress={submit}
          />
          {recovery && (
            <Pressable
              disabled={busy}
              style={{ marginTop: 20 }}
              onPress={() => {
                void cancelRecovery().catch(() =>
                  setNotice(
                    "Could not cancel recovery. Check your connection and retry.",
                  ),
                );
              }}
            >
              <Text style={ui.link}>Cancel and sign out</Text>
            </Pressable>
          )}
          {!recovery && (
            <View style={{ gap: 18, marginTop: 24 }}>
              {(["signin", "signup", "forgot", "verify"] as const)
                .filter((v) => v !== mode)
                .map((value) => (
                  <Pressable
                    key={value}
                    disabled={busy}
                    onPress={() => change(value)}
                  >
                    <Text style={ui.link}>
                      {value === "signin"
                        ? "Already registered? Sign in"
                        : value === "signup"
                          ? "Create an account"
                          : value === "verify"
                            ? "Resend confirmation"
                            : "Forgot password?"}
                    </Text>
                  </Pressable>
                ))}
              <Pressable onPress={onBrowse}>
                <Text style={ui.link}>
                  Browse shared listings without signing in
                </Text>
              </Pressable>
              <Pressable onPress={onDemo}>
                <Text style={ui.link}>Open the separate local demo</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <MarketplacePolicyModal page={policyPage} onClose={() => setPolicyPage(null)} />
    </SafeAreaView>
  );
}
