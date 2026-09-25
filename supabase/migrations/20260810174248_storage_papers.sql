-- ============================================================================
-- 0004 · Private storage for uploaded papers
-- ============================================================================
-- Uploads are images of a child's handwriting alongside a teacher's marks. The
-- bucket is private and access is by signed URL only; nothing here can produce
-- a public URL.
--
-- Path convention, enforced by policy rather than by convention:
--     papers/<student_id>/<paper_id>/<page>.jpg
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('papers', 'papers', false, 25 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.owns_storage_student_prefix(object_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.student s
    where s.guardian_id = public.current_guardian_id()
      and s.id::text = (storage.foldername(object_name))[1]);
$$;

revoke all on function public.owns_storage_student_prefix(text) from public, anon;
grant execute on function public.owns_storage_student_prefix(text) to authenticated;

create policy papers_select_own on storage.objects for select to authenticated
  using (bucket_id = 'papers' and public.owns_storage_student_prefix(name));

-- Upload additionally requires store_papers consent to be currently granted, so
-- withdrawal stops new uploads rather than only hiding existing ones.
create policy papers_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'papers'
    and public.owns_storage_student_prefix(name)
    and public.consent_is_granted(
          public.current_guardian_id(),
          ((storage.foldername(name))[1])::uuid,
          'store_papers'));

create policy papers_update_own on storage.objects for update to authenticated
  using (bucket_id = 'papers' and public.owns_storage_student_prefix(name))
  with check (bucket_id = 'papers' and public.owns_storage_student_prefix(name));

-- Supabase installs storage.protect_delete(), which refuses direct SQL DELETE on
-- storage.objects, so this policy only ever applies on the Storage API path. It
-- cannot be exercised from SQL and so is asserted to exist rather than tested.
create policy papers_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'papers' and public.owns_storage_student_prefix(name));

-- No policy for anon: a client holding only the publishable key can neither list
-- nor read any object in this bucket.
