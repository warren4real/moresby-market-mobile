# Moderation dashboard — 24 October 2026

## Access and scope

Warren explicitly selected the main WarrenG account for moderator access. Its verified Auth UUID was resolved before a server-only membership row was created. The second account remains an ordinary account. Membership is held in private.moderator_accounts, never in editable profile fields or user_metadata. No service key is shipped in the app.

Me > Moderation dashboard appears only after is_market_moderator returns true. The UI rechecks on foregrounding and every 30 seconds. Every server operation independently verifies membership, email-confirmed account state, live Auth session and absence of a deletion marker. Removing membership or revoking sessions denies new requests without waiting for token expiry. A UI flag cannot grant moderation access.

Public RPC wrappers are security invoker functions. Restricted private SECURITY DEFINER implementations perform the privileged reads/updates after the current-caller guard. Ordinary report and message RLS policies remain unchanged. Private membership and audit tables have no mobile grants and explicit service-only policies.

## Review workflow

Queues are separated into Listing reports and Conversation reports, with Pending, Reviewed and Dismissed filters and 20-report pages. Queue reads and report opens are logged against the verified moderator ID. Opening a report shows its details, related listing and recent review history. Reported listing photos can be signed by an active moderator even if the listing is removed or the users are blocked; the new photo permission is restricted to paths belonging to a reported listing or a reported conversation's listing. No access is granted to arbitrary unpublished photos. Existing signed URLs may remain usable for their ten-minute lifetime after a role is revoked.

A conversation report does not automatically fetch its transcript. The reviewer must enter a reason and tap View reported conversation. Each page of up to 50 messages is audited in both moderation_audit and the existing chat_review_audit. Older-message access requires another audited call. No transcript text is copied into audit rows. Do not put private messages, passwords or personal contact details into decision/review notes.

A pending report requires a nonblank decision reason:

- Mark reviewed keeps the listing unchanged and records the decision.
- Dismiss report closes it without changing the listing.
- Remove listing (or Remove related listing for a conversation report) asks for confirmation, sets status=removed and moderation_removed=true, and records the decision atomically.

All decisions lock the report and require its expected pending state. A competing or repeated decision is rejected instead of overwriting the first. Completed reports are read-only in this release. Reopening a report and restoring a moderation-removed listing are not exposed in the dashboard; a privileged operator must handle an exceptional reversal deliberately.

The moderation_removed column is not writable by ordinary clients. Updated listing RLS prevents the owner from editing/reactivating a moderation-removed listing through direct API calls, and owner details explain the removal. Normal owner edits and ordinary owner soft-removal behavior remain unchanged. This is listing moderation, not an account-ban feature.

Dashboard contents are cleared when the app becomes inactive; returning reloads the queue and requires a fresh report/transcript open. Content already viewed or copied cannot be recalled. Project owners/database administrators retain their underlying privileged access; this dashboard does not remove direct administrative database access.

## Operator management and retention

Only a privileged project operator can insert/delete membership rows in private.moderator_accounts after checking the intended verified Auth UUID. Do not grant access from a display name alone. The membership row records the grant time and approved reason. Revocation is deletion of that exact membership row; never add a client self-promotion endpoint.

private.moderation_audit records moderator UUID, report kind/UUID, action, reason and time. Deleting a moderator nulls the actor reference. Report/account deletion can leave these minimal operational audit entries, which contain no report details, listing descriptions or transcript bodies. There is no automated audit-retention purge in this release; retention and any cleanup must be managed deliberately by the project operator. Account deletion still cascades reports, conversations and messages according to the existing implementation.

## Validation

TypeScript and all 67 local tests pass. tests/moderation.cjs checks no automatic transcript fetch, reason validation, optimistic decision arguments, explicit transcript action, confirmation before removal, background clearing and failed/revoked role UI checks.

The hosted rollback test supabase/tests/moderation-rules.sql passes for membership/metadata spoofing denial, no self-promotion, ordinary/anonymous RPC denial, scoped queues/photos, audited transcript and decision access, stale-decision rejection, owner reactivation/flag-edit denial, unaffected normal owner edits and role/session revocation. Existing ownership, safety and chat rollback suites also pass. No real report decision or listing removal was performed. Only the explicitly authorized main-account membership was added outside rollback tests.

The updated iPhone Release build is installed. Physical-phone dashboard acceptance is pending Warren's test. The pre-existing disabled leaked-password-protection advisor warning remains; no new security advisor findings were introduced.

## Phone acceptance

1. Use the second account to report a clearly disposable listing. It should have no Moderation dashboard entry under Me.
2. Sign into WarrenG on the updated iPhone, open Me > Moderation dashboard > Listing reports > Pending, and open the disposable report.
3. Enter a decision reason. Test Mark reviewed or Dismiss first, then inspect the corresponding queue/history. Verify the reporter sees the new status after reopening Safety & account.
4. For a separate disposable removal test, report another disposable listing and choose Remove listing. Confirm that it disappears from other users' Explore/Saved after refresh and its owner cannot reactivate it.
5. Open a conversation report. Verify no transcript appears until a review reason is entered and View reported conversation is tapped. Review history should record access when the report is reopened. Do not remove a genuine listing simply to test the control.
