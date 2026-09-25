-- ============================================================================
-- The avatar seed becomes something a student can actually set
-- ============================================================================
-- `student.avatar_seed` was added as a random hex string with a check that
-- allowed nothing else. That was right for what it was for — a stable,
-- opaque, non-personal value to derive a face from — but it left the column
-- read-only in practice: there was no value a student could put in it that
-- would pass, so the picker had nowhere to write.
--
-- The column now holds one of two shapes, and which one it is carries the
-- meaning:
--
--   · the original random hex  — nobody has chosen; derive the preset from it
--   · a ShaderGradient preset key — chosen deliberately; use it
--
-- Existing rows keep their hex and keep the exact face they had, because the
-- client derives from the seed itself. Nothing is backfilled and nothing is
-- rewritten: writing a preset key into every row would make "assigned by us"
-- indistinguishable from "picked by them", and the difference is the whole
-- reason the two shapes are allowed to coexist.
--
-- Checked for shape and not for membership. An enum here would mean a
-- migration every time the preset set changes, and the client already falls
-- back to the derived preset for a key it does not recognise — so bad data
-- degrades to the default face rather than to a broken one.
--
-- Still no image. There is no avatar bucket, no upload path and no column
-- anywhere that could hold a photograph of a child. That is unchanged and is
-- not a gap to be filled later.
-- ============================================================================

alter table public.student
  drop constraint if exists student_avatar_seed_opaque;

alter table public.student
  add constraint student_avatar_seed_opaque
  check (
    avatar_seed ~ '^[0-9a-f]{8,64}$'          -- derived: the original random seed
    or avatar_seed ~ '^[a-zA-Z][a-zA-Z0-9]{0,39}$'  -- chosen: a preset key
  );

comment on column public.student.avatar_seed is
  'Either the original random hex seed (nobody has chosen; the client derives a '
  'preset from it) or a ShaderGradient preset key the student picked. Never '
  'derived from the name or any other personal data. This app stores no user '
  'images: there is no avatar bucket and no upload path, by design.';

-- No RLS change. `student` already scopes updates to the guardian's own rows,
-- and this is the same column under a wider check, not a new one.
