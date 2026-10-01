-- ============================================================================
-- Test suite: AXO-124 paper totals follow what was committed
-- ============================================================================
--   · committing a run sets paper.total_awarded / total_available from the attempts written,
--     not from the first reading the reconcile worker stored
--   · a run that commits nothing leaves the totals alone
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_124_paper_totals.sql
--   Pass: the counts line reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');

-- Paper 1: the reconcile worker stored 22 / 29 from the first reading; review then raised one
-- mark, so the confirmed marks sum to 23 / 29.
insert into public.paper (id, student_id, type, tier, date_taken, subject, total_awarded, total_available) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics', 22, 29),
 ('aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02','Physics', 5, 9);

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status, reconciled) values
 ('aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', false),
 ('aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','ready', true);

create or replace function public._region(p_id uuid, p_run uuid, p_paper uuid, p_order int,
                                          p_awarded numeric, p_available numeric, p_tier text default 'confident')
returns void language plpgsql as $$
begin
  insert into public.question_region (id, run_id, paper_id, student_id, order_index, question_label,
      marks_awarded, marks_awarded_box, marks_available, marks_available_box,
      confidence_tier, needs_review, student_confirmed_at)
  values (p_id, p_run, p_paper, 'aaaaaaaa-0000-4000-8000-000000000002', p_order, 'Q' || (p_order + 1),
      p_awarded, '{"page":1,"x":1,"y":1,"w":1,"h":1}', p_available, '{"page":1,"x":2,"y":2,"w":1,"h":1}',
      p_tier::public.confidence_tier, false, now());
end $$;

select public._region('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1', 0, 10, 12);
select public._region('aaaaaaaa-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1', 1, 13, 17);
-- Paper 2: its only region is unreadable, so nothing commits.
select public._region('aaaaaaaa-0000-4000-8000-0000000000c3','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 0, null, null, 'unreadable');

select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b1');
select public.commit_extraction_run('aaaaaaaa-0000-4000-8000-0000000000b2');

select public._t('committing sets total_awarded from the attempts, not the first reading',
  (select total_awarded = 23 from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'),
  (select total_awarded::text from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'));
select public._t('committing sets total_available from the attempts',
  (select total_available = 29 from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a1'));
select public._t('the stored total equals the sum of the committed attempts',
  (select p.total_awarded = (select sum(marks_awarded) from public.student_attempt where paper_id = p.id)
     from public.paper p where p.id = 'aaaaaaaa-0000-4000-8000-0000000000a1'));
select public._t('a run that commits nothing leaves the paper totals alone',
  (select total_awarded = 5 and total_available = 9 from public.paper where id = 'aaaaaaaa-0000-4000-8000-0000000000a2'));
select public._t('the reconciled flag is not rewritten by the commit',
  (select reconciled = false from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b1'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
