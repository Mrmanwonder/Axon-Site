-- ============================================================================
-- Test suite: AXO-122 question counting contract
-- ============================================================================
-- questions_total counts distinct top-level question numbers, not region rows.
-- The cases live in tests/fixtures/question-count-contract.json and are shared
-- with the TypeScript mirror (src/questionCount.js); both must agree.
--
-- Rolls back; safe against any database. Run from the repository root:
--
--   psql "$DATABASE_URL" -f supabase/tests/axo_122_question_count_contract.sql
--   Pass: the counts line reports failed = 0.
-- ============================================================================

\set fixture `cat tests/fixtures/question-count-contract.json`

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

select set_config('axo122.fixture', :'fixture', true) as _ \gset

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-4111-8111-111111111111','authenticated','authenticated','ga@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Guardian A','a@test.invalid',now(),'stub','ref-a');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp where cp.is_required;

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Anya',11,'under_18');

-- ── every fixture case, against the real schema ────────────────────────────

do $$
declare
  stu constant uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  c jsonb;
  r jsonb;
  pid uuid;
  rid uuid;
  got record;
  exp jsonb;
  ok boolean;
begin
  for c in select * from jsonb_array_elements(current_setting('axo122.fixture')::jsonb -> 'cases') loop
    pid := gen_random_uuid();
    rid := gen_random_uuid();
    insert into public.paper (id, student_id, type, tier, date_taken, subject)
    values (pid, stu, 'unit_test', 'tier_1', '2026-08-01', 'Physics');
    insert into public.extraction_run (id, paper_id, student_id, pipeline_version, reconciled)
    values (rid, pid, stu, '1.0.0', true);

    for r in select * from jsonb_array_elements(c -> 'regions') loop
      insert into public.question_region (
        run_id, paper_id, student_id, order_index, page_spans,
        question_label, question_label_box, marks_awarded, marks_awarded_box)
      values (
        rid, pid, stu, (r ->> 'order_index')::integer,
        jsonb_build_array(jsonb_build_object('page', (r ->> 'page')::integer,
          'box', jsonb_build_object('x', 10, 'y', (r ->> 'y')::numeric, 'w', 100, 'h', 100))),
        r ->> 'label',
        case when r ->> 'label' is null then null
             else jsonb_build_object('page', (r ->> 'page')::integer, 'x', 1, 'y', 1, 'w', 1, 'h', 1) end,
        case when (r ->> 'evidence')::boolean then 1 end,
        case when (r ->> 'evidence')::boolean
             then jsonb_build_object('page', (r ->> 'page')::integer, 'x', 1, 'y', 1, 'w', 1, 'h', 1) end);
    end loop;

    select * into got from public.question_count_contract(rid);
    exp := c -> 'expected';
    ok := got.questions_total  = (exp ->> 'questions_total')::integer
      and got.parts_total      = (exp ->> 'parts_total')::integer
      and got.unassigned_parts = (exp ->> 'unassigned_parts')::integer
      and got.raw_region_count = (exp ->> 'raw_region_count')::integer;
    perform public._t(c ->> 'name', ok,
      format('got q=%s parts=%s unassigned=%s raw=%s; expected %s',
             got.questions_total, got.parts_total, got.unassigned_parts, got.raw_region_count, exp));
  end loop;
end $$;

-- ── the view reports the contract, and stored labels are untouched ─────────

select public._t(
  'paper_progress.questions_total is the logical count, not the region count',
  (select p.questions_total = 5 and p.parts_total = 12 and p.unassigned_parts = 3 and p.raw_region_count = 12
     from public.paper_progress p
     join public.question_region qr on qr.run_id = p.run_id
    group by p.run_id, p.questions_total, p.parts_total, p.unassigned_parts, p.raw_region_count
   having count(*) = 12 limit 1),
  'run 89c8d7a9-shaped fixture should read 5 / 12 / 3 / 12');

select public._t(
  'normalization does not rewrite stored labels',
  (select count(*) = 1 from public.question_region where question_label = '(c)')
    and (select count(*) = 1 from public.question_region where question_label = '1b'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
