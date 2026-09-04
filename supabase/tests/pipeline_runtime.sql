-- ============================================================================
-- Test suite: the queue runtime
-- ============================================================================
-- The three things this layer exists to get right, and the three that are
-- hardest to see going wrong:
--
--   · A retried submit creates one paper, not two.
--   · Two workers finishing at the same instant advance the paper once.
--   · A run that a sweep already failed cannot be resurrected by a late worker.
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/pipeline_runtime.sql
--   Pass: final SELECT reports failed = 0.
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

-- ── idempotent submit ──────────────────────────────────────────────────────

do $$
declare v_a jsonb; v_b jsonb; v_papers integer; v_pages integer; v_runs integer;
begin
  v_a := public.submit_paper(
    'aaaaaaaa-0000-4000-8000-000000000002', 'unit_test', 'tier_1', '2026-08-01', 'Physics',
    jsonb_build_array(
      jsonb_build_object('page_number', 1, 'r2_bucket', 'derived',
                         'r2_key', 's/p/page/1-abc.webp', 'mask_key', 's/p/mask/1-abc.png',
                         'preprocess_version', 'v2', 'quality_verdict', 'ok'),
      jsonb_build_object('page_number', 2, 'r2_bucket', 'derived',
                         'r2_key', 's/p/page/2-def.webp', 'preprocess_version', 'v2')),
    '99999999-0000-4000-8000-000000000001');

  -- The same submit again, as a flaky connection would send it.
  v_b := public.submit_paper(
    'aaaaaaaa-0000-4000-8000-000000000002', 'unit_test', 'tier_1', '2026-08-01', 'Physics',
    jsonb_build_array(
      jsonb_build_object('page_number', 1, 'r2_bucket', 'derived', 'r2_key', 's/p/page/1-abc.webp'),
      jsonb_build_object('page_number', 2, 'r2_bucket', 'derived', 'r2_key', 's/p/page/2-def.webp')),
    '99999999-0000-4000-8000-000000000001');

  select count(*) into v_papers from public.paper
   where student_id = 'aaaaaaaa-0000-4000-8000-000000000002';
  select count(*) into v_pages from public.paper_page
   where paper_id = (v_a ->> 'paper_id')::uuid;
  select count(*) into v_runs from public.extraction_run
   where paper_id = (v_a ->> 'paper_id')::uuid;

  perform public._t('a retried submit returns the same paper',
                    v_a ->> 'paper_id' = v_b ->> 'paper_id');
  perform public._t('a retried submit creates one paper', v_papers = 1, format('%s papers', v_papers));
  perform public._t('a retried submit does not double the pages', v_pages = 2, format('%s pages', v_pages));
  perform public._t('a retried submit reuses the run in flight', v_runs = 1, format('%s runs', v_runs));
  perform public._t('the first submit says it created it', (v_a ->> 'created')::boolean);
  perform public._t('the second says it did not', not (v_b ->> 'created')::boolean);
  perform public._t('the page keys survived the round trip',
                    exists (select 1 from public.paper_page
                             where paper_id = (v_a ->> 'paper_id')::uuid
                               and page_number = 1 and mask_key = 's/p/mask/1-abc.png'));
end $$;

do $$ begin begin
  perform public.submit_paper('aaaaaaaa-0000-4000-8000-000000000002', 'unit_test', 'tier_1',
    '2026-08-01', 'Physics', '[]'::jsonb, '99999999-0000-4000-8000-000000000002');
  perform public._t('a submit with no pages is refused', false, 'call succeeded');
exception when others then
  perform public._t('a submit with no pages is refused', true);
end; end $$;

-- ── transitions ────────────────────────────────────────────────────────────

do $$
declare v_run uuid; v_paper uuid; v_advance jsonb;
begin
  select id, paper_id into v_run, v_paper from public.extraction_run limit 1;

  perform public.run_advance(v_run, 'triaging');
  perform public._t('a run advances',
                    (select status from public.extraction_run where id = v_run) = 'triaging');

  perform public.run_advance(v_run, 'structure');

  -- `advance_after_structure` returns jsonb, not boolean, and it does NOT
  -- enqueue anything itself. 20260825043237_cloudflare_queue_fanout.sql moved
  -- the fan-out to the caller: nothing in Postgres can push into a Cloudflare
  -- Queue, so the function reports WHAT to enqueue and the Worker sends it.
  -- These assertions were written against the pre-fanout contract and kept
  -- passing only because that migration had no file in this repository — the
  -- local schema was five days behind production. Both are the real contract now.

  -- Structure is not finished while a page is still being read.
  perform public._t('structure does not advance while a page is pending',
                    not (public.advance_after_structure(v_run) ->> 'advanced')::boolean);

  update public.paper_page set structure_status = 'done' where paper_id = v_paper and page_number = 1;
  update public.paper_page set structure_status = 'unreadable' where paper_id = v_paper and page_number = 2;

  -- A page nobody could read is finished, not pending. It becomes a visible gap
  -- on the review screen rather than a paper that never advances.
  select public.advance_after_structure(v_run) into v_advance;
  perform public._t('an unreadable page still counts as done',
                    (v_advance ->> 'advanced')::boolean);
  perform public._t('and the run moved to content',
                    (select status from public.extraction_run where id = v_run) = 'content');

  -- A paper with no questions asks for reconciliation rather than going quiet.
  -- It reports the intent; the Worker is what actually enqueues.
  perform public._t('a structure pass that found nothing asks for reconciliation',
                    (v_advance ->> 'enqueue_reconcile')::boolean);
  perform public._t('and asks for no content work',
                    coalesce(jsonb_array_length(v_advance -> 'enqueue_content'), 0) = 0);

  -- Called twice, as two workers finishing together would.
  select public.advance_after_structure(v_run) into v_advance;
  perform public._t('a second call does not advance it again',
                    not (v_advance ->> 'advanced')::boolean);
  perform public._t('and does not ask for reconciliation twice',
                    v_advance -> 'enqueue_reconcile' is null);
end $$;

-- ── terminal is terminal ───────────────────────────────────────────────────

do $$
declare v_run uuid;
begin
  select id into v_run from public.extraction_run limit 1;
  perform public.run_advance(v_run, 'failed', 'We could not finish reading this paper.');

  -- A worker that was still in flight when the sweep failed the run finishes and
  -- reports success. It must not put the paper back into a state nothing will
  -- ever advance out of.
  perform public.run_advance(v_run, 'content');
  perform public._t('a late worker cannot resurrect a failed run',
                    (select status from public.extraction_run where id = v_run) = 'failed');
  perform public._t('and the reason the student sees is unchanged',
                    (select status_reason from public.extraction_run where id = v_run)
                      = 'We could not finish reading this paper.');
end $$;

-- ── the deletion drain ─────────────────────────────────────────────────────

do $$
declare v_claimed integer; v_again integer; v_row record;
begin
  insert into public.r2_deletion (bucket, prefix) values ('derived', 'x/y/'), ('originals', 'x/y/');

  select count(*) into v_claimed from public.claim_deletions(10);
  perform public._t('the drain claims what is waiting', v_claimed = 2, format('%s claimed', v_claimed));

  -- Claiming counts the attempt, so a row that keeps failing keeps coming back
  -- and eventually stops rather than retrying forever.
  perform public._t('claiming counts the attempt',
                    (select min(attempts) from public.r2_deletion) = 1);

  for v_row in select id from public.r2_deletion loop
    perform public.finish_deletion(v_row.id);
  end loop;
  select count(*) into v_again from public.claim_deletions(10);
  perform public._t('a finished deletion is not claimed again', v_again = 0, format('%s claimed', v_again));

  insert into public.r2_deletion (bucket, key, attempts) values ('derived', 'z', 20);
  select count(*) into v_again from public.claim_deletions(10);
  perform public._t('a deletion that has failed twenty times stops being retried', v_again = 0);
  perform public._t('but it stays visible rather than being dropped',
                    exists (select 1 from public.r2_deletion where key = 'z'));
end $$;

-- ── explanations wait for the student ──────────────────────────────────────

do $$
declare v_run uuid; v_paper uuid; v_student uuid; v_queued jsonb;
begin
  select id, paper_id, student_id into v_run, v_paper, v_student
    from public.extraction_run limit 1;

  -- Three questions: one that lost marks, one with full marks, one nobody could
  -- read. Only the first is worth paying a model to explain.
  insert into public.question_region (run_id, paper_id, student_id, order_index,
    marks_awarded, marks_awarded_box, marks_available, marks_available_box,
    confidence_tier, needs_review)
  values
    (v_run, v_paper, v_student, 1, 2, '{"x":1,"y":1,"w":1,"h":1}', 5, '{"x":1,"y":1,"w":1,"h":1}', 'confident', true),
    (v_run, v_paper, v_student, 2, 5, '{"x":1,"y":1,"w":1,"h":1}', 5, '{"x":1,"y":1,"w":1,"h":1}', 'confident', true),
    (v_run, v_paper, v_student, 3, null, null, null, null, 'unreadable', true);

  update public.extraction_run set status = 'needs_review', status_reason = null,
         started_at = now(), heartbeat_at = now()
   where id = v_run;

  begin
    perform public.begin_explanations(v_run);
    perform public._t('explanations refuse to start before review is done', false, 'call succeeded');
  exception when insufficient_privilege then
    perform public._t('explanations refuse to start before review is done', true);
  end;

  update public.question_region set student_confirmed_at = now() where run_id = v_run;

  -- Also jsonb since the fan-out migration: {queued, region_ids}, so the
  -- caller can enqueue the ids it is told about.
  select public.begin_explanations(v_run) into v_queued;
  perform public._t('only the question that lost marks is queued',
                    (v_queued ->> 'queued')::int = 1,
                    format('%s queued', v_queued ->> 'queued'));
  perform public._t('and it hands back exactly that one region id',
                    jsonb_array_length(v_queued -> 'region_ids') = 1);
  perform public._t('and the run is explaining',
                    (select status from public.extraction_run where id = v_run) = 'explaining');

  -- Called again, as a retried request would.
  select public.begin_explanations(v_run) into v_queued;
  perform public._t('a second call does not queue the same question twice',
                    (v_queued ->> 'queued')::int = 0,
                    format('%s queued', v_queued ->> 'queued'));

  perform public._t('the run is not ready while an explanation is outstanding',
                    not public.advance_after_explain(v_run));
  perform public._t('a question with full marks is skipped, not left pending',
                    (select explain_status from public.question_region
                      where run_id = v_run and order_index = 2) = 'skipped');
  perform public._t('so is one nobody could read',
                    (select explain_status from public.question_region
                      where run_id = v_run and order_index = 3) = 'skipped');

  insert into public.region_explanation (region_id, run_id, student_id, tier,
                                         cause, marks_lost, body, model_version, prompt_version)
  select r.id, v_run, v_student, 'tier_1', 'conceptual_gap', 3,
         'The formula was right; the substitution was not.', 'test-model', 'explain_tier1.v1'
    from public.question_region r where r.run_id = v_run and r.order_index = 1;
  update public.question_region set explain_status = 'done'
   where run_id = v_run and order_index = 1;

  perform public._t('once every explanation has landed the run is ready',
                    public.advance_after_explain(v_run));
  perform public._t('and it says so',
                    (select status from public.extraction_run where id = v_run) = 'ready');
end $$;

do $$
declare v_run uuid; v_paper uuid; v_student uuid;
begin
  select id, paper_id, student_id into v_run, v_paper, v_student
    from public.extraction_run limit 1;

  -- One question we could not explain, among questions we could. The paper has
  -- to finish: a visible gap on one card beats a paper that never resolves.
  insert into public.question_region (run_id, paper_id, student_id, order_index,
    marks_awarded, marks_awarded_box, marks_available, marks_available_box,
    confidence_tier, needs_review, student_confirmed_at, explain_status)
  values (v_run, v_paper, v_student, 4, 1, '{"x":1,"y":1,"w":1,"h":1}', 4,
          '{"x":1,"y":1,"w":1,"h":1}', 'confident', true, now(), 'failed');

  update public.extraction_run set status = 'explaining' where id = v_run;
  perform public._t('an explanation that permanently failed does not stall the paper',
                    public.advance_after_explain(v_run));
end $$;

-- ── who may reach the queues ───────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

do $$ begin begin
  perform public.pgmq_send('axon_content', '{"run_id":"x"}'::jsonb);
  perform public._t('a student cannot enqueue work', false, 'call succeeded');
exception when insufficient_privilege then
  perform public._t('a student cannot enqueue work', true);
end; end $$;

do $$ begin begin
  perform public.pgmq_read('axon_content', 30, 1);
  perform public._t('a student cannot read a queue', false, 'call succeeded');
exception when insufficient_privilege then
  perform public._t('a student cannot read a queue', true);
end; end $$;

do $$ begin begin
  perform public.run_advance((select id from public.extraction_run limit 1), 'committed');
  perform public._t('a student cannot drive the state machine', false, 'call succeeded');
exception when insufficient_privilege then
  perform public._t('a student cannot drive the state machine', true);
end; end $$;

reset role;

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
