-- The student's avatar.
--
-- One seed, not two. The guardian is the auth principal but never uses the app —
-- their surface is email — so there is exactly one face in the interface and
-- exactly one column to hold it.
--
-- Nullable on purpose, and left that way rather than backfilled. Null means "no
-- choice has been made", and the client derives a preset deterministically from
-- the row id instead. That gives every existing student a stable avatar the
-- moment this ships, without writing a value that would be indistinguishable
-- from one they picked themselves.
--
-- The value is a ShaderGradient preset key. It is checked for shape, not for
-- membership: an enum here would mean a migration every time the set changes,
-- and a seed the client does not recognise already falls back to the derived
-- preset. Bad data degrades to the default rather than to a broken face.

alter table public.student
  add column avatar_seed text
    check (avatar_seed is null or avatar_seed ~ '^[a-zA-Z][a-zA-Z0-9_-]{0,39}$');

comment on column public.student.avatar_seed is
  'ShaderGradient preset key chosen by the student. Null means derive it from id.';

-- No RLS change. student_update_own already scopes updates to the guardian''s
-- own rows, and a new column on an existing table inherits the table''s policies.
