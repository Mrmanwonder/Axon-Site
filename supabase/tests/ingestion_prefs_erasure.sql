-- ============================================================================
-- Test suite: page ingestion, preferences, and account erasure
-- ============================================================================
-- Companion to rls_and_hard_rules.sql, covering the tables the UI added.
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/ingestion_prefs_erasure.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ── fixtures ───────────────────────────────────────────────────────────────

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-4222-8222-222222222222','authenticated','authenticated','gb@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a'),
 ('bbbbbbbb-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Guardian B','b@test.invalid',now(),'stub','ref-b');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18'),
 ('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000001','Bora',12,'under_18');

insert into public.student_subject values ('aaaaaaaa-0000-4000-8000-000000000002','Physics');

insert into public.paper (id, student_id, type, tier, date_taken) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01'),
 ('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02');

insert into public.paper_page (paper_id, student_id, page_number, source_kind, storage_path, status) values
 ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',1,'upload','aaaaaaaa-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000003/1.jpg','stored'),
 ('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002',1,'upload','x/y/1.jpg','stored');

insert into public.student_attempt (id, student_id, paper_id, paper_tier, question_label, marks_awarded, max_marks, marks_source, extraction_confidence)
 values ('aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000003','tier_1','Q1',3,5,'teacher_pen','confirmed');
insert into public.mark_loss_event (attempt_id, student_id, cause, marks_lost, confidence)
 values ('aaaaaaaa-0000-4000-8000-000000000004','aaaaaaaa-0000-4000-8000-000000000002','presentation',2,'likely');

insert into public.app_preference (guardian_id, theme) values
 ('aaaaaaaa-0000-4000-8000-000000000001','light'),
 ('bbbbbbbb-0000-4000-8000-000000000001','dark');

-- A student-scoped consent decision. This one row is what used to make erasure
-- fail outright, because consent_event.student_id is ON DELETE RESTRICT and the
-- function tried to delete the student.
insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
 values ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','weekly_parent_digest',true,'v1.0','in_app_itemised');

-- ── page integrity ─────────────────────────────────────────────────────────
-- Neither source kind can be recorded as present without the thing that makes
-- it present. An upload with no bytes, or a link with no URL, is a page that
-- looks ingested and is not — the invisible failure hard rule 4 forbids.

do $$ begin begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, status)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',9,'upload','stored');
  perform public._t('an upload page must name its bytes', false, 'insert succeeded');
exception when others then perform public._t('an upload page must name its bytes', true, sqlstate); end; end $$;

do $$ begin begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, status)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',8,'link','pending');
  perform public._t('a link page must name its url', false, 'insert succeeded');
exception when others then perform public._t('a link page must name its url', true, sqlstate); end; end $$;

insert into public.paper_page (paper_id, student_id, page_number, source_kind, source_url, status)
 values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',2,'link','https://x.test/p.pdf','pending');
select public._t('a link page is stored pending, not pretended ingested',
  (select status = 'pending' from public.paper_page
    where paper_id = 'aaaaaaaa-0000-4000-8000-000000000003' and page_number = 2));

-- ── withdrawal stops new pages ─────────────────────────────────────────────

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
 values ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','store_papers',false,'v1.0','in_app_withdrawal');

do $$ begin begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, storage_path, status)
  values ('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000002',3,'upload','p/q/3.jpg','stored');
  perform public._t('page write blocked after consent withdrawal', false, 'insert succeeded');
exception when others then perform public._t('page write blocked after consent withdrawal', true, sqlstate); end; end $$;

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
 values ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','store_papers',true,'v1.0','in_app_itemised');

-- ── RLS on the tables the UI added ─────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('A sees only its own paper_page rows',
  (select count(*) = 2 from public.paper_page)
  and (select count(*) = 0 from public.paper_page where student_id = 'bbbbbbbb-0000-4000-8000-000000000002'));
select public._t('A sees only its own app_preference',
  (select count(*) = 1 from public.app_preference) and (select theme = 'light' from public.app_preference));
select public._t('A sees only its own student_subject', (select count(*) = 1 from public.student_subject));
select public._t('consent_current shows only A''s decisions',
  (select count(*) = 0 from public.consent_current where guardian_id = 'bbbbbbbb-0000-4000-8000-000000000001'));

do $$ declare n int; begin
  update public.app_preference set theme = 'dark' where guardian_id = 'bbbbbbbb-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform public._t('A cannot change B''s preferences', n = 0, 'rows=' || n);
end $$;

do $$ begin begin
  insert into public.paper_page (paper_id, student_id, page_number, source_kind, storage_path, status)
  values ('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002',5,'upload','z/z/5.jpg','stored');
  perform public._t('A cannot add a page to B''s paper', false, 'insert succeeded');
exception when others then perform public._t('A cannot add a page to B''s paper', true, sqlstate); end; end $$;

reset role;
set local role anon;
set local "request.jwt.claims" = '';
select public._t('anon reads no paper_page', (select count(*) = 0 from public.paper_page));
select public._t('anon reads no app_preference', (select count(*) = 0 from public.app_preference));
reset role;

-- ── erasure ────────────────────────────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select public._t('erasure succeeds with a student-scoped consent row present',
  (select (public.delete_my_account() ->> 'students_erased')::int = 1));

reset role;

select public._t('erasure removed papers, pages, attempts, losses and subjects',
  (select count(*) = 0 from public.paper where student_id = 'aaaaaaaa-0000-4000-8000-000000000002')
  and (select count(*) = 0 from public.paper_page where student_id = 'aaaaaaaa-0000-4000-8000-000000000002')
  and (select count(*) = 0 from public.student_attempt where student_id = 'aaaaaaaa-0000-4000-8000-000000000002')
  and (select count(*) = 0 from public.mark_loss_event where student_id = 'aaaaaaaa-0000-4000-8000-000000000002')
  and (select count(*) = 0 from public.student_subject where student_id = 'aaaaaaaa-0000-4000-8000-000000000002'));

select public._t('the student is left as a tombstone, not a record',
  (select first_name = '[erased]' and deleted_at is not null
     from public.student where id = 'aaaaaaaa-0000-4000-8000-000000000002'));

select public._t('erasure stripped guardian data and released auth',
  (select name = '[erased]' and contact = '[erased]' and verification_ref is null
      and auth_user_id is null and deleted_at is not null
     from public.guardian where id = 'aaaaaaaa-0000-4000-8000-000000000001'));

-- The ledger is what proves consent was properly obtained for the period the
-- account existed. Erasure must not destroy it.
select public._t('erasure kept the consent ledger as evidence',
  (select count(*) >= 5 from public.consent_event where guardian_id = 'aaaaaaaa-0000-4000-8000-000000000001'));

select public._t('erasure released the auth row',
  (select count(*) = 0 from auth.users where id = '11111111-1111-4111-8111-111111111111'));

select public._t('erasure left the other guardian untouched',
  (select count(*) = 1 from public.student
    where guardian_id = 'bbbbbbbb-0000-4000-8000-000000000001' and deleted_at is null));

-- A tombstone has no auth_user_id, so no session can ever match it again.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select public._t('a tombstoned account is unreachable by any session',
  (select count(*) = 0 from public.guardian) and (select count(*) = 0 from public.student));
reset role;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
