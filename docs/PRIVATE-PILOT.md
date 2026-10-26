# Free iPhone pilot: installation and updates

Prepared 24 October 2026. Operator: Warren Malawae, wmalawae@gmail.com.

## Current route and limits

Use local Xcode Personal Team development installation. No paid membership, subscription, remote install link or TestFlight setup has been purchased or created. Apple permits up to three registered test devices with free Personal Team access and seven-day provisioning. Registration/signing quotas are controlled by Apple; inspect the actual Xcode response before promising another slot. Start with Warren and one friend, then add a second friend only if signing permits it. Simulators do not need physical-device provisioning.

The current app requires iOS 16.4 or newer. An iPhone 13 is suitable if updated to a supported iOS version. iPhone 7 is not compatible. Testers must be physically available with their phone and a data-capable cable for initial pairing, installation and later renewal. Keep a small pilot where this is practical.

## Verified current build

- App: Moresby Market, bundle com.moresbymarket.mobile, version 1.0.0.
- Current connected/provisioned phone: Warren's iPhone 13 Pro. No friend phone was present during this preparation.
- Latest installed release includes Help & Safety, Privacy Policy and Marketplace Rules, alongside listings, authentication, messaging and moderation.
- Current embedded Personal Team profile expires 27 October 2026 at 16:51:49 UTC (28 October at 00:51:49 Manila). The next signing operation may renew this; inspect the newly built profile instead of assuming every reinstall adds seven days.
- Native builds connect directly to the shared backend; no development server or same Wi-Fi is required after installation. Internet access is required.
- Simulator builds are separate and may be older than the physical phone build.

## First install on a friend's phone

1. Ask the friend to bring their compatible iPhone and cable. They keep their own Apple Account signed in. Do not ask for their Apple Account password or phone passcode.
2. Connect it to Warren's Mac. The friend unlocks it and accepts Trust This Computer themselves.
3. Open Xcode → Window → Devices and Simulators (or Device Hub on this Xcode installation). Wait for device preparation. If prompted, the friend enables Settings → Privacy & Security → Developer Mode, restarts and confirms it. Follow only the prompts for their own phone.
4. In the project terminal, list connected devices:

```bash
xcrun devicectl list devices
```

5. Identify the friend's physical phone by its name/model, confirm it with them and copy its device identifier. Do not use a simulator ID or Warren's ID. In the following command replace FRIEND_DEVICE_ID with the observed identifier:

```bash
cd /Users/warrenmalawae/Developer/moresby-market-mobile
EXPO_USE_PRECOMPILED_MODULES=0 npx expo run:ios --configuration Release --device FRIEND_DEVICE_ID --no-bundler
```

6. Automatic signing must register/provision that specific phone. If Xcode reports a quota, developer agreement, unavailable destination or signing failure, record the exact error and resolve that prerequisite. Do not switch Apple Accounts, change the bundle ID or uninstall the app as a workaround.
7. After Build Succeeded and installation reaches Complete 100%, open Moresby Market on the phone. If the terminal remains waiting at localhost after installation, stop that command with Ctrl+C; this Release build does not need a running development server. If needed, launch it explicitly with the same observed ID:

```bash
xcrun devicectl device process launch --device FRIEND_DEVICE_ID --terminate-existing com.moresbymarket.mobile
```

8. If iOS asks to trust the developer, the friend follows its prompt under Settings → General → VPN & Device Management. They read the Privacy Policy and Marketplace Rules before using their own marketplace account. Never share Warren's moderator credentials. Confirm the friend's ordinary account has no moderation entry.
9. Confirm one listing, a two-way chat and unread-count clearing with Warren. Background/closed-app push notifications are not implemented; test with the app open. Record the result below.

## Updates and signing renewal

- Reconnect each tester's phone to this Mac and repeat the Release build/install with that phone's identifier. TestFlight or automatic over-the-air app updates are not configured.
- Install over the existing app using the same bundle ID and signing team. Do not delete the app to update it. Shared account data lives on the backend; local drafts/session state should be checked after each update rather than promised to survive every failure.
- Update before the embedded profile expires; if an expired app will not open, reconnect and rebuild/re-sign. A phone restart alone does not renew signing.
- Check the current profile after each build if the expiry matters:

```bash
security cms -D -i /Users/warrenmalawae/Library/Developer/Xcode/DerivedData/MoresbyMarket-fdjpshdhrbtaqrgdxcyjtduirnrp/Build/Products/Release-iphoneos/MoresbyMarket.app/embedded.mobileprovision > /tmp/marketplace-profile.plist
/usr/libexec/PlistBuddy -c 'Print :ExpirationDate' /tmp/marketplace-profile.plist
```

- Record the actual install date, feature checkpoint and expiry for each phone. The current app's version is 1.0.0 across these development builds, so that version alone does not identify which features were installed.
- After an update, reopen, verify the right account and check a listing/chat before disconnecting. Never report an update as installed on an absent phone.

## Pilot feedback

Ask each tester to browse, post and message without coaching. Use disposable listings clearly titled TEST. Test removal or deletion only on disposable content/accounts; never delete a genuine account to complete a checklist.

Collect: phone model/iOS, installed checkpoint/date, steps taken, expected result, actual result and any safe screenshot. Do not collect passwords, confirmation links, verification codes or screenshots containing private conversations. Send feedback directly to the operator; app reports remain for listing/conversation safety concerns.

Keep the pilot small until there are no unresolved sign-in, posting, message-delivery, privacy or moderation failures. Ordinary visual confusion can be logged for the next update; do not promise transaction protection or instant report review.

## Test record

Use tester aliases rather than private emails, full UDIDs or account credentials in this file.

| Tester | Phone / iOS | Install date | Feature checkpoint | Profile expiry | Listing/chat check | Next issue |
| --- | --- | --- | --- | --- | --- | --- |
| Warren | iPhone 13 Pro / record version | 24 Oct 2026 | Privacy + Rules | 27 Oct 2026 16:51 UTC | Prior core checks passed; new pages pending hands-on check | Check both pages |
| Friend A | Not connected | — | — | — | Not tested | Connect compatible phone |
| Friend B | Not connected | — | — | — | Not tested | Confirm signing capacity first |

## Future distribution

TestFlight is a separate Apple Developer Program workflow, requiring membership and App Store Connect setup; external testing also involves Apple's review. It has not been configured here. Revisit it when budget and pilot size justify it; do not buy anything without Warren's authorization.

References checked 24 October 2026:
- https://developer.apple.com/help/account/basics/about-your-developer-account
- https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device
- https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/
