import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BackendApp } from "./src/live/BackendApp";
export default function App() {
  return (
    <SafeAreaProvider>
      <BackendApp />
    </SafeAreaProvider>
  );
}
