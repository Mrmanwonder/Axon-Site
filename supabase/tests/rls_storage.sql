-- ============================================================================
-- Storage RLS test suite — papers bucket
-- ============================================================================
-- Asserts the bucket is private, that a guardian reaches only their own
-- student's path prefix, and that consent withdrawal stops new uploads.
--
-- Rolls back. Assumes migrations 0001–0004 are applied.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/rls_storage.sql
--   Pass: final SELECT reports zero rows with passed = false.
--
-- NOTE ON DELETES: Supabase installs a storage.protect_delete() trigger that
-- refuses direct SQL DELETE on storage.objects — removal must go through the
-- Storage API. So papers_delete_own cannot be exercised from SQL, and this
-- suite asserts the policy exists rather than pretending to test it. Deletion
-- authorisation needs covering at the API level instead.
-- ============================================================================

begin;

create table public._rls_test_results (
  seq serial primary key, name text not null, passed boolean not null, detail text);
grant all on public._rls_test_results to authenticated, anon;
grant usage, select on sequence public._rls_test_results_seq_seq to authenticated, anon;

create or replace function public._t(p_name text, p_passed boolean, p_detail text default null)
returns void language sql as $$
  insert into public._rls_test_results (name, passed, detail) values (p_name, p_passed, p_detail);
$$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ── fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111',
   'authenticated', 'authenticated', 'storage-a@test.invalid', 'x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
   'authenticated', 'authenticated', 'storage-b@test.invalid', 'x', now(), now(), now());

insert into public.guardian (id, auth_user_id, name, contact) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'A', 'a@test.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'B', 'b@test.invalid');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, board, class_level, age_band) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Anya', 'CBSE', 11, 'under_18'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'Bora', 'CBSE', 12, 'under_18');

insert into storage.objects (id, bucket_id, name) values
  (gen_random_uuid(), 'papers', 'aaaaaaaa-0000-4000-8000-000000000002/paper1/page1.jpg'),
  (gen_random_uuid(), 'papers', 'bbbbbbbb-0000-4000-8000-000000000002/paper1/page1.jpg');

-- ── bucket configuration ───────────────────────────────────────────────────

select public._t('papers bucket exists and is private',
  (select public = false from storage.buckets where id = 'papers'));

select public._t('delete policy exists for the Storage API path',
  (select count(*) = 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname = 'papers_delete_own'));

-- ── guardian A ─────────────────────────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('A sees only its own student''s objects',
  (select count(*) = 1 from storage.objects where bucket_id = 'papers')
  and (select count(*) = 1 from storage.objects
       where name like 'aaaaaaaa-0000-4000-8000-000000000002/%'));

select public._t('A cannot see B''s objects',
  (select count(*) = 0 from storage.objects
   where name like 'bbbbbbbb-0000-4000-8000-000000000002/%'));

do $$ begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (gen_random_uuid(), 'papers', 'bbbbbbbb-0000-4000-8000-000000000002/x/y.jpg');
    perform public._t('A cannot upload into B''s prefix', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('A cannot upload into B''s prefix', true, sqlstate);
  end;
end $$;

do $$ begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (gen_random_uuid(), 'papers', 'aaaaaaaa-0000-4000-8000-000000000002/x/y.jpg');
    perform public._t('A can upload into its own prefix', true, null);
  exception when others then
    perform public._t('A can upload into its own prefix', false, 'raised ' || sqlstate);
  end;
end $$;

-- A path whose first segment is not a uuid must not slip through the cast.
do $$ begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (gen_random_uuid(), 'papers', 'not-a-uuid/x/y.jpg');
    perform public._t('malformed path prefix is rejected', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('malformed path prefix is rejected', true, sqlstate);
  end;
end $$;

reset role;

-- ── withdrawal stops new uploads ───────────────────────────────────────────

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
        'store_papers', false, 'v1.0', 'in_app_withdrawal');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$ begin
  begin
    insert into storage.objects (id, bucket_id, name)
    values (gen_random_uuid(), 'papers', 'aaaaaaaa-0000-4000-8000-000000000002/z/y.jpg');
    perform public._t('upload blocked after consent withdrawal', false, 'insert unexpectedly succeeded');
  exception when others then
    perform public._t('upload blocked after consent withdrawal', true, sqlstate);
  end;
end $$;

-- Withdrawal stops new processing; it does not retroactively deny reads. Erasure
-- is the separate retention path in the Privacy Policy, not an RLS concern.
select public._t('existing objects remain readable after withdrawal',
  (select count(*) >= 1 from storage.objects where bucket_id = 'papers'));

reset role;

-- ── anon ───────────────────────────────────────────────────────────────────
set local role anon;
set local "request.jwt.claims" = '';

select public._t('anon sees no objects in papers',
  (select count(*) = 0 from storage.objects where bucket_id = 'papers'));

reset role;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._rls_test_results;

select seq, name, passed, detail from public._rls_test_results where not passed order by seq;

rollback;
