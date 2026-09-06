-- ============================================================================
-- Whole marks only
-- ============================================================================
-- CAIE awards integer marks at IGCSE, AS and A Level. No teacher marking a
-- Cambridge paper writes 0.5 against a part, and the review sheet was offering
-- it: the "which number did your teacher write?" row stepped on a half-mark
-- grid, so a 3-mark question awarded 1 offered 0 · 0.5 · 1 · 1.5 · 2 · 3.
--
-- Three things go wrong with that, in increasing order of cost:
--
--   It tells a Cambridge student we do not know how their board works.
--   It lets them record a mark that cannot exist, which flows into
--     student_attempt and out into the analytics as unreliable data.
--   It defeats reconciliation. A paper whose totals only balance once a half
--     mark is admitted is the reconciler reporting that the *extraction* is
--     wrong. A half-mark option turns that signal into a shrug.
--
-- The chip row is fixed in src/scan/review.js. This is the other half: a half
-- mark should be unrepresentable, not merely un-offered, so that a model
-- returning 0.5 or a hand-written API call is rejected rather than stored.
--
-- Verified before writing: no non-integer value exists in any of these columns
-- in production today, so these constraints are added valid with nothing to
-- migrate. `numeric` is kept rather than moved to smallint — the columns are
-- numeric(5,2) across six tables and two views read them, and the CHECK makes
-- the scale unusable without a rewrite that buys nothing.
--
-- Deliberately NOT constrained here:
--   canonical_question.max_marks   already smallint
--   attempt_analytics, mark_loss_analytics, review_queue   views, not tables
-- ============================================================================

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('question_region',    'marks_awarded'),
      ('question_region',    'marks_available'),
      ('student_attempt',    'marks_awarded'),
      ('student_attempt',    'max_marks'),
      ('region_explanation', 'marks_lost'),
      ('mark_loss_event',    'marks_lost')
    ) as t(tbl, col)
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      spec.tbl, spec.tbl || '_' || spec.col || '_whole');
    -- floor() rather than a scale check: numeric(5,2) will happily hold 1.00,
    -- and 1.00 is a whole mark. What must be impossible is a value with a
    -- fractional part, however it is spelled.
    execute format(
      'alter table public.%I add constraint %I check (%I is null or %I = floor(%I))',
      spec.tbl,
      spec.tbl || '_' || spec.col || '_whole',
      spec.col, spec.col, spec.col);
  end loop;
end $$;

comment on constraint question_region_marks_awarded_whole on public.question_region is
  'CAIE awards whole marks only. A fractional mark here is an extraction failure to surface, not a value to store.';
comment on constraint student_attempt_marks_awarded_whole on public.student_attempt is
  'CAIE awards whole marks only. marks_source is teacher_pen or official_scheme; neither writes halves.';
