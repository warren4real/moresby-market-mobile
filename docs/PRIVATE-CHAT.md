# Standard private chat — 23 October 2026

## Implemented behavior

The shared marketplace supports text conversations between a listing's seller and a signed-in buyer. An available listing offers Message seller. One conversation is reused per listing/buyer; the seller is derived on the server. Existing conversations can continue for unavailable items; a removed listing keeps its existing private history but stops new sends. Deleting either account hard-deletes the conversation and both participants' messages through database cascades. The separate offline Seller/Buyer demo is not synchronized.

Messages are stored on the server and are not end-to-end encrypted. Ordinary app access is restricted to the two participants with a current verified session. Authorized operators can access stored messages for support and report review. The inbox and conversation header explain operator access and lack of end-to-end encryption; do not market this as E2EE or promise that database administrators cannot access data.

Chats and unread totals refresh every five seconds while the app is active. An open thread refreshes on foregrounding and offers manual refresh. Polling pauses in the background. No push notifications, attachments, presence, typing indicators, payment requests or delivery/read-receipt badges are implemented. Sent messages are shown only after server confirmation; failed sends retain their draft and request ID for retry. Drafts and fetched transcripts stay in component memory, not AsyncStorage. Drafts do not survive process termination or sign-out.

The inbox starts with 20 conversations and offers more; the current Data API row ceiling bounds the expanded inbox to 1,000 conversations. Unread totals are queried separately across all accessible conversations. Threads fetch the newest 50 messages and page older messages in batches of 50, merging by UUID in server order. Only an active thread at its bottom advances the current user's read cursor. Unread counts clear for that account only and never while merely viewing the inbox. Very large transcripts may need list virtualization in a later release.

## Server controls

- RLS protects conversations, messages, read positions and conversation reports. Anonymous and unrelated users cannot read transcripts or inbox summaries. The inbox view explicitly uses security_invoker=true.
- Clients cannot change participants, message senders, message content after sending, server timestamps or ordering fields. Messages contain 1–2,000 nonblank characters. Duplicate retries validate the exact request ID, sender, conversation and trimmed body.
- The private send trigger validates the current sender, locks the conversation and assigns its visible sequence after acquiring the lock. This prevents a delayed lower sequence from arriving behind an advanced read cursor. It counts all the sender's messages, including blocked conversations: 30/minute and 500/day. New conversations are limited to 50/day among visible conversations.
- Read positions are owner-only, monotonic and bounded by actual messages in the same conversation. The read RPC accepts a displayed message UUID, not an arbitrary future position or another user's ID.
- Existing two-way blocks hide conversations and stop reads/sends. Unblocking restores history unless the other account also blocks you. Removing a block is possible only for its creator. Requests already in flight or device-cached copies cannot be recalled.
- Conversation reporting is participant-only, bounded and private from the other participant. One report per conversation/reporter; manual review only. Reports appear alongside listing reports in Safety & account. Nothing is sent to external operators automatically.
- Revoked/deleting accounts cannot read or send. Existing account-deletion cleanup cascades all new chat data. A minimal private operator audit record can remain after deletion; it stores a report UUID, operator label, reason and time, not message content.

## Operator review

Privileged operators can locate pending reports in the Supabase SQL Editor:

```sql
select id, conversation_id, reason, details, created_at
from public.conversation_reports where status='pending' order by created_at;
```

The supported review workflow calls private.review_chat_report with a specific report UUID, operator label and justified reason (or the service-only public wrapper review_chat_report). It appends to private.chat_review_audit and returns at most the latest 100 messages in that reported conversation. Ordinary app users cannot call either review function. Review status updates remain operator-only. A moderator dashboard was subsequently added with verified moderator identity and audited paginated transcript access; see MODERATION.md. Do not include message text or account credentials in audit reasons, logs or public replies. Raw project/database administrators retain their underlying privileged access; the helper does not technically prevent direct SQL reads.

## Verification and phone acceptance

TypeScript and 61 local tests pass. Hosted rollback-only chat tests pass for two-sided replies, sender spoofing denial, outsider/anonymous isolation, unread separation, read cursor bounds, blocks/unblock, report privacy, audited review, removed-listing sends and account-deletion cascades. The existing ownership and safety tests also pass. No actual user conversations were sent or read during these tests. The only outstanding security advisor warning is the existing disabled leaked-password-protection setting.

The iPhone Release build is installed; hands-on native chat acceptance remains pending:

1. As the second account, open the first account's available listing and tap Message seller. Send a disposable test message.
2. Sign out and enter the first account. Chats should show the conversation with an unread count. Open it, read and reply. Switch back to verify the reply and unread clearing.
3. Close and reopen the app; verify server history remains. Test a connection failure and retry without duplicate sends.
4. Report the conversation using "Disposable test report". Verify it appears in your own recent reports. Block the other member, then verify the conversation disappears for both signed-in accounts after refresh. Unblock to restore access.
5. Use only disposable accounts for deletion tests: deleting one removes their conversations for both sides. Do not delete the main account to test chat.

## Phone report and chat polish

Warren confirmed that real-account messages and foreground refresh work on the iPhone. His screenshots show unread counts in the tab label and conversation row. Those counts now use the same red, white-number UnreadBadge component as the offline demo, above the Chats icon and beside each unread conversation. The tab label stays Chats; counts cap visually at 99+.

Buyer quick replies now appear in a horizontal strip above the message field. They reuse the demo suggestion helper, select property-specific phrases from current listing metadata and offer a negotiation question only for negotiable listings. They appear for the conversation's buyer only, and not in locked or removed-listing chats. Tapping a suggestion fills an editable draft; it never sends automatically. Sellers retain the ordinary composer. Listing metadata is read through existing RLS; no database policies changed for this polish.

TypeScript and all 61 regression tests pass, including the buyer-only draft-fill behavior, no automatic send and preserved unread handling. Native quick-reply/badge acceptance remains pending after the updated iPhone installation.
