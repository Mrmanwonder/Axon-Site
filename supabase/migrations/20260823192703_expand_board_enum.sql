-- ============================================================================
-- 0011 · Boards beyond CBSE
-- ============================================================================
-- Onboarding asked "Board: CBSE" with no way to change it, even though the
-- audience was never CBSE-only in intent. `public.board` had exactly one
-- value, so a student profile could not honestly record IGCSE or AS/A Level.
--
-- Tier 2 matching (canonical_question, chapter) stays board-scoped and simply
-- finds nothing for a board with no scheme library yet — that degrades to
-- Tier 1 exactly as CLAUDE.md already specifies for "no official scheme in
-- the library", not a new failure mode.
--
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a statement
-- that uses the new value, so this migration does nothing but add values.
-- ============================================================================

alter type public.board add value if not exists 'IGCSE';
alter type public.board add value if not exists 'AS_A_LEVEL';

comment on type public.board is
  'CBSE, IGCSE, or AS_A_LEVEL (Cambridge AS & A Level). Chosen once at student profile creation; changing it afterwards goes through support because it re-scopes scheme matching.';
