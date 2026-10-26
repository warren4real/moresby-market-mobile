import React, { type ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { palette, ui } from "../theme/marketplace";

// Native modals have their own window. Measure safe areas in that window so
// the close control cannot sit beneath the iPhone status bar/notch.
export function ListingModal({
  visible,
  onClose,
  children,
  right,
  title = "Listing details",
  backLabel = "Back to listings",
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  right?: ReactNode;
  title?: string;
  backLabel?: string;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView
          style={ui.modalPage}
          edges={["top", "bottom", "left", "right"]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 12,
              minHeight: 56,
              borderBottomWidth: 1,
              borderBottomColor: palette.line,
              backgroundColor: palette.paper,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              onPress={onClose}
              style={{
                minHeight: 48,
                minWidth: 48,
                paddingHorizontal: 8,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon name="arrow-back" />
              <Text style={ui.link}>{backLabel}</Text>
            </Pressable>
            <Text
              style={[ui.link, { flex: 1, textAlign: "center" }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <View
              style={{
                minWidth: 48,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {right}
            </View>
          </View>
          {children}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
