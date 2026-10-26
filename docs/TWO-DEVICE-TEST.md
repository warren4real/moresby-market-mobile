# Testing two separate installations

23 October 2026. Use the shared marketplace, not the separate offline demo. No additional backend deployment or paid service is required for the existing accounts/listings/chat test.

## Friend's iPhone 13

The current native target requires iOS 16.4 or newer. The friend must be present for device unlock, Trust This Computer, Developer Mode/restart and any developer-app trust prompts. They do not need to disclose their Apple Account password or phone passcode to the developer. Their phone stays signed into their own Apple Account.

Connect the phone to this Mac with a data-capable cable. Xcode pairs the phone, and automatic signing must provision that specific device. Rebuild/install com.moresbymarket.mobile for its observed UDID; the already-installed app bundle is provisioned for the original phone and is not a general install link. Confirm the destination before installing.

The current build uses local Personal Team provisioning. Apple documents up to three registered devices and seven-day provisioning validity for free accounts. Xcode may report a registration quota or signing prerequisite; resolve the actual reported condition before proceeding. After expiry, rebuild/reinstall. The standalone Release app uses internet directly and does not need this Mac or the same Wi-Fi after installation. TestFlight distribution is a separate Developer Program workflow, not part of this zero-spend setup.

Apple references:
- https://developer.apple.com/help/account/basics/about-your-developer-account
- https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device
- https://developer.apple.com/testflight/

## Simulator on this Mac

Use an installed simulator runtime; do not download a new runtime for this test. The selected device is iPhone 17 Pro, iOS 26.4.1, UDID A4D68C6E-D1E3-46A0-A294-06CEE388A1D2. Open it in Xcode Device Hub. Install a standalone simulator Release build of the same current app; a physical-iPhone .app cannot run on Simulator.

Sign into an existing confirmed second marketplace account in the simulator, and keep the first account on the real iPhone. Enter credentials yourself. The two installations have independent session storage but use the same shared backend. Simulator camera behavior does not verify a physical phone camera; use the real phones for that acceptance check.

## Checklist

1. A publishes or edits a disposable listing. B finds it with matching filters, sees the photo and saves it. B cannot edit A's listing.
2. B taps Message seller, chooses a quick reply, edits if desired and explicitly sends it.
3. Keep A on Explore or the inbox. Within about five seconds while active, A sees a red unread badge. Opening the thread at the bottom clears A's unread count; merely viewing the inbox must not.
4. A replies. B receives the reply; verify two-way history and badge clearing. Reopen both apps and verify history/session persistence.
5. Use mobile data on one phone and Wi-Fi on the other to confirm shared-server access. The simulator uses this Mac's network.
6. Briefly interrupt B's network, attempt a disposable message and restore the connection. Retry without changing its text; verify no duplicate. No push notification while the app is closed is expected in this release.
7. Block the other member and verify both accounts lose listing/chat access after refresh. Unblock and verify history returns. Use a clearly marked disposable report if testing the report queue.
8. Only use a disposable third account for permanent deletion tests; never delete the main account as part of ordinary chat testing.

Record PASS/FAIL and the relevant device/iOS version. Do not share passwords, complete auth links or private conversation screenshots in reports.

## Pilot installation and updates

See [PRIVATE-PILOT.md](PRIVATE-PILOT.md) for the current free installation route, verified profile expiry, per-phone update steps and tester record. Only the connected/provisioned phone has been updated; a friend must connect their own phone before installation can be completed.
