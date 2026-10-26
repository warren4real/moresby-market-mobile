import type { Product, Conversation } from "../types";
export const SELLER_ID = "demo-seller";
export const BUYER_ID = "demo-buyer";
export const demoProfiles = [
  { id: SELLER_ID, label: "Seller" },
  { id: BUYER_ID, label: "Buyer" },
];
export function listingOwner(product: Product) {
  return product.ownerId || SELLER_ID;
}
export function participants(chat: Conversation) {
  const sellerId = chat.sellerId || listingOwner(chat.product);
  return {
    sellerId,
    buyerId: chat.buyerId || (sellerId === SELLER_ID ? BUYER_ID : SELLER_ID),
  };
}

// Read positions use array offsets, avoiding timestamp collisions between messages.
export function unreadMessages(chat: Conversation, profileId: string) {
  const members = participants(chat);
  if (profileId !== members.buyerId && profileId !== members.sellerId) return 0;
  const read = Math.max(
    0,
    Math.min(chat.messages.length, chat.readCounts?.[profileId] || 0),
  );
  return chat.messages
    .slice(read)
    .filter((m) => (m.senderId || members.buyerId) !== profileId).length;
}
export function suggestedBuyerMessages(product: {
  property?: unknown;
  negotiable?: boolean;
}) {
  return product.property
    ? [
        "Is this property still available?",
        "When can I arrange a viewing?",
        "Could you share more details about the location?",
      ]
    : [
        "Hi, is this still available?",
        "I'm interested!",
        "Where can we meet for pickup?",
        ...(product.negotiable ? ["Is the price negotiable?"] : []),
        "Could you tell me more about its condition?",
      ];
}
