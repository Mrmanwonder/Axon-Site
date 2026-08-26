-- ============================================================================
-- Base table/sequence/routine grants for anon and authenticated on schema
-- public, made explicit rather than assumed.
-- ============================================================================
-- Every hosted Supabase project sets this up automatically at provisioning
-- time (outside migration tracking), which is why the live project has always
-- worked without it. `supabase db reset` / a fresh CI database does not carry
-- that platform-level setup, so every table this codebase's migrations have
-- created so far had RLS policies but no base GRANT for anon/authenticated to
-- even attempt a query -- confirmed by this repo's own supabase/tests/*.sql
-- suites failing "permission denied for table student"/"...guardian" the
-- first time they ran against a genuinely clean database (this PR's new CI
-- job, per AUDIT_2026-08-26.md Finding 9 / PERFECTION_PLAN Phase 4.1).
--
-- CLAUDE.md and AGENTS.md are explicit that RLS is the real gate, not the
-- table grant: "A UI check is a convenience; a policy is the actual
-- boundary." This migration only restores the missing prerequisite for RLS
-- to run at all -- it grants no new access on its own, since every table
-- here still has its RLS policies deciding which rows come back.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
