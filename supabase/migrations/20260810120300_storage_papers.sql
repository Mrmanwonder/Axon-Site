-- ============================================================================
-- 0004 · Private storage for uploaded papers
-- ============================================================================
-- Uploaded papers are images of children's handwriting alongside a teacher's
-- marks. The bucket is private; access is by signed URL only. There is no code
-- path that produces a public URL, and `public = false` below means Supabase
-- will not serve one even if asked.
--
-- Path convention, enforced by the policies rather than by convention alone:
--     papers/<student_id>/<paper_id>/<page>.jpg
-- The first path segment must be a student the current session's guardian owns.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'papers',
  'papers',
  false,                                     -- never public
  25 * 1024 * 1024,                          -- 25 MB per page
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by Supabase; we add scoped policies.

-- Ownership test shared by all four policies: first path segment is a student
-- belonging to the guardian who owns this session.
create or replace function public.owns_storage_student_prefix(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.student s
    where s.guardian_id = public.current_guardian_id()
      and s.id::text = (storage.foldername(object_name))[1]
  );
$$;

comment on function public.owns_storage_student_prefix is
  'True when the first segment of a storage object path is a student owned by the current session''s guardian.';

revoke all on function public.owns_storage_student_prefix(text) from public, anon;
grant execute on function public.owns_storage_student_prefix(text) to authenticated;

create policy papers_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'papers' and public.owns_storage_student_prefix(name));

-- Uploading is additionally gated on store_papers consent still being granted,
-- so withdrawal stops new uploads rather than merely hiding existing ones.
create policy papers_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'papers'
    and public.owns_storage_student_prefix(name)
    and public.consent_is_granted(
          public.current_guardian_id(),
          ((storage.foldername(name))[1])::uuid,
          'store_papers')
  );

create policy papers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'papers' and public.owns_storage_student_prefix(name))
  with check (bucket_id = 'papers' and public.owns_storage_student_prefix(name));

-- Supabase installs a storage.protect_delete() trigger that refuses direct SQL
-- DELETE on storage.objects, so this policy only ever applies on the Storage API
-- path. It cannot be exercised from SQL and therefore is not covered by
-- supabase/tests/rls_storage.sql — deletion authorisation needs an API-level test.
create policy papers_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'papers' and public.owns_storage_student_prefix(name));

-- No policy for `anon`: an anonymous caller holding the publishable key can
-- neither list nor read any object in this bucket.
