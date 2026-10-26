import React from "react";
import { Text, View, Pressable } from "react-native";
import { ui } from "../theme/marketplace";
export function ChoiceField({ label, values, value, onChange }: { label: string; values: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <><Text style={ui.fieldLabel}>{label}</Text><View style={ui.choices}>{values.map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: value === option }} onPress={() => onChange(option)} style={[ui.choice, value === option && ui.choiceActive]}><Text style={ui.choiceText}>{option}</Text></Pressable>)}</View></>;
}
