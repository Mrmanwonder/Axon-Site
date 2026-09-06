-- ============================================================================
-- Test suite: the verification doctrine
-- ============================================================================
-- Addendum C. The model proposes; deterministic code disposes. These are the
-- rules that stop the pipeline shipping a claim nothing checked, expressed
-- where they cannot be forgotten by a later prompt change.
--
-- Every fixture below is shaped from a real row in the live database:
--
--   the same answer stored with `recognition: false` beside `arithmetic: true`,
--   committing marks anyway;
--   `2a` and `2. a)` on one paper for the same question, so a string comparison
--   sees no clash;
--   an adjudication reading "the pipeline seems to have misidentified the
--   question labels or order" on a committed row carrying marks_awarded = 3.00.
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/verification_doctrine.sql
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
 ('00000000-0000-0000-0000-000000000000','33333333-3333-4333-8333-333333333333','authenticated','authenticated','vc@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact, verified_at, verification_method, verification_ref) values
 ('cccccccc-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','Guardian C','c@test.invalid',now(),'stub','ref-c');

insert into public.consent_event (guardian_id, student_id, purpose, granted, notice_version, method)
select g.id, null, cp.purpose, true, 'v1.0', 'in_app_itemised'
from public.guardian g cross join public.consent_purpose cp
where cp.is_required and g.id = 'cccccccc-0000-4000-8000-000000000001';

insert into public.student (id, guardian_id, first_name, class_level, age_band) values
 ('cccccccc-0000-4000-8000-000000000002','cccccccc-0000-4000-8000-000000000001','Cai',11,'under_18');

insert into public.paper (id, student_id, type, tier, date_taken) values
 ('cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002','school_test','tier_1','2026-09-01'),
 ('cccccccc-0000-4000-8000-000000000004','cccccccc-0000-4000-8000-000000000002','school_test','tier_1','2026-09-01'),
 ('cccccccc-0000-4000-8000-000000000005','cccccccc-0000-4000-8000-000000000002','school_test','tier_1','2026-09-01');

-- question_region.run_id carries a composite foreign key to
-- extraction_run(id, student_id), so every run a region hangs off must exist.
insert into public.extraction_run (id, paper_id, student_id, pipeline_version) values
 ('cccccccc-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002','test'),
 ('cccccccc-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002','test');

-- ── 1 · a signal may say it does not know ───────────────────────────────────
-- "Not Normalized" is two words with no arithmetic in them. Live rows carried
-- an `arithmetic` verdict on it anyway — false on one run, true on four others.
-- A boolean has no way to say the check does not apply, so it guessed.

do $$ begin begin
  insert into public.question_region (run_id, paper_id, student_id, order_index, confidence_signals)
  values ('cccccccc-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002',0,
          '{"arithmetic":"unknown","structural":true,"recognition":true,"plausibility":"unknown"}');
  perform public._t('a signal may be unknown', true);
exception when others then perform public._t('a signal may be unknown', false, sqlstate); end; end $$;

do $$ begin begin
  insert into public.question_region (run_id, paper_id, student_id, order_index, confidence_signals)
  values ('cccccccc-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002',1,
          '{"arithmetic":"probably"}');
  perform public._t('a fifth signal value is refused', false, 'insert succeeded');
exception when check_violation then perform public._t('a fifth signal value is refused', true); end; end $$;

-- ── 2 · the answer is not a string ──────────────────────────────────────────
-- Handwritten 8/2 was stored as "8+1", turning a correct step into a false one,
-- because text has nowhere to put a fraction.

do $$ begin begin
  insert into public.question_region (run_id, paper_id, student_id, order_index, answer_block)
  values ('cccccccc-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002',2,
          '{"lines":[{"segments":[{"type":"math","latex":"\\tfrac{8}{2}","annotations":["boxed"],"bbox":{"x":1,"y":1,"w":9,"h":9,"page_index":0},"confidence":0.9}],"role":"final_answer"}],"notation_profile":"caie_cs","raw_text":"8/2"}');
  perform public._t('a structured answer stores with its annotations', true);
exception when others then perform public._t('a structured answer stores with its annotations', false, sqlstate); end; end $$;

do $$ begin begin
  insert into public.question_region (run_id, paper_id, student_id, order_index, answer_block)
  values ('cccccccc-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002',3,
          '{"lines":"not an array"}');
  perform public._t('a malformed answer_block is refused', false, 'insert succeeded');
exception when check_violation then perform public._t('a malformed answer_block is refused', true); end; end $$;

-- ── 3 · one question, one region, per run ───────────────────────────────────
-- Production holds "2a" and "2. a)" for the same question on the same paper, so
-- a raw string comparison sees no clash and Insights counts it twice.

do $$ begin
  insert into public.question_region (run_id, paper_id, student_id, order_index, question_label, created_at)
  values ('cccccccc-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002',4,'2a', now());
  begin
    insert into public.question_region (run_id, paper_id, student_id, order_index, question_label, created_at)
    values ('cccccccc-0000-4000-8000-000000000010','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002',5,'2. a)', now());
    perform public._t('2a and 2. a) are the same question', false, 'both inserted');
  exception when unique_violation then perform public._t('2a and 2. a) are the same question', true);
  end;
  -- A re-scan is legitimate and makes its own run, so the same label may repeat.
  insert into public.question_region (run_id, paper_id, student_id, order_index, question_label, created_at)
  values ('cccccccc-0000-4000-8000-000000000011','cccccccc-0000-4000-8000-000000000003','cccccccc-0000-4000-8000-000000000002',0,'2a', now());
  perform public._t('a re-scan may repeat a label on its own run', true);
end $$;

select public._t('a paper resolves to exactly one canonical run',
  (select count(*) <= 1 from public.paper_canonical_run
    where paper_id = 'cccccccc-0000-4000-8000-000000000003'));

-- ── 4 · the commit gates ────────────────────────────────────────────────────

-- An adjudication that reported a structural problem must stop the paper. The
-- live row that motivated this wrote its own finding into the record and
-- committed marks_awarded = 3.00 regardless.
do $$
declare v_run uuid := gen_random_uuid();
begin
  insert into public.extraction_run (id, paper_id, student_id, pipeline_version, adjudication)
  values (v_run,'cccccccc-0000-4000-8000-000000000004','cccccccc-0000-4000-8000-000000000002','test',
          '{"blocks_commit":true,"blocked_reason":"adjudication reported misidentified question labels"}');
  insert into public.question_region (run_id, paper_id, student_id, order_index, question_label,
                                      marks_awarded, marks_available, confidence_tier, needs_review, student_confirmed_at, created_at)
  values (v_run,'cccccccc-0000-4000-8000-000000000004','cccccccc-0000-4000-8000-000000000002',0,'c',3,3,'confident',false,now(), now());
  begin
    perform public.commit_extraction_run(v_run);
    perform public._t('a structural adjudication blocks the commit', false, 'committed anyway');
  exception when insufficient_privilege then perform public._t('a structural adjudication blocks the commit', true);
  end;
end $$;

-- Two regions claiming the same question means at least one set of marks is on
-- the wrong question, and there is no safe way to guess which.
do $$
declare v_run uuid := gen_random_uuid();
begin
  insert into public.extraction_run (id, paper_id, student_id, pipeline_version)
  values (v_run,'cccccccc-0000-4000-8000-000000000005','cccccccc-0000-4000-8000-000000000002','test');
  -- created_at before the index cutoff, so this exercises the commit gate
  -- rather than being refused at insert time.
  insert into public.question_region (run_id, paper_id, student_id, order_index, question_label,
                                      marks_awarded, marks_available, confidence_tier, needs_review, student_confirmed_at, created_at)
  values (v_run,'cccccccc-0000-4000-8000-000000000005','cccccccc-0000-4000-8000-000000000002',0,'2a',2,2,'confident',false,now(),'2026-09-01'),
         (v_run,'cccccccc-0000-4000-8000-000000000005','cccccccc-0000-4000-8000-000000000002',1,'2. a)',2,2,'confident',false,now(),'2026-09-01');
  begin
    perform public.commit_extraction_run(v_run);
    perform public._t('the same question read twice blocks the commit', false, 'committed anyway');
  exception when insufficient_privilege then perform public._t('the same question read twice blocks the commit', true);
  end;
end $$;

-- A clean paper still commits, and the structure survives into the attempt —
-- otherwise the screen falls back to the flat string and this was all for
-- nothing.
do $$
declare v_run uuid := gen_random_uuid(); v_paper uuid := gen_random_uuid();
begin
  insert into public.paper (id, student_id, type, tier, date_taken)
  values (v_paper,'cccccccc-0000-4000-8000-000000000002','school_test','tier_1','2026-09-01');
  insert into public.extraction_run (id, paper_id, student_id, pipeline_version, adjudication)
  values (v_run, v_paper,'cccccccc-0000-4000-8000-000000000002','test','{"cause":"ok"}');
  insert into public.question_region (run_id, paper_id, student_id, order_index, question_label,
                                      marks_awarded, marks_available, confidence_tier, needs_review,
                                      student_confirmed_at, answer_block, created_at)
  values (v_run, v_paper,'cccccccc-0000-4000-8000-000000000002',0,'a',3,3,'confident',false,now(),
          '{"lines":[{"segments":[{"type":"math","latex":"\\tfrac{8}{2}","annotations":[]}],"role":"working"}],"notation_profile":"caie_cs","raw_text":"8/2"}', now());
  perform public.commit_extraction_run(v_run);
  perform public._t('a clean paper still commits',
    (select count(*) = 1 from public.student_attempt where paper_id = v_paper));
  perform public._t('the answer structure survives the commit',
    (select answer_block -> 'lines' -> 0 -> 'segments' -> 0 ->> 'latex' = '\tfrac{8}{2}'
       from public.student_attempt where paper_id = v_paper));
end $$;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
