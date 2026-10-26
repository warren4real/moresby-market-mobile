import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, ui } from "../theme/marketplace";

const guidance = [
  {
    title: "Meet somewhere safe",
    body: "Choose a busy public place in daylight. Tell someone you trust where you are going, and bring a friend if possible. Share a general area in your listing rather than your home address. Leave if you feel unsafe.",
  },
  {
    title: "Check the item before paying",
    body: "Inspect and test the item in person. Check that its condition, accessories and price match the listing. For expensive items, ask for proof of ownership. Do not pay a deposit just to reserve an item from someone you do not know.",
  },
  {
    title: "Watch for scam warning signs",
    body: "Be cautious about unusually low prices, pressure to pay quickly, unexpected payment links and requests for advance delivery fees. Never share passwords, PINs or verification codes. Check received funds in your own payment account; a screenshot alone is not proof of payment.",
  },
  {
    title: "Report a listing",
    body: "Open the item and scroll to Report listing. Choose a reason, add useful details and tap Submit report. Sign in if prompted. Reports go to manual review; submitting one does not automatically remove the item.",
  },
  {
    title: "Report or block someone in chat",
    body: "Open the conversation and tap Report conversation. Choose a reason, describe the problem and tap Submit conversation report. To stop contact, tap Block member and confirm. You can also use Block seller on a listing. Manage blocked members under Me → Safety & account.",
  },
  {
    title: "Check your reports",
    body: "Go to Me → Safety & account to see your recent reports. Pending means awaiting a decision. Reviewed means a moderator recorded a decision; it does not always mean the listing was removed. Dismissed means the report was closed without action.",
  },
  {
    title: "Keep personal details private",
    body: "Keep early conversations in the app and share only what is needed to arrange a sale. Messages are stored on our servers and are not end-to-end encrypted. Authorized operators can review stored messages for support and reports. Avoid sending identity documents, bank details or other sensitive information in chat.",
  },
  {
    title: "If something goes wrong",
    body: "Stop the transaction and keep relevant messages and payment records. Report the listing or conversation. If money has been sent, contact your payment provider promptly. If you face an immediate threat, move to safety and contact local emergency services. In-app reports are not an emergency service.",
  },
];

export function HelpSafety() {
  return (
    <ScrollView contentContainerStyle={ui.content}>
      <Text accessibilityRole="header" style={ui.title}>Trade with care</Text>
      <Text style={ui.subtitle}>
        A few simple steps can help you buy and sell more safely.
      </Text>
      <View style={[styles.card, { backgroundColor: palette.mint }]}>
        <Text style={styles.body}>
          This test release does not process payments or provide escrow or buyer protection. Arrange payment directly with the other person after checking the item.
        </Text>
      </View>
      {guidance.map(({ title, body }) => (
        <View key={title} style={styles.card}>
          <Text accessibilityRole="header" style={ui.section}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.wash, borderRadius: 16, padding: 18, marginBottom: 16, gap: 10 },
  body: { color: palette.ink, fontSize: 14, lineHeight: 22 },
});
