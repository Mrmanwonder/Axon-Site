-- ============================================================================
-- error_type, and the mark_type gate made structural
-- ============================================================================
-- The Cambridge depth spec asked every loss reason to carry Cambridge's mark
-- notation — M for method, A for accuracy, B for independent. That was left
-- null when it shipped, for a reason the spec's own addendum then confirmed and
-- sharpened:
--
--   * Every paper reaching the explain stage is Tier 1, which by definition has
--     no scheme in the library, so a code assigned there is reconstructed from
--     nothing. Hard rule 2. And a wrong code is worse than no code: it wears
--     official notation while contradicting what the teacher actually marked,
--     which is hard rule 1 wearing a disguise.
--   * Cambridge and Pearson refused third-party reproduction rights. Official
--     scheme content is CBSE-only. Mimicking Cambridge's marking system is not
--     ours to do whether or not a given guess happens to land.
--
-- So the notation stays reserved for a future Tier 2 prompt holding licensed
-- scheme text, and what the spec actually needed it for gets its own field.
--
-- `error_type` is Axon's own category: what the mistake looked like, where
-- `cause` says why it happened. Method, final answer, omitted step,
-- presentation, other. Derived by reading the student's own working against
-- what the step is doing, so it needs no scheme and is available on every
-- paper. None of Cambridge's vocabulary, and no letter codes — the UI renders
-- these as whole words, never as a badge that could pass for real notation.
--
-- No columns are added. `loss_reasons` is jsonb and both fields live inside it,
-- so the addendum's "add error_type alongside the existing mark_type column"
-- describes a shape that is already there. What is missing is the enforcement,
-- which is what this migration is: the addendum asks for the gate to hold by
-- construction rather than convention, and a prompt that can be edited is a
-- convention. A CHECK is not.
-- ============================================================================

-- Immutable so a CHECK can call it. True if any reason carries a mark type at
-- all — null and absent both count as clean.
create or replace function private.loss_reasons_claim_a_mark_type(p_reasons jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_reasons, '[]'::jsonb)) r
    where jsonb_typeof(r) = 'object'
      and r ? 'mark_type'
      and jsonb_typeof(r->'mark_type') <> 'null'
  );
$$;

comment on function private.loss_reasons_claim_a_mark_type(jsonb) is
  'True if any loss reason carries Cambridge mark notation. Exists so a Tier 1 row that claims one is unstorable rather than merely discouraged: Tier 1 has no scheme to ground a code in, and the notation is not ours to reproduce.';

-- Every reason must name one of Axon's five error types. Not Cambridge's
-- vocabulary, and nothing a letter code could hide inside.
create or replace function private.loss_reasons_error_types_valid(p_reasons jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select not exists (
    select 1
    from jsonb_array_elements(coalesce(p_reasons, '[]'::jsonb)) r
    where jsonb_typeof(r) = 'object'
      and coalesce(r->>'error_type', '') not in
          ('method', 'final_answer', 'omitted_step', 'presentation', 'other')
  );
$$;

comment on function private.loss_reasons_error_types_valid(jsonb) is
  'True if every loss reason names one of Axon''s five error types. A reason with no recognised type is a reason we cannot render honestly.';

do $$
declare
  t text;
begin
  foreach t in array array['region_explanation', 'mark_loss_event'] loop
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_error_types_recognised');
    execute format(
      'alter table public.%I add constraint %I check (private.loss_reasons_error_types_valid(loss_reasons))',
      t, t || '_error_types_recognised');
  end loop;
end $$;

-- The gate itself. `region_explanation` knows its own tier, so this is exact:
-- a Tier 1 explanation may not carry mark notation, full stop. Tier 2 is left
-- open, which is the whole point of keeping the field — a future prompt with
-- licensed scheme text in front of it can fill this in honestly.
alter table public.region_explanation
  drop constraint if exists region_explanation_tier1_claims_no_mark_type;
alter table public.region_explanation
  add constraint region_explanation_tier1_claims_no_mark_type check (
    tier <> 'tier_1' or not private.loss_reasons_claim_a_mark_type(loss_reasons)
  );

-- `mark_loss_event` has no tier of its own — it reaches its paper's tier
-- through student_attempt, which a CHECK cannot follow. The gate upstream is
-- what holds: every row here is copied from a region_explanation that already
-- passed it, and the bridge insert in commit_extraction_run is the only writer.
comment on constraint region_explanation_tier1_claims_no_mark_type on public.region_explanation is
  'Hard rule 2 as a constraint. A Tier 1 paper has no marking scheme in the library, so a mark type written against one was reconstructed from nothing; Cambridge notation is also not ours to reproduce. Tier 2 is deliberately unconstrained here, for a future explanation grounded in licensed scheme text.';
