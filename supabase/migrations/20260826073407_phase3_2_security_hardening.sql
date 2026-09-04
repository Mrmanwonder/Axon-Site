-- ============================================================================
-- Reconstructed from the live project's migration history (2026-09-04).
-- ============================================================================
-- This migration was applied to production on 2026-08-26 and had no file in
-- this directory until the reconciliation pass.
--
-- ── the one deliberate deviation from verbatim ──
-- The original ran its Stripe statements unconditionally. It could do that
-- because production has the Stripe FDW: a `stripe` schema and the
-- `public."Subscribers"` foreign table. NOTHING in this directory creates
-- either — they were configured through the Supabase dashboard, outside the
-- migration history entirely.
--
-- Replayed verbatim, this file is therefore the first statement in a
-- `supabase db reset --local` that fails: `relation "Subscribers" does not
-- exist`, taking CI's whole SQL suite with it. The Stripe statements are
-- wrapped in existence guards so the file is a faithful no-op where the FDW is
-- absent and does exactly what it always did where it is present. Production
-- has already run this migration and will not run it again, so the guards
-- change nothing there.
-- ============================================================================

do $$
begin
  if to_regclass('public."Subscribers"') is not null then
    revoke all on public."Subscribers" from anon, authenticated;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'stripe') then
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'stripe' and p.proname = 'set_updated_at') then
      alter function stripe.set_updated_at() set search_path = 'stripe', 'pg_temp';
    end if;
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'stripe' and p.proname = 'set_updated_at_metadata') then
      alter function stripe.set_updated_at_metadata() set search_path = 'stripe', 'pg_temp';
    end if;
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'stripe' and p.proname = 'check_rate_limit') then
      alter function stripe.check_rate_limit(text, integer, integer) set search_path = 'stripe', 'pg_temp';
    end if;
  end if;
end
$$;

comment on table public.eval_result is 'Service-role only: no RLS policy is intentional. Written by the accuracy-harness/eval pipeline, never read by a student session.';
comment on table public.eval_run is 'Service-role only: no RLS policy is intentional. Written by the accuracy-harness/eval pipeline, never read by a student session.';
comment on table public.model_call is 'Service-role only: no RLS policy is intentional. Cost/latency log written by the mastery-* Workers. If a student-facing cost view is ever wanted, add an explicit policy rather than relying on the empty set.';
comment on table public.model_route is 'Service-role only: no RLS policy is intentional. Config read by the mastery-* Workers via the service key; never exposed to a student session.';
comment on table public.r2_deletion is 'Service-role only: no RLS policy is intentional. Deletion queue for the storage-erasure worker, never read by a student session.';
