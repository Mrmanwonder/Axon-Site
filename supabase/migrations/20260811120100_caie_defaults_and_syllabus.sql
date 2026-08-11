-- ============================================================================
-- 0009 · CAIE becomes the default, and subjects carry their syllabus code
-- ============================================================================
-- Separate from 0008 because the enum value it depends on had to commit first.
--
-- Existing rows are left alone. A CBSE student stays CBSE: re-pointing an
-- account at a different board would silently re-scope every paper already
-- analysed against CBSE schemes, which is exactly the migration the board
-- change sheet says is not self-serve.
-- ============================================================================

alter table public.student            alter column board set default 'CAIE';
alter table public.chapter            alter column board set default 'CAIE';
alter table public.canonical_question alter column board set default 'CAIE';

-- ── syllabus code ──────────────────────────────────────────────────────────
-- The code is what actually identifies a Cambridge subject. "Physics" is 0625
-- at IGCSE and 9702 at A Level: different syllabuses, different papers,
-- different mark schemes. Matching a past paper on the subject name alone would
-- reach for the wrong scheme, which hard rule 2 forbids more strongly than it
-- forbids having no scheme at all.
--
-- Nullable, because a CBSE row has no such code and inventing one would be a
-- fabrication of exactly the kind the rule is about.

alter table public.student_subject add column if not exists syllabus_code text
  check (syllabus_code is null or syllabus_code ~ '^[0-9]{4}$');

comment on column public.student_subject.syllabus_code is
  'Cambridge syllabus code (four digits, e.g. 9702 for A Level Physics). NULL for boards that do not use one.';
