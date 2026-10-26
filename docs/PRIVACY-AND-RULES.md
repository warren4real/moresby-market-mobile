# Privacy Policy and Marketplace Rules

Implemented 24 October 2026. Public contact approved by Warren: Warren Malawae, wmalawae@gmail.com. The source of in-app wording is src/live/MarketplacePolicies.tsx.

## Access

Both documents open without an account from the sign-in/sign-up screens, and from the Me tab for signed-in and guest browsing. They use the existing full-screen safe-area modal with a fixed Back control and scrollable text. Opening or closing a policy does not submit auth forms, clear their drafts or change the auth mode. No acceptance record is collected and no claim of recorded consent is made.

## Content checked against implementation

- Account/profile, listing/photo, saved-item, chat, read-state, block, report and audit data.
- Public profiles/listings, participant-only app chat, operator/admin access and audited in-app report/transcript access; no E2EE claim.
- Supabase backend, Sydney core hosting, possible overseas provider processing, and Brevo account-email delivery.
- Optional camera/library permissions, manually supplied general location, protected sign-in storage and separate offline demo.
- Hidden soft-removed listings and retained old photos; account deletion cascades conversations for both participants and purges stored listing photos. Minimal operational records, provider logs/backups and previously saved copies may remain. No invented automatic retention period.
- Rules cover honest listings, authority to sell, prohibited items, respectful conduct, scams, payment limitations, reporting/blocking and manual moderation. No account-ban or in-app appeal feature is claimed.

These pages describe the current test release; they are not a certification of compliance with any particular country's law. The local project and source define present behavior. No database, consent logging, email sending or payment integration is added.

## Provider references checked

- https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq — regional hosting does not mean every support, logging or content-delivery operation stays in that region; provider retention differs from live account deletion.
- https://supabase.com/docs/guides/observability/logs — operational logs and plan-dependent retention.

## Verification

TypeScript and all 67 existing tests pass. Public contact details approved. iPhone Release build succeeded, installed completely and launched on the connected iPhone 13 Pro. Hands-on page scrolling/contact-link acceptance remains for Warren.

After installation, open each page from sign-in and Me, scroll to Contact, return using Back and confirm the sign-in fields remain. Test the contact link with a configured mail app. Repeat as a signed-out visitor. No new account or destructive action is needed for these checks.
