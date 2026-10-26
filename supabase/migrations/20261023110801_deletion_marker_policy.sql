-- Explicit service-only policy documents intentional denial for mobile roles.
create policy deletion_marker_service_only on private.account_deletions to service_role using(true) with check(true);
