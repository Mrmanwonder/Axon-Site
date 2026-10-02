-- Test suite: AXO-126 Tutor flag and deletion parity. Rolls back.
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_126_tutor_flag_and_purge.sql
begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

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
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');
insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics'),
 ('aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02','Physics');

-- ── the flag ───────────────────────────────────────────────────────────────
select public._t('clients have no table access to the flag or the purge queue',
  not has_table_privilege('authenticated', 'public.guardian_feature_flag', 'select')
  and not has_table_privilege('authenticated', 'public.guardian_feature_flag', 'update')
  and not has_table_privilege('authenticated', 'public.tutor_purge', 'select'));

insert into public.guardian_feature_flag (guardian_id, flag, enabled)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'tutor_enabled', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select public._t('a guardian with the flag on can use the Tutor', public.tutor_enabled());
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select public._t('a guardian with no flag row cannot (default off)', not public.tutor_enabled());
reset role;

-- ── deletion parity ────────────────────────────────────────────────────────
delete from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a1';
select public._t('deleting a paper queues a Tutor purge for exactly that paper',
  (select count(*) = 1 from public.tutor_purge where paper_id = 'aaaaaaaa-0000-4000-8000-0000000000a1')
  and not exists (select 1 from public.tutor_purge where paper_id = 'aaaaaaaa-0000-4000-8000-0000000000a2'));

update public.student set deleted_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select public._t('erasing a student queues their remaining papers',
  exists (select 1 from public.tutor_purge where paper_id = 'aaaaaaaa-0000-4000-8000-0000000000a2'));

select public._t('a paper is queued once however it is reached',
  (select count(*) = 2 from public.tutor_purge));

-- ── the worker's view of the queue ─────────────────────────────────────────
select public._t('the worker role claims pending purges and counts the attempt',
  (select count(*) = 2 and bool_and(attempts = 1) from public.claim_tutor_purges(10)));

select public.finish_tutor_purge((select id from public.tutor_purge order by id limit 1), null);
select public.finish_tutor_purge((select id from public.tutor_purge order by id desc limit 1), 'tutor purge returned 500');
select public._t('a finished purge drops out; a failed one records why and is claimed again',
  (select count(*) = 1 and bool_and(attempts = 2) from public.claim_tutor_purges(10))
  and exists (select 1 from public.tutor_purge where done_at is not null)
  and exists (select 1 from public.tutor_purge where error = 'tutor purge returned 500'));

select public._t('only service_role can claim or finish purges',
  not has_function_privilege('authenticated', 'public.claim_tutor_purges(integer)', 'execute')
  and has_function_privilege('service_role', 'public.claim_tutor_purges(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.finish_tutor_purge(bigint, text)', 'execute'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;
rollback;
