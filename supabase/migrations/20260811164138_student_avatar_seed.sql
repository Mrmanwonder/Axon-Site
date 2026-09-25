-- ============================================================================
-- 0009 · Deterministic avatar seed on the student profile
-- ============================================================================
-- The app never accepts a photograph. There is no avatar bucket, no upload
-- path, and no column anywhere that could hold an image of a child. The avatar
-- is drawn client-side from this seed, so the identity a student sees is stable
-- across devices without any image ever existing.
--
-- The seed is random, not derived from the name: a seed derived from personal
-- data is personal data, and this one is handed to a renderer.
-- ============================================================================

-- The default is volatile, so Postgres cannot take the fast-default path: it
-- rewrites the table and evaluates the expression once per row. Existing
-- students therefore get distinct seeds rather than all sharing one, which a
-- constant default would have produced.
alter table public.student
  add column avatar_seed text not null default encode(gen_random_bytes(8), 'hex');

-- Bounded and opaque. The charset check keeps it renderer-safe and, more to the
-- point, keeps anyone from later stuffing a name or a handle in here.
alter table public.student
  add constraint student_avatar_seed_opaque
  check (avatar_seed ~ '^[0-9a-f]{8,64}$');

comment on column public.student.avatar_seed is
  'Opaque random seed for a deterministically generated avatar. Never derived from the student''s name or any other personal data. This app stores no user images: there is no avatar bucket and no upload path, by design.';
