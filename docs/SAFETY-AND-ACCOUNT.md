# Reporting, blocking and account deletion

Implemented 23 October 2026 for the shared test marketplace. The offline demo is separate. Standard private chat was subsequently added; see PRIVATE-CHAT.md.

## Phone acceptance

1. Open another account's listing and choose Report listing. Select a reason, optionally add details, and submit. The report appears in Me > Safety & account; submitting twice does not create a duplicate. Test reports should say "Disposable test report".
2. Block that seller. Their listings disappear from Explore and Saved for the blocker; the blocker’s listings also disappear for the other signed-in account after refresh. Reopen the app and verify the block persists. Me > Safety & account > Unblock seller restores access unless the other account also blocks you.
3. Open deletion and cancel first; no server request should be sent. Use only a disposable account if testing permanent deletion. It requires its current password, the exact text DELETE and the final Delete permanently confirmation. Main test accounts were not deleted during implementation.
4. After successful deletion the account is signed out, its listings disappear from other accounts after refresh, its photos stop being served, and the old credentials cannot sign in. Restart and verify. Prior downloaded files or caches cannot be recalled. The separate offline demo remains intact.

Blocking applies to authenticated marketplace access, including database listing/profile reads and newly issued photo links. Listings remain public when signed out; it is not a way to hide public content from someone using another account. Already-issued photo URLs can remain valid for their ten-minute lifetime. Blocks also hide standard private conversations and stop their reads/sends.

## Report review

Reports are private to their reporter and privileged project operators. Reported sellers cannot read them. Reasons and details are bounded; one report per reporter/listing and at most 30 per day. Reporters cannot set review status. Reports never remove listings automatically and have no guaranteed review time during testing. The app does not send operator notifications or make external messages.

The operator can use the Supabase SQL Editor to review the queue:

```sql
select r.id, r.created_at, r.reason, r.details, r.status,
       r.listing_id, l.title, l.owner_id
from public.listing_reports r
join public.listings l on l.id = r.listing_id
where r.status = 'pending'
order by r.created_at;
```

Inspect the actual listing before deciding. Set a specific report's status to reviewed or dismissed by its UUID. If a listing needs removal, update only its verified ID to status='removed'. A moderator dashboard was subsequently added for the authorized WarrenG account; see MODERATION.md. Review remains manual, and an automated ban system is not implemented. Do not copy private report details into public responses. Reports cascade away if their reporter or the listing's owner deletes the account; evidence retention is not part of this test release.

## Deletion and interrupted cleanup

The delete-account Edge Function authenticates the bearer, derives the account ID only from Auth and rechecks the current password with an isolated client. Caller-supplied account IDs are ignored. Service credentials never enter the app.

A service-only transaction writes a private deletion marker and removes all Auth sessions, including the password-check session. The marker makes all protected writes fail and hides the public profile/listings. Photos, including older replaced images, are removed through the Storage API in batches. Auth hard deletion then cascades profile, listings, assets, saves, blocks, conversations, messages and related reports. A second photo sweep runs before completion is recorded. The app only reports success after every required step succeeds.

If cleanup fails, the account stays hidden and sessions stay revoked. The response does not falsely report completion. The owner can sign in and retry deletion while the Auth user still exists; if Auth was already deleted, a privileged operator must finish cleanup. There is no automatic background cleanup worker in this release. The operator's private queue is:

```sql
select user_id, requested_at, completed_at
from private.account_deletions
where completed_at is null order by requested_at;
```

For a verified pending UUID, use scripts/finish-account-deletion.mjs with a service key supplied through the environment on the operator's machine. Never put that key in the app, chat, Git or EXPO_PUBLIC variables. The script defaults to inspection; --confirm-delete is required for cleanup. Keep pending markers until cleanup finishes. Completed markers contain only the deleted UUID and timestamps; operators may purge completed rows older than 30 days after confirming the Auth user and stored photos are gone. Provider logs/backups are outside the live-data deletion performed by this app.

## Validation

TypeScript, 55 local regression tests, the hosted rollback tests in access-rules.sql and safety-rules.sql, deployed unauthenticated endpoint rejection, and the iPhone Release build/install/launch passed. Tests cover report privacy, forged identity denial, two-way blocks, unrelated viewer access, unblock, deletion RPC isolation, old-session denial, database cascades, password/confirmation checks, targeted photo pagination and cleanup failures. Native reporting/blocking/deletion acceptance remains pending Warren's test.

The existing Supabase leaked-password-protection warning remains open. No new security advisor findings remain after this change.
