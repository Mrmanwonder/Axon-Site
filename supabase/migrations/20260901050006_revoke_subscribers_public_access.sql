-- ============================================================================
-- Reconstructed from the live project's migration history (2026-09-04).
-- ============================================================================
-- Applied to production on 2026-09-01; had no file in this directory until the
-- reconciliation pass. The original commentary is kept verbatim below because
-- it is the record of a real and serious finding.
--
-- One deliberate deviation: the two revokes are guarded on the foreign table
-- existing. `public."Subscribers"` comes from the Stripe FDW, configured
-- through the dashboard and created by no migration here, so an unguarded
-- revoke fails a fresh `supabase db reset --local`. Where the table exists the
-- behaviour is identical; production already ran this and will not run it again.
-- ============================================================================

-- AXON_FIX_BRIEF.md §4.E2 — public."Subscribers" is a foreign table (Stripe
-- customers FDW: id, email, name, description, created, attrs) and foreign
-- tables do not respect RLS. Confirmed live: `anon` (fully unauthenticated,
-- the role PostgREST uses for every request with no bearer token) held
-- SELECT, INSERT, UPDATE and DELETE on it, as did `authenticated`. That is
-- every real customer's email and name readable, writable and deletable by
-- anyone who could reach the REST API with no login at all. This revokes
-- anon/authenticated entirely; service_role (the only thing with a
-- legitimate reason to touch Stripe customer data) keeps its access.
do $$
begin
  if to_regclass('public."Subscribers"') is not null then
    revoke all on table public."Subscribers" from anon;
    revoke all on table public."Subscribers" from authenticated;
  end if;
end
$$;
