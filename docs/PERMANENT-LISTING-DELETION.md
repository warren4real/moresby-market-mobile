# Permanent listing deletion — 25 October 2026

Approved scope: a separate Delete permanently action for the owner of an already removed listing, with final confirmation. Applies to the shared marketplace, not the separate offline demo.

## Behaviour

- Mobile: Me → My listings → open a removed listing → red Delete permanently. Website: My account → Your listings, or the removed listing detail.
- Only a verified account with a currently valid Auth session can delete its own removed listing. Available/unavailable items must be removed first. Moderator-removed listings are refused. New deletion flags cannot be set through client inserts or updates.
- The public title, description, price, location, category/property details and image reference are replaced with neutral deleted values. A minimal hidden row preserves existing foreign keys; chats and reports are not cascaded away. Existing conversations remain readable, labelled Listing deleted, with new sends disabled. Removed-but-not-deleted listings keep the separate Listing no longer available chat label.
- A listing or conversation report that already exists causes a private evidence snapshot and the current reported photo to be retained for authorized moderators. Reports, decisions, audits and audited transcript access continue working. Ordinary members cannot retrieve that archive or obtain new signed URLs for its photo through owner access. A moderator owner still has separately authorized moderator access. Evidence has no automatic expiry and is removed by account deletion or deliberate operator cleanup. The confirmation and Privacy explain this exception.
- Unreported current and replaced listing photos are purged through the Storage API, in bounded batches scoped to the bearer owner and listing UUID filename prefix. Photos still referenced by another listing or retained evidence are protected. Asset metadata is removed only when unreferenced.
- Existing saved-item rows are removed. Old signed URLs/downloaded copies cannot be recalled; issued photo links were limited to ten minutes.
- The server locks the listing, records a retry ledger and clears public content before cleanup. Reports serialize with that lock. Late asset registration for a deleted listing is refused. A failed cleanup is never reported as successful: a sanitized Finish deletion cleanup entry stays visible to its owner until completion. Retrying the same listing is idempotent. No passwords, owner IDs, storage paths or retention overrides are accepted from the deletion request.

## Implementation

- Migrations: permanent_listing_deletion, deleted_chat_label, listing_deletion_photo_indexes. Local files match hosted migration versions.
- New delete-listing Edge Function: bearer verified with Auth; live-session/ownership/removal checks performed by guarded RPC before service-only storage cleanup. The gateway JWT switch is false because the function verifies Auth itself, consistent with the existing endpoints. No service key is included in either client.
- Cleanup manifest/finish RPCs are service-role-only; their implementations are private. Deletion/evidence ledger is private with RLS. Moderator RPCs preserve existing audited access and return retained evidence only to authorized moderators.
- Storage/listing grants and policies prevent client restoration or owner access to retained evidence. Relevant cleanup/foreign-key/photo indexes were added. Broader existing RLS performance warnings were not rewritten as part of this feature.

## Validation and publication

- Mobile TypeScript passed. Existing 67 mobile tests and five endpoint tests passed (72 total). Endpoint fixtures cover missing/invalid identity and confirmation, denial before cleanup, 205-file pagination, bearer-owner scoping, evidence retention, and failed storage/finalization.
- A transaction using temporary Auth users/sessions/listings exercised real RLS/RPC behaviour and was rolled back. It verified wrong-owner and revoked-session refusal, removed-only and moderator restrictions, evidence preservation, chat/report preservation, hidden completion, idempotent retry, no reactivation, unreported asset cleanup, moderator evidence/photo access, deleted chat labels and restricted function/column grants. No real listing was deleted by these checks. The rollback script is tests/permanent-listing-deletion.sql.
- Website build and all 14 unit tests passed. Isolated browser checks verified cancel sends no request, no optimistic removal after cleanup failure, discoverable retry after refresh, mobile layout, successful retry removal and no delete button on moderator-removed content. All browser writes were intercepted fixtures, never real deletions.
- Security advisors: only the pre-existing leaked-password-protection warning remains: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
- Server migrations and function are deployed. Mobile release build/install is verified separately in the task handoff. Website source and dist are updated locally; Cloudflare still needs a new Production upload of dist.

## Hands-on acceptance

Use a disposable listing or one you genuinely intend to erase. Remove it first, open it from My listings, read the confirmation, then choose Delete permanently. Confirm it disappears from both owner lists after refresh. Existing chats should remain with the deleted label; reports should remain available to WarrenG. Cancel should leave the listing intact. Moderator-removed items must not offer this action.

Final phone delivery: Release build succeeded, installed to Warren’s connected iPhone 13 Pro (00008110-000C61240CE1801E). The installed bundle contains the updated deletion controls and privacy text. No real listing was deleted by the implementation or tests. Real-account destructive acceptance remains for Warren.
