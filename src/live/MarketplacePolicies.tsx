import React from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { ListingModal } from "../components/ListingModal";
import { palette, ui } from "../theme/marketplace";

export type PolicyPage = "privacy" | "rules";
export const POLICY_UPDATED = "25 October 2026";
export const POLICY_CONTACT = { operator: "Warren Malawae", email: "wmalawae@gmail.com" };
const privacy = [
  ["Information you provide", "We collect your email address and authentication details to create and secure your account. Your public profile includes your display name, seller type, province and town or suburb. We also store the listing text, price, photos and property details you publish, your saved listings, chat messages, unread-message state, blocks, reports and moderation records."],
  ["Why we use it", "We use this information to provide accounts, show and manage listings, save favourites, deliver messages, send account-confirmation and password-recovery emails, prevent abuse and review reports. Technical service logs, such as IP addresses, request times and errors, help operate and secure the service."],
  ["What other people can see", "Your public profile and published listings can be seen by people browsing the marketplace, including signed-out visitors. Your account email, saved items and block list are not shown to other members. A chat is accessible to its participants in the app. Reports are visible to their reporter and authorized reviewers; they are not public."],
  ["Messages and moderation", "Messages are stored on our servers and are not end-to-end encrypted. Authorized operators and database administrators can access stored information for support, safety and report handling. In-app moderator access to reports and reported conversations is recorded. Do not send passwords, verification codes, identity documents or other sensitive information in chat or report notes."],
  ["Service providers and overseas processing", "We use Supabase for accounts, database storage, photos and backend services, and Brevo to deliver account emails. Brevo receives the recipient email address and email content needed for delivery. Our core Supabase project is hosted in Sydney, Australia. Provider support, service logs, email delivery and content delivery may involve processing in other countries. We do not sell personal information or use it for targeted advertising in this test release."],
  ["Your phone and permissions", "Camera and photo-library access is requested when you choose to take or select a listing photo. You can refuse or change access in your phone settings. We use the general location you enter; this release does not request precise GPS location. Sign-in tokens are stored using protected device storage. Listing photos and the separate offline demo may also be stored on your device. Offline demo data is not automatically uploaded to the shared marketplace."],
  ["How long information stays", "Account information, messages, listings and reports remain while needed to run this test marketplace until deleted through the available controls or operator cleanup. Removing a listing hides it. Delete permanently removes its public content and photos after confirmation, while existing conversations retain a Listing deleted reference. For listings that already have reports, a private evidence copy and the reported photo remain available to authorized moderators until account deletion or operator cleanup; there is no automatic expiry for that evidence. Deletion can leave a Finish deletion cleanup entry if photo cleanup needs retry. Replaced photos not tied to a completed deletion may remain until account deletion. Minimal moderation audit and account-deletion records can remain after deletion, and there is currently no automatic expiry for those operational records. Provider logs and backups follow the providers' retention arrangements rather than disappearing immediately."],
  ["Your choices and account deletion", "Edit your public profile under Me and edit your own listings from their details. Use Me → Safety & account to manage blocks, see recent reports or permanently delete your account. Deletion requires your password, the word DELETE and final confirmation. Successful deletion removes the account, profile, listings, stored listing photos, saved items, blocks, related reports and conversations involving that account, including messages for both participants. Minimal operational audit records, provider logs/backups and copies already saved by other people may remain. The separate offline demo is not erased by shared-account deletion."],
  ["Access, corrections and concerns", "Contact the operator below to request access to your information, ask for a correction that is not available in the app, report a deletion problem or raise a privacy concern. We may need to verify that the account is yours. Never send your password or verification codes. Please describe the request and the account email involved."],
  ["Updates", "This policy describes the current test release. We will update the date and wording when our practices change. Read the current version before sharing information you consider sensitive."],
] as const;
const rules = [
  ["Use the marketplace honestly", "Use an account you control and keep its credentials secure. Give accurate descriptions, prices, condition and general location. Use photos you own or have permission to use. Do not impersonate someone, post fake reviews or listings, spam members or mislead people about ownership or availability."],
  ["Only list items you may lawfully sell", "You must own the item or have authority to sell it. Do not list stolen goods, counterfeit goods, illegal drugs, weapons or ammunition, sexual services or explicit sexual content, personal data, account credentials, or anything whose sale is unlawful. This test marketplace also does not accept alcohol, tobacco or vaping products, prescription medicines, live animals or financial products. Do not use property listings to misrepresent ownership or authority."],
  ["Treat people respectfully", "Do not threaten, harass, discriminate against or scam anyone. Do not share another person's private information or intimate images. Do not pressure people to reveal passwords, payment PINs, verification codes or identity documents. Respect a block and do not use another account to bypass it."],
  ["Arrange transactions carefully", "Agree on the item, price, inspection and handover directly with the other person. Inspect before paying, use a busy public meeting place and check funds in your own account. The marketplace does not process payments, hold deposits, provide escrow, organize delivery or offer buyer protection. Listings and member identities are not independently verified. No listing or message guarantees that a transaction is safe."],
  ["Keep listings up to date", "Correct mistakes promptly. Mark an item unavailable or remove the listing when it is no longer offered. Do not repost content removed by a moderator to avoid a decision. Do not advertise an unavailable item to collect deposits or redirect buyers to a different offer."],
  ["Report problems", "Use Report listing on an item or Report conversation in a chat. Give a truthful reason and useful details; do not include passwords or unnecessary personal information. Reports await manual review and do not automatically remove a listing. Use Block seller or Block member to stop contact through your signed-in account. Public listings may still be visible while signed out or from another account."],
  ["How moderation works", "Authorized moderators may review reports and reported conversations, dismiss a report, record a reviewed decision or remove the related listing. Moderation decisions and reasons are recorded. A reviewed report does not always mean content was removed. If you think a decision was wrong, contact the operator with the listing or report details; the current app does not have an appeal button. Do not submit repeated reports to pressure reviewers."],
  ["This is a test release", "Features and access may change as testing progresses. Keep your own copies of information you need. Do not rely on this app for emergency assistance or guaranteed delivery of messages. If you face an immediate threat, move to safety and contact local emergency services."],
] as const;

export function PolicyLinks({ onOpen }: { onOpen: (page: PolicyPage) => void }) {
  return (
    <View style={{ gap: 8, marginVertical: 16 }}>
      {(["privacy", "rules"] as const).map((page) => (
        <Pressable key={page} accessibilityRole="button" onPress={() => onOpen(page)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={ui.link}>{page === "privacy" ? "Privacy Policy" : "Marketplace Rules"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MarketplacePolicyModal({ page, onClose }: { page: PolicyPage | null; onClose: () => void }) {
  const title = page === "rules" ? "Marketplace Rules" : "Privacy Policy";
  return (
    <ListingModal visible={page !== null} title={title} backLabel="Back" onClose={onClose}>
      {page && (
        <ScrollView key={page} contentContainerStyle={ui.content}>
          <Text accessibilityRole="header" style={ui.title}>{title}</Text>
          <Text style={ui.subtitle}>Moresby Market · Test release · Updated {POLICY_UPDATED}</Text>
          {(page === "privacy" ? privacy : rules).map(([heading, body]) => (
            <View key={heading} style={{ marginBottom: 22, gap: 8 }}>
              <Text accessibilityRole="header" style={ui.section}>{heading}</Text>
              <Text selectable style={{ color: palette.ink, fontSize: 14, lineHeight: 22 }}>{body}</Text>
            </View>
          ))}
          <Text accessibilityRole="header" style={ui.section}>Contact</Text>
          <Text selectable style={[ui.subtitle, { color: palette.ink }]}>{POLICY_CONTACT.operator}</Text>
          {!!POLICY_CONTACT.email && (
            <Pressable accessibilityRole="link" style={{ minHeight: 48 }} onPress={() => { void Linking.openURL(`mailto:${POLICY_CONTACT.email}`).catch(() => {}); }}>
              <Text selectable style={ui.link}>{POLICY_CONTACT.email}</Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </ListingModal>
  );
}
