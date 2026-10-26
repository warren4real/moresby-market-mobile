# Email setup and second-account test

Updated 23 October 2026 (Asia/Manila).

## Budget and current state

Warren has no domain and wants zero spend now (PHP100 is not authorization for a recurring plan). Do not buy a domain or enable paid services. Existing shared account/listing functionality remains unchanged. Email confirmation stays enabled. Default Supabase delivery is limited to project-team email addresses; adding ordinary app testers as dashboard collaborators is not the intended solution.

The hosted rollback-only ownership test passed again today: another account cannot edit the owner profile/listing, cannot read private saves/assets, cannot forge ownership, and revoked sessions cannot write. This is a database test, not proof of real second-inbox email delivery. Confirmation/recovery callback success remains unverified on a fresh signup.

## Zero-cost candidate: Brevo Free SMTP

Resend's usual Supabase setup requires a verified owned domain, so postpone it. Brevo documents temporary rewriting of unauthenticated/free-provider sender domains to brevosend.com. Its Free plan includes 300 emails/day. This may support a small private test without purchasing a domain; transactional account activation and actual delivery must be checked, not assumed. Sender rewriting is temporary testing infrastructure, not final marketplace branding.

1. Warren creates/verifies a Brevo Free account using his own email, accepts provider terms himself, and completes any required account verification accurately. Stop if the provider requires payment or a domain before transactional sending is enabled.
2. Verify a sender address that Warren controls. Use Moresby Market as the sender display name. Confirm whether sender rewriting is available for this account.
3. Warren creates a dedicated SMTP key (not a Brevo API key and never a Gmail password). Enter it directly into hosted Supabase SMTP settings; do not paste it into chat, source files or EXPO_PUBLIC environment variables.
4. Configure Supabase Authentication > Emails > SMTP Settings:
   - Host: smtp-relay.brevo.com
   - Port: 587 (STARTTLS), or 465 (SSL/TLS) if required by the provider
   - Username: the actual SMTP login displayed by Brevo, not the sender email by assumption
   - Password: dedicated Brevo SMTP key
   - Sender address: exact verified sender configured at Brevo
   - Sender name: Moresby Market
5. Save only after sender verification and transactional sending activation. Keep email confirmation on. Preserve the exact allowed return URL moresbymarket://auth/callback. Turn off email click tracking for auth links where configurable.
6. Send a signup confirmation through the app to Warren's second inbox. Verify delivery/spam folder, link opens the same iPhone and an authenticated session is established. Record only sanitized error codes; do not log or share complete auth URLs/tokens/passwords.

If Brevo does not allow this temporary sender setup, pause external-email testing. Continue local/database tests at zero cost until an owned domain or another verified provider arrangement is available. Do not bypass confirmation or create an undocumented privileged tester account.

## Same-iPhone acceptance test after email setup

Use the shared app, not the separate Demo Seller/Buyer switcher.

1. Account A (existing email): publish a disposable listing titled Two-account test, with a harmless photo. Remember its province/category. Sign out.
2. Account B (second email): register with a distinct public name and password; confirm on this iPhone. Sign in if confirmation succeeded but automatic sign-in did not finish; report that as a callback failure, not a pass.
3. B: find A's listing with matching filters. Verify title/photo/price/general location. Save it. It should appear in B's Saved, never in B's My listings. B must not see owner availability/removal controls.
4. B: publish a second disposable listing. Restart and verify session persistence. Sign out.
5. A: verify B's listing appears in Explore. B's saved item must not appear in A's Saved. Only A can manage A's listing.
6. A marks its listing unavailable; B should see Unavailable after refresh. A removes it; B should no longer see it in Explore or Saved after refresh. Existing signed photo URLs may remain valid until their short expiry; removal is not immediate revocation of previously issued URLs.
7. Recovery: sign out; request password recovery for B, open the latest email on this phone, choose a new password, verify old password no longer works, then new password works. Existing sessions on another device must lose protected write access after revocation.
8. Record each result as PASS/FAIL/NOT TESTED. Delete only explicitly disposable fixtures through normal controls. Real messaging remains unavailable.

## Sources checked

- Supabase default SMTP restrictions: https://supabase.com/docs/guides/auth/auth-smtp
- Resend Supabase prerequisites: https://resend.com/docs/send-with-supabase-smtp
- Brevo sender rewriting: https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication
- Brevo Free plan: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
- Brevo + Supabase integration: https://developers.brevo.com/docs/supabase-smtp-integration

## Reported phone acceptance results

Warren reported that the second-email account was created and could sign in, see another account's listing, save a listing, and publish Mac Charger at K200. Automatic sign-in after the confirmation link still displayed its failure alert: record confirmation delivery/account creation as working, automatic code exchange as FAIL, and password recovery as NOT TESTED. Live messages remain unavailable as designed. Real listings do not appear in the separate offline demo; no synchronization between those environments is intended.

The reported inaccessible top-left listing back button was addressed with a shared full-screen listing modal that owns a SafeAreaProvider and a fixed header outside scrolling content. Both live listing details and offline demo details use the same close control with a 48-point target. Warren subsequently confirmed the back button works on his iPhone.

## Authentication callback update

The updated Release build was installed and launched on Warren's iPhone on 23 October. Automated tests reproduce auth-js 2.118 attempting to read browser location in a native-like runtime before making a token request. The native adapter now resolves the protected persisted PKCE flow and supplies it explicitly to the SDK exchange API. This adapter depends on the pinned SDK storage format and must be revalidated when upgrading Supabase. No redirect allowlist or email-confirmation policy was changed.

Recovery now preserves its screen across a restart using a protected, expiring, user-bound marker. Completion requires a successful password update and sign-out of other sessions; a failed revocation can be retried without changing the password twice. Confirmation resend has a local cooldown and safe feedback.

Validation: TypeScript and 42 automated tests pass, including real installed SDK callback exchange, cold-start verifier persistence, recovery events, resend, missing verifier handling, and recovery completion failures. These fixtures send no real emails. Phone acceptance is still pending: request a fresh recovery email for the second account on this iPhone, open the newest link, set a new private password, then verify old-password rejection and new-password sign-in. Automatic signup confirmation also needs a fresh unconfirmed test address. Do not mark authentication complete until phone results are recorded.

## Listing editing acceptance (23 October)

The real marketplace now offers Edit listing in the owner's listing details. Title, price and description are prefilled; replacing the photo is optional. The existing category, property details, area, availability, owner and listing ID are preserved. After saving, Explore, Saved and My listings reload from the shared backend. Other accounts need to refresh to see changes. Offline demo records remain separate.

The edit-listing function checks verified identity, owner, nonremoved status and original title/description/price/photo before a conditional RLS-protected update. Replacement JPEGs are decoded, re-encoded without EXIF and uploaded to a unique path. Only the owner's validated assets can be linked. Failed saves remove newly created assets when their foreign-key reference permits it; uncertain/committed saves never delete an image referenced by a listing. Previous photos remain stored privately for the owner; already-issued signed URLs expire after ten minutes. Old-asset retention cleanup remains future work.

Validation: TypeScript and 49 local tests pass; hosted rollback tests confirm owner title/description/price/photo updates, foreign-owner denial, foreign-asset denial and revoked-session denial. The function is deployed and the iPhone Release update is installed. Native edit acceptance is pending Warren's test: Me > My listings > open a listing > Edit listing, change details, optionally replace photo, save, then refresh from the other account. Test Cancel editing too. Reporting, blocking, deletion and live messaging are outside this change.

Security advisor still reports the pre-existing disabled leaked-password protection warning; no new database access warnings were reported for this migration.
