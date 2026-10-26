-- Event trigger keeps working; API clients do not need to execute its helper.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
