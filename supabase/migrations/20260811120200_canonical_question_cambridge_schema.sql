-- ============================================================================
-- 0010 · Canonical question enriched with Cambridge paper identity
-- ============================================================================
-- Tier 2 papers (Cambridge past papers and specimen papers) are identified by:
-- syllabus code (0580 = Physics IGCSE), component (paper + optional variant),
-- series (May/June, Oct/Nov, Feb/March), and year.
--
-- Example: 0580/42/M/J/23 → syllabus 0580, paper 4 variant 2, May/June, 2023.
-- canonical_id mirrors Cambridge's own naming convention and file structure.
--
-- series is stored as an enum (not inferred from scan date or calendar month),
-- because Cambridge's sitting schedule is administrative: Feb/March papers may
-- be sat in March by some zones, and some zones don't sit May/June at all.
-- OCR/extraction populates it from the printed code on the paper.
--
-- paper_number and variant are separate columns (queryable for "all Paper 4
-- scripts" analytics) but also materialized into component_code (queryable
-- against Cambridge's filename patterns and public archives).
-- ============================================================================

-- ── qualification_level enum ──────────────────────────────────────────────
-- Technically implied by syllabus_code, but kept explicit and queryable
-- to avoid deriving stage at read time.

create type public.qualification_level as enum (
  'IGCSE',
  'O_LEVEL',
  'AS_LEVEL',
  'A_LEVEL'
);

comment on type public.qualification_level is
  'Cambridge qualification; implied by syllabus code but stored explicitly for queryability.';

-- ── series enum ────────────────────────────────────────────────────────────
-- Cambridge''s administrative series. Not literal calendar months because
-- sittings vary by zone and country.

create type public.cambridge_series as enum (
  'MAY_JUNE',
  'OCT_NOV',
  'FEB_MARCH'
);

comment on type public.cambridge_series is
  'Cambridge examination series (administrative, not calendar month). OCR/extraction populates from printed code on paper.';

-- ── canonical_question enrichment ──────────────────────────────────────────

alter table public.canonical_question
  add column if not exists syllabus_code text
    check (syllabus_code is null or syllabus_code ~ '^[0-9]{4}$'),
  add column if not exists qualification_level public.qualification_level,
  add column if not exists series public.cambridge_series,
  add column if not exists paper_number int
    check (paper_number is null or (paper_number > 0 and paper_number <= 6)),
  add column if not exists variant int
    check (variant is null or (variant > 0 and variant <= 3));

-- ── computed columns ──────────────────────────────────────────────────────
-- component_code: zero-padded paper + variant (e.g. paper 4, variant 2 → "42")
-- canonical_id: Cambridge naming (e.g. "0580/42/M/J/23" for May/June 2023)

alter table public.canonical_question
  add column if not exists component_code text
    generated always as (
      case
        when paper_number is null then null
        when variant is null then lpad(paper_number::text, 2, '0')
        else lpad(paper_number::text, 2, '0') || lpad(variant::text, 1, '0')
      end
    ) stored;

-- ── canonical_id as regular column ────────────────────────────────────────
-- Stored rather than generated to avoid immutability constraints. Populated
-- during OCR/extraction or via update triggers when component fields change.
-- Format mirrors Cambridge's own naming: "0580/42/M/J/23".

alter table public.canonical_question
  add column if not exists canonical_id text
    unique;

comment on column public.canonical_question.syllabus_code is
  'Cambridge four-digit syllabus code (e.g. 0580 for Physics IGCSE, 9702 for Physics A Level). NULL for non-Cambridge or non-past-paper rows.';

comment on column public.canonical_question.qualification_level is
  'Cambridge qualification level (IGCSE, O_LEVEL, AS_LEVEL, A_LEVEL). Kept explicit for queryability even though implied by syllabus_code.';

comment on column public.canonical_question.series is
  'Cambridge examination series (MAY_JUNE, OCT_NOV, FEB_MARCH). Populated from printed code on paper by OCR/extraction, not inferred from date.';

comment on column public.canonical_question.paper_number is
  'Component paper number (1–6). Queryable independently for analytics ("all Paper 4 scripts").';

comment on column public.canonical_question.variant is
  'Paper variant (1–3, nullable). Some series/syllabus combinations have no variants. Paper 4 variant 2 materializes to component "42".';

comment on column public.canonical_question.component_code is
  'Computed: zero-padded paper + variant as Cambridge''s two-digit component code (e.g. "42"). Matches Cambridge''s filename and archive structure.';

comment on column public.canonical_question.canonical_id is
  'Cambridge''s own naming convention (e.g. "0580/42/M/J/23"). Populated during OCR/extraction. Used to match against publicly released past papers, examiner reports, and paper filenames. Unique to prevent duplicate canonical questions.';
