# Moresby Market Mobile

Dedicated Android and iPhone marketplace prototype built with React Native and Expo. The sibling `moresby-market` project is the earlier web prototype.

## Development

```sh
npm install
npm start
```

Press `i` to launch in the installed iPhone simulator, or `a` for an installed Android emulator. Simulator testing runs the native React Native screens inside Expo Go. App Store/Play Store releases will require dedicated builds, signing and store accounts later.

Entry point: `App.tsx`. Feature code lives in `src/`; saved changes reload while Expo runs. `app.json` contains the application name and platform configuration. `npm run check` validates TypeScript.

## Included

Discover with search and category filters, product details, sample shop browsing, saved products, demo pickup/meetup/seller-delivery requests, simulated order confirmation and collection, demo seller setup and product creation. Demo records persist on the device through AsyncStorage. App and web demo data are separate.

## Prototype limits

The separate local demo uses sample shops/products and simulated orders/messages. The shared development mode now supports real email accounts, public profiles, shared listings and private saved items. Standard private text chat is available. Payments and delivery are not implemented. Reporting, two-way account blocking and password-confirmed account deletion are available; report review is manual. This is a test backend, not a public launch. Remote photos need an internet connection.

## Where to edit

- `App.tsx`: app entry point and providers.
- `src/screens/DiscoverScreen.tsx`: home, search, and category browsing.
- `src/screens/ShopsScreen.tsx`: shop directory.
- `src/screens/ProductScreen.tsx`: product modal and handover selection.
- `src/screens/OrdersScreen.tsx`: order history and demo order controls.
- `src/screens/SellerScreen.tsx`: demo shop setup and product creation.
- `src/components/`: shared Button, ProductCard, and ShopCard.
- `src/navigation/AppNavigator.tsx`: header, tab bar, and screen selection.
- `src/state/MarketplaceProvider.tsx`: shared app state, filters, and order actions.
- `src/services/storage.ts`: device-local saving; existing storage key is preserved.
- `src/data/sampleProducts.ts`: initial products and categories. Existing saved product data takes precedence.
- `src/types/index.ts`: Product, Shop, and Order definitions.
- `src/theme/index.ts`: colours and styles.
- `src/utils/format.ts`: kina price formatting.

## Marketplace redesign

The mobile app now uses Explore, Saved, Sell, Chats and Me navigation. Explore includes six broad categories, condition and seller-type filters, price sorting, and local listing cards. Sell supports individuals without shop registration, SMEs and companies, photo selection, condition, negotiable prices and handover choices. Listings, profile changes, saved items and demo messages remain device-local. Chats do not deliver messages to real sellers. Previous demo products and shops are retained through migration of the existing storage key.

Home and shared layout styling: `src/theme/marketplace.ts`. Additional pages: `SavedScreen.tsx`, `ChatsScreen.tsx`, `MeScreen.tsx`. Category definitions: `src/data/categories.ts`.

Run `npm run ios` for the Device Hub-compatible simulator launcher. If the iOS simulator stalls while booting, the app cannot open until that operating-system startup completes. Android and store release testing remain separate.

Property listings support rooms, apartments/houses, commercial buildings and land/lots, with sale, rent or lease purposes (rooms: rent only), weekly/monthly pricing, optional bedrooms and square metres. Property enquiries open the local demo chat instead of an item order. All listings can specify a PNG province/region and town/district/suburb; Explore filters by province and case-insensitive locality text. Older listings default to National Capital District. Location is manually selected, not GPS distance. No live property listings or booking/payment services are connected.

### Review fixes (22 October 2026)

Picked photos are copied into the app document directory rather than embedded in AsyncStorage. On load, readable legacy base64 photos are migrated across products, orders and chats before the snapshot is replaced. Failed loading or migration pauses automatic saving for that session to preserve existing records; restart to retry. An Android snapshot already too large to read cannot be automatically migrated by this change. Photo cleanup is intentionally deferred so historical orders/chats retain their images.

Chat details resolve against current products, and item requests independently check current availability. Removed listings cannot reopen from old conversations.

Run focused regression checks with `node --test tests/review-regressions.cjs`; these use mocked device storage and hooks, not a physical-device test.

### Two-profile local scenario

The on-device Seller/Buyer switcher is a role-play demo, not authentication or backend access control. Listings have a demo owner ID, conversations have buyer/seller IDs, and messages record who sent them. Saved items, profile details and listing drafts are separate per demo profile. Published data and conversations persist in the existing local snapshot; drafts survive tab/profile switches only while the app remains open. Previous profile/saved data belongs to Seller, and older single-sided chat messages display as Buyer messages.

Walkthrough: select Seller, create a listing, switch to Buyer, open that listing and tap Chat, send a message, switch to Seller, open Chats and reply, then switch to Buyer to read it. Sample listings can also be used as Buyer. No messages leave this iPhone.

Sell includes Take a photo and Choose from library. Camera permission is requested on tap; native builds must be regenerated/reinstalled after the camera permission configuration change. Image links use a separate input and explicit Use image link action so typing does not erase a selected photo. Test real camera capture and denied-permission recovery on physical devices.

### Demo message indicators and suggestions

Unread incoming-message counts appear beside both demo profiles, on the active profile's Chats tab and on each conversation. Switching profiles or opening the chat list alone does not mark messages read; opening a conversation does. Read positions are saved inside each conversation and survive restart. Older messages without sender IDs follow the existing legacy Buyer attribution. These are local in-app badges, not push notifications or lock-screen alerts.

Buyer conversations offer editable suggested messages, including availability/pickup questions for items and availability/viewing questions for properties. Selecting a suggestion fills the composer; Send remains a separate action.

### Supabase connection foundation

Copy `.env.example` to `.env.local` and supply the project URL and publishable key. `.env.local` is ignored by Git; the public values are embedded in a built Expo app and are not secrets. Never add secret/service-role keys or database passwords to EXPO_PUBLIC variables.

Run `npm run check:backend` to validate connectivity and inspect email-auth/confirmation settings without printing credentials. `src/services/supabase.ts` provides the account client with protected SecureStore persistence and refresh handling. `src/live/` implements email sign-up/sign-in/recovery, public profiles, shared listing publication, saved items, location/category/title search and owner availability/removal controls. The original demo remains isolated behind Open separate local demo; no demo records are automatically uploaded. Connection success alone does not verify access policies.


### Shared account increment (23 October 2026)

The entry point opens account sign-in, with guest browsing and an isolated local demo option. One account can buy and sell. Email confirmation stays required. Live sessions use a separate key in device-protected storage; large sessions are chunked and committed atomically. Sign-out requests global revocation; sensitive database rules validate the current session against Auth sessions.

Migrations live in `supabase/migrations/`. They explicitly grant API access and enable ownership policies. Public profiles contain display name, general area and seller type; private account email stays in Auth. Saved items are owner-only. Listing status updates and removal are owner-only. Removal is soft deletion. The data model supports items plus rooms, apartments/houses, commercial buildings and land/lots.

`supabase/functions/publish-listing/index.ts` verifies the account, validates and re-encodes JPEG pixels without EXIF, writes a private photo object, and inserts the listing using the caller's database access rules. Service credentials exist only inside the function environment. The initial live form supports one photo per listing. Signed display URLs expire after ten minutes; refresh listings to renew them. Drafts in the live form are currently in memory and clear when leaving Sell. Demo drafts keep their existing behavior.

The approved hosted Auth redirect is `moresbymarket://auth/callback`. Open confirmation/recovery links on the same phone that initiated the flow (PKCE verifier is stored there). Custom SMTP is not configured. Default Supabase email delivery is limited to project-team email addresses and currently two messages/hour; configure a sending domain and SMTP before inviting other users. Do not disable email confirmation to bypass this limit.

Verification completed: `npm run check`; `node --test tests/*.cjs` (21 passed); rollback-only hosted access tests in `supabase/tests/access-rules.sql`; live disposable-account sign-in/profile update/global sign-out; rejection of unauthenticated uploads and invalid JPEGs; no security advisor warnings; Android JS export; iPhone Release build/install/launch. The disposable account was removed. Native camera upload, successful photo publication from the phone, email confirmation/recovery and two-device listing visibility still need hands-on acceptance testing. No production readiness claim.

Before public launch: configure SMTP/domain, test email recovery and session persistence on devices, decide real-chat privacy, add moderation/report/block/delete-account flows, strengthen abuse controls/quotas, and exercise restore/backup procedures. No paid plan was enabled.

### Confirmation callback follow-up

The hosted account confirmation succeeded during Warren's first signup, but automatic code exchange did not complete. The exact device-side exchange failure has not been reproduced. Callback handling now validates the exact destination, passes optional SDK flow identity, deduplicates initial/foreground callbacks and explains password sign-in as the fallback after confirmation. Four regression tests cover parsing, duplicate delivery, flow identity and retrying a fresh link (25 total tests). Email confirmation is not disabled; no account password was changed. End-to-end automatic signup/recovery exchange remains an acceptance test.

### Native publishing upload follow-up

The old URI-only photo part is rejected by the installed Expo multipart serializer before any server request. Shared publication now attaches an `expo-file-system` File with real byte access, and photo preparation bounds the longer dimension to 1600 pixels for portrait and landscape images. Two tests exercise the installed serializer: the old format fails, while a File-compatible byte part includes the image and listing data. Camera capture was confirmed working by Warren; publication from the rebuilt phone app still requires retrying the test listing.

### Original marketplace layout restored

Shared account mode now uses the original masthead, category icon strip/drawer, search, two-column listing cards and Explore/Saved/Sell/Chats/Me tabs. Shared cards show seller display names, seller types, saved hearts and availability. Title/locality, province, property purpose/type, condition, seller type and price sorting apply on the server before pagination. The profile editor is collapsed behind its edit icon. Chats connects real accounts through the shared backend; offline demo messaging stays separate. Live Sell stays mounted between tabs so an unfinished photo/form survives tab changes while the app is open; completed publications reset the form. The local demo remains isolated under Me.

Validation: TypeScript, 31 local tests and a live joined listing/seller filter query (HTTP 200). Phone acceptance checks: category drawer/search, listing details and saved hearts, Sell photo/draft across tabs, profile editing and Chats placeholder. Existing backend data and auth session namespaces are preserved.

### Shared listing editing — 23 October 2026

Owners can open a listing and choose **Edit listing** to update its title, price, description and optional photo. Cancel leaves the original unchanged. Saves preserve availability, category/property details and location, refresh the active list and are visible to other accounts after refresh. Removed listings cannot be edited through this endpoint. The separate offline demo remains isolated.

`src/live/LiveEdit.tsx` calls `supabase/functions/edit-listing/index.ts`; metadata writes use caller RLS, and replacement images use the same pixel-only JPEG validation as publication. Migration `20261023103649_listing_photo_edits.sql` grants only image-path updates and restricts linked assets to the owner. Concurrent changes are rejected using an original-field snapshot. Old photo objects are retained privately; no old-photo cleanup job is implemented yet.

Current validation: TypeScript and 49 automated tests pass, hosted rollback ownership/photo checks pass, and the iPhone Release build is installed. Phone editing acceptance remains pending. Authentication recovery was subsequently confirmed working by Warren; automatic fresh-signup sign-in still needs its own acceptance result. Earlier dated test counts and limitations above are historical snapshots. The leaked-password-protection advisor warning remains open. Live Sell drafts now remain in memory across tab changes, but not across process restarts.

### Safety and deletion — 23 October 2026

Other sellers’ listing details offer Report listing and Block seller. Me > Safety & account manages unblocking, recent report status and password-confirmed permanent account deletion. Blocks are enforced in database reads for signed-in accounts; public signed-out access remains possible. Reports are private and queue for manual review, not automatic takedown. Deletion hides the account and revokes sessions before deleting photos and the Auth user, with cascade cleanup of related marketplace data. Incomplete cleanup stays hidden and requires retry or operator recovery.

See docs/SAFETY-AND-ACCOUNT.md for acceptance steps, report review and interrupted-deletion recovery. No existing test account was deleted. TypeScript, 55 local tests, hosted ownership/safety rollback checks and iPhone Release installation passed; phone acceptance remains pending.

### Standard private chat — 23 October 2026

Message seller opens a real listing conversation. Chats supports replies, unread totals, older-message loading, retry without duplicate sends, conversation reports and two-way blocking. It refreshes every five seconds while the app is active, with no background push notifications or attachments. Messages are stored on the server and are not end-to-end encrypted; authorized operators can review them, and the app explains this. The supported report-review helper records an access audit. Account deletion cascades conversations and messages for both participants.

See docs/PRIVATE-CHAT.md for access controls, operator review, retention and phone acceptance steps. TypeScript and 61 local tests pass, hosted chat privacy/ownership/safety rollback tests pass, and the Release update is installed on the iPhone. Real-account phone message exchange remains to be confirmed by Warren. No existing accounts or user conversations were altered during validation.

Chat polish: Warren confirmed real phone message exchange and foreground refresh. Buyer quick replies now reuse the demo's suggestions and fill the draft without sending. Property/negotiation suggestions follow the current listing. Unread counts appear in red numbered badges on the Chats icon and conversation rows, using the existing demo badge component. TypeScript and all 61 tests pass; the new visuals still need phone acceptance.

### Moderation dashboard — 24 October 2026

Me > Moderation dashboard is enabled for WarrenG's explicitly authorized main account. Server-managed membership and live-session checks protect listing/conversation report queues, explicit audited transcript review and reasoned decisions. Moderation removal hides the related listing and prevents owner reactivation. Ordinary accounts retain their existing access only. Queue/report access, transcript review and decisions are audited; dashboard content is cleared on backgrounding.

See docs/MODERATION.md for access control, operator management, retention, limitations and phone acceptance. TypeScript, 67 local tests and all hosted rollback suites pass. The Release update is installed on the iPhone. No real report decision or listing removal was made during implementation. The simulator was not rebuilt for this update; its ordinary second account can still submit reports for the phone's moderator dashboard test.

### Help & Safety — 24 October 2026

Added Me → Help & Safety with public-meetup and payment precautions, scam warning signs, exact listing/conversation reporting steps, blocking and report-status guidance. Uses the existing safe-area modal and scrolling content. Explains the test release has no payment processing, escrow or buyer protection, and that in-app reports are not emergency support. This is practical help; separate privacy policy and marketplace rules remain future work.

Validation: TypeScript check and all 67 existing tests passed.

### Privacy Policy and Marketplace Rules — 24 October 2026

Added readable policy pages before sign-in/sign-up and in Me for signed-in and guest users. Includes current data handling, private chat/operator access, service providers, retention/deletion limits and marketplace conduct rules. Public operator/contact explicitly approved: Warren Malawae, wmalawae@gmail.com. No consent tracking or backend changes. See docs/PRIVACY-AND-RULES.md for verification and phone acceptance steps. TypeScript and all 67 existing tests passed.

### Free private pilot — 24 October 2026

Prepared docs/PRIVATE-PILOT.md with first-install pairing steps, exact per-device Release installation/launch commands, weekly signing renewal, current verified profile expiry and an alias-only tester checklist. The free Personal Team route supports a small local test, subject to Apple quotas; no TestFlight or remote install link has been created. A friend phone must be connected before its provisioning or installation can be completed.

### OpenCode review handoff deployed — 26 October 2026

Verified existing configuration fallback and Expo font fixes; deployed the per-seller listing-limit lock to hosted Supabase and fixed an additional guest-listing read-policy regression found by backend verification. TypeScript, 75 tests, Expo Doctor 20/20 and five hosted rollback suites passed. Updated iPhone Release installed and launched. See docs/OPENCODE-HANDOFF-2026-10-26.md for exact migration versions and remaining dependency/password-protection warnings.
