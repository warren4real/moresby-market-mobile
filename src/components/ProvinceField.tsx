import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { provinces } from "../data/locations";
import { ui } from "../theme/marketplace";
export function ProvinceField({ value, onChange, all = false }: { value: string; onChange: (value: string) => void; all?: boolean }) {
 const [open, setOpen] = useState(false);
 return <><Text style={ui.fieldLabel}>Province / region</Text><Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={ui.input}><Text>{value} ▾</Text></Pressable><Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><View style={ui.drawer}><View style={[ui.sheet, { maxHeight: "85%" }]}><View style={ui.spread}><Text style={ui.section}>Choose an area</Text><Pressable accessibilityLabel="Close provinces" onPress={() => setOpen(false)}><Text style={ui.link}>Done</Text></Pressable></View><ScrollView>{[...(all ? ["All PNG"] : []), ...provinces].map(p => <Pressable key={p} style={ui.sheetRow} onPress={() => { onChange(p); setOpen(false); }}><Text>{p === value ? "✓ " : ""}{p}</Text></Pressable>)}</ScrollView></View></View></Modal></>;
}
