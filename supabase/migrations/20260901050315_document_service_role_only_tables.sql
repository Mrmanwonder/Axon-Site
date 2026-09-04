-- AXON_FIX_BRIEF.md §4.E5 — these five tables have RLS enabled with zero
-- policies, which means "nobody gets anything" via PostgREST for any role
-- except service_role (which bypasses RLS entirely). That is presumably
-- intended — these are all internal/operational tables with no per-user
-- ownership concept (eval harness runs, raw model-call logs, routing
-- config, the R2 GC queue) — but it was an assumption, not a documented
-- one. Confirmed live (2026-09-01): still zero policies on all five, same
-- as when the brief was written. Making the intent explicit rather than
-- changing the behavior.
comment on table public.eval_result is
  'Service-role only. RLS enabled with no policies is intentional: this is internal accuracy-harness output with no per-guardian/student ownership, never read by a student-facing client.';
comment on table public.eval_run is
  'Service-role only. RLS enabled with no policies is intentional: internal accuracy-harness metadata, never read by a student-facing client.';
comment on table public.model_call is
  'Service-role only. RLS enabled with no policies is intentional: raw per-call model logs (prompt version, tokens, latency, errors) — operational data, not user-facing, and never scoped to a single guardian/student in a way RLS would even express cleanly.';
comment on table public.model_route is
  'Service-role only. RLS enabled with no policies is intentional: pipeline routing configuration (which model, temperature, prompt version per stage) — an operational/admin concern, not user data.';
comment on table public.r2_deletion is
  'Service-role only. RLS enabled with no policies is intentional: the R2 garbage-collection queue mastery-sweep drains (see private.claim_deletions/finish_deletion) — internal plumbing, never read by a student-facing client.';
