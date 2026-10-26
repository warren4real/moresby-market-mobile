import React from "react";
import { Pressable, Text } from "react-native";
import { styles as s, green } from "../theme";
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, danger && { backgroundColor: "#a83131" }, disabled && { opacity: 0.4 }]}
    >
      <Text style={[s.buttonText, secondary && !danger && { color: green }]}>{title}</Text>
    </Pressable>
  );
}
