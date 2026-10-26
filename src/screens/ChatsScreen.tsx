import React, { useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useMarketplace } from "../state/MarketplaceProvider";
import { ui, palette } from "../theme/marketplace";
import { Icon } from "../components/Icon";
import { UnreadBadge } from "../components/UnreadBadge";
import { participants, unreadMessages, suggestedBuyerMessages } from "../data/demoProfiles";
import { money } from "../utils/format";
export function ChatsScreen() {
  const {
    products,
    visibleChats: chats,
    activeProfileId, profileName,
    conversationId,
    setConversationId,
    sendMessage,
    openConversation,
    setTab,
    showProduct,
  } = useMarketplace();
  const [draft, setDraft] = useState("");
  const conversation = chats.find((c) => c.id === conversationId);
  const otherId = conversation ? (participants(conversation).buyerId === activeProfileId ? participants(conversation).sellerId : participants(conversation).buyerId) : "";
  const currentProduct = conversation && products.find(p => p.id === conversation.product.id);
  const chatProduct = currentProduct || conversation?.product;
  return (
    <>
      {conversation ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setConversationId(null);
              setDraft("");
            }}
          >
            <Text style={ui.link}>← All chats</Text>
          </Pressable>
          <Text style={ui.title}>{profileName(otherId)}</Text>
          <Pressable
            style={[ui.row, ui.panel]}
            onPress={() => showProduct(conversation.product)}
          >
            <Image
              source={{ uri: chatProduct!.image }}
              style={ui.chatPhoto}
            />
            <View style={{ flex: 1 }}>
              <Text style={ui.listingTitle}>{chatProduct!.name}</Text>
              <Text style={ui.price}>{money(chatProduct!.price)}</Text>
              {(!currentProduct || currentProduct.stock < 1) && <Text style={ui.small}>Unavailable</Text>}
            </View>
          </Pressable>
          <View style={ui.notice}>
            <Text style={ui.noticeText}>
              Two-profile demo on this iPhone. Send a message, then switch profiles above to read and reply. No messages leave this device.
            </Text>
          </View>
          {!conversation.messages.length && (
            <Text
              style={[ui.small, { textAlign: "center", marginVertical: 30 }]}
            >
              Ask about availability, condition or a public meetup.
            </Text>
          )}
          {conversation.messages.map((m) => (
            <View key={m.id} style={[ui.bubble, (m.senderId || participants(conversation).buyerId) !== activeProfileId && { alignSelf: "flex-start", backgroundColor: "#f1f2ef" }]}>
              <Text style={ui.small}>{profileName(m.senderId || participants(conversation).buyerId)}</Text>
              <Text style={ui.bubbleText}>{m.text}</Text>
              <Text style={[ui.small, { textAlign: "right", marginTop: 5 }]}>
                Demo message · Saved locally
              </Text>
            </View>
          ))}
          {participants(conversation).buyerId === activeProfileId && chatProduct && <>
            <Text style={[ui.small, { marginTop: 18 }]}>Choose a message, edit it if you like, then tap send.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={ui.pills}>
              {suggestedBuyerMessages(chatProduct).map(text => <Pressable key={text} accessibilityRole="button" accessibilityLabel={`Use suggested message: ${text}`} style={ui.pill} onPress={() => setDraft(text)}><Text style={ui.pillText}>{text}</Text></Pressable>)}
            </ScrollView>
          </>}
          <View style={[ui.row, { marginTop: 12 }]}>
            <TextInput
              accessibilityLabel="Message draft"
              value={draft}
              onChangeText={setDraft}
              placeholder="Is this still available?"
              multiline
              maxLength={1000}
              style={[ui.input, { flex: 1, maxHeight: 120 }]}
            />
            <Pressable
              accessibilityLabel="Send demo message"
              accessibilityRole="button"
              disabled={!draft.trim()}
              style={[
                ui.iconButton,
                {
                  backgroundColor: palette.green,
                  opacity: draft.trim() ? 1 : 0.4,
                },
              ]}
              onPress={() => {
                sendMessage(conversation.id, draft);
                setDraft("");
              }}
            >
              <Icon name="arrow-up" color="white" />
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={ui.eyebrow}>GOOD DEALS START WITH A HELLO</Text>
          <Text style={ui.title}>Your conversations</Text>
          <Text style={ui.subtitle}>
            Questions, offers and handover plans in one place.
          </Text>
          {chats.length ? (
            chats.map((c) => (
              <Pressable
                accessibilityRole="button"
                key={c.id}
                onPress={() => openConversation(c.id)}
                style={ui.conversation}
              >
                <Image source={{ uri: c.product.image }} style={ui.chatPhoto} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={ui.listingTitle}>{profileName(participants(c).buyerId === activeProfileId ? participants(c).sellerId : participants(c).buyerId)}</Text>
                  <Text style={ui.small} numberOfLines={1}>
                    {c.product.name}
                  </Text>
                  <Text style={ui.small} numberOfLines={1}>
                    {c.messages.at(-1)?.text || "Start a demo conversation"}
                  </Text>
                </View>
                <UnreadBadge count={unreadMessages(c, activeProfileId)} />
                <Icon name="chevron-forward" size={17} />
              </Pressable>
            ))
          ) : (
            <View style={ui.empty}>
              <Icon name="chatbubbles-outline" size={38} />
              <Text style={ui.section}>Start with a hello.</Text>
              <Text style={ui.emptyText}>
                Open an item and tap Chat to ask a question.
              </Text>
              <Pressable onPress={() => setTab("Explore")}>
                <Text style={ui.link}>Find something you love →</Text>
              </Pressable>
            </View>
          )}
          <View style={ui.notice}>
            <Text style={ui.noticeText}>
              Chat is a local demo for now. Live messaging will be connected
              later.
            </Text>
          </View>
        </>
      )}
    </>
  );
}
