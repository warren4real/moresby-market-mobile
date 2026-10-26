import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./AuthProvider";
import { AuthScreen } from "./AuthScreen";
import { LiveMarketplace } from "./LiveMarketplace";
import { MarketplaceProvider } from "../state/MarketplaceProvider";
import { AppNavigator } from "../navigation/AppNavigator";
import { ui } from "../theme/marketplace";
function Routes() {
  const { session, ready, recovery, error, retry } = useAuth();
  const [demo, setDemo] = useState(false),
    [browse, setBrowse] = useState(false);
  if (!ready)
    return (
      <SafeAreaView style={ui.page}>
        <Text style={ui.subtitle}>Loading account…</Text>
      </SafeAreaView>
    );
  if (demo)
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView edges={["top"]}>
          <Pressable style={{ padding: 12 }} onPress={() => setDemo(false)}>
            <Text style={ui.link}>← Return to real marketplace</Text>
          </Pressable>
        </SafeAreaView>
        <MarketplaceProvider>
          <AppNavigator />
        </MarketplaceProvider>
      </View>
    );
  if (error)
    return (
      <SafeAreaView style={[ui.page, ui.content]}>
        <Text style={ui.subtitle}>{error}</Text>
        <Pressable onPress={retry}>
          <Text style={ui.link}>Retry</Text>
        </Pressable>
        <Pressable onPress={() => setDemo(true)}>
          <Text style={ui.link}>Open the separate offline demo</Text>
        </Pressable>
      </SafeAreaView>
    );
  if (recovery) return <AuthScreen onDemo={() => {}} onBrowse={() => {}} />;
  if (session || browse)
    return (
      <LiveMarketplace
        key={session?.user.id || "guest"}
        onDemo={() => setDemo(true)}
        onSignIn={() => setBrowse(false)}
      />
    );
  return (
    <AuthScreen onDemo={() => setDemo(true)} onBrowse={() => setBrowse(true)} />
  );
}
export function BackendApp() {
  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}
