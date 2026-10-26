# OpenCode fixes: hosted deployment and verification

Completed 26 October 2026 against marketples-dev (pwzkvcjcatxzhbcxbyid).

## Existing local fixes verified

- AuthProvider catches Supabase client initialization failures and reaches a recoverable ready/error state. BackendApp permits entry to the separate offline demo from that error state.
- expo-font is a direct SDK-compatible dependency. Expo patch updates made in OpenCode were preserved.
- TypeScript passed; all 75 Node tests passed; Expo Doctor passed 20/20. After aligning the migration path, all three review-specific tests passed again.

## Hosted changes

The hosted migration list and installed function were inspected first. Only serialize_listing_limit was missing by name; the original two historic migrations already had known local/remote timestamp differences, so no bulk CLI push or history repair was run.

Applied serialize_listing_limit through the Supabase connector with migration history. Canonical remote version: 20261025164404. Renamed OpenCode's 20261026090000_serialize_listing_limit.sql to that remote version and updated its regression test reference. The SQL body is unchanged: acquire a transaction advisory lock keyed to the seller before counting the rolling 24-hour limit. No new grants or SECURITY DEFINER behavior.

Added supabase/tests/listing-limit.sql: disposable verified-session fixtures permit 20 inserts, reject the 21st, and assert that the trigger holds the expected per-owner exclusive advisory lock. All fixtures roll back. This verifies the boundary and actual lock acquisition; it is not a separate two-client publication stress test.

## Additional regression discovered during hosted verification

The permanent-listing-deletion migration made listing_read's shared anon/authenticated policy reference private.active_account(), which anon cannot execute. The existing hosted access-rules check reproduced this permission error.

Applied separate_guest_listing_read (remote version 20261025170201): the existing read rule is now authenticated-only; a separate anon rule permits only non-deleted, non-removed listings visible through seller_visible. No anon permission was granted to the private session helper. Added an actual guest listing read and privilege-denial assertion to access-rules.sql.

The moderation fixture was stale after the earlier deletion/report serialization trigger: administrative fixture insertion lacked the fixture reporter's current-session claims. Added those fixture claims before seeding reports; no production report trigger was weakened.

Hosted rollback checks passed: listing-limit, access-rules, safety-rules, chat-rules and moderation-rules. No real reports were decided, accounts deleted or listings changed by these tests.

## Mobile delivery

Rebuilt Release with the updated dependencies, CocoaPods integration completed, native build succeeded (0 errors; 3 existing build warnings), installed 100% on Warren's connected iPhone 13 Pro and launched com.moresbymarket.mobile. No simulator or friend phone was updated. Hands-on acceptance remains for Warren.

## Remaining warnings

- npm audit reports five high-severity package entries representing node-forge and Zod advisories through Expo CLI tooling. No npm audit fix --force or incompatible Expo SDK 44 downgrade was applied.
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- Supabase security advisor still reports the existing disabled leaked-password protection setting; no new security advisor findings.
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Reference checked: https://supabase.com/docs/guides/deployment/database-migrations and https://www.postgresql.org/docs/17/functions-admin.html (transaction-level advisory locks). No changes committed or pushed to Git.
