-- Supabase advisor hardening discovered during the 2026-09-23 live migration parity audit.
--
-- paper_canonical_run was a normal owner-rights view and was selectable by
-- authenticated/anon roles. Because its base table (extraction_run) is protected
-- by guardian RLS, the view must execute as the caller so those policies remain
-- authoritative instead of using the view owner's privileges.
--
-- The two private helpers are self-contained SQL functions. Pinning search_path
-- removes mutable-path resolution without changing their behavior.

alter view public.paper_canonical_run set (security_invoker = true);

alter function private.in_free_archive_window(date) set search_path = '';
alter function private.verification_method_proves_identity(text) set search_path = '';

comment on view public.paper_canonical_run is
  'The one run whose regions speak for a paper. SECURITY INVOKER keeps extraction_run RLS authoritative for callers; re-scans create new runs and the canonical choice prevents duplicate counts.';
