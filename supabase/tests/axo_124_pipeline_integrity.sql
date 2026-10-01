-- ============================================================================
-- Test suite: AXO-124 pipeline integrity
-- ============================================================================
--   · every failed run carries a machine reason
--   · explain_status = running always resolves, including on committed runs
--   · the sweep never fails work that has only just started
--   · a failed explanation can be re-queued without re-processing the paper
--
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_124_pipeline_integrity.sql
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

-- one paper and run per scenario
insert into public.paper (id, student_id, type, tier, date_taken, subject) values
 ('aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-01','Physics'),
 ('aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-02','Physics'),
 ('aaaaaaaa-0000-4000-8000-0000000000a3','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-03','Physics'),
 ('aaaaaaaa-0000-4000-8000-0000000000a4','aaaaaaaa-0000-4000-8000-000000000002','unit_test','tier_1','2026-08-04','Physics');

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status, reconciled) values
 ('aaaaaaaa-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','content', true),
 ('aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','committed', true),
 ('aaaaaaaa-0000-4000-8000-0000000000b3','aaaaaaaa-0000-4000-8000-0000000000a3','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','explaining', true),
 ('aaaaaaaa-0000-4000-8000-0000000000b4','aaaaaaaa-0000-4000-8000-0000000000a4','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','content', true);

create or replace function public._region(p_id uuid, p_run uuid, p_paper uuid, p_order int, p_status text,
                                          p_age interval, p_confirmed boolean default true,
                                          p_awarded numeric default 1)
returns void language plpgsql as $$
begin
  insert into public.question_region (id, run_id, paper_id, student_id, order_index,
      marks_awarded, marks_awarded_box, marks_available, marks_available_box,
      explain_status, student_confirmed_at)
  values (p_id, p_run, p_paper, 'aaaaaaaa-0000-4000-8000-000000000002', p_order,
      p_awarded, '{"page":1,"x":1,"y":1,"w":1,"h":1}', 3, '{"page":1,"x":2,"y":2,"w":1,"h":1}',
      p_status, case when p_confirmed then now() end);
  -- Backdate without touching explain_status, so the stamping trigger does not fire.
  update public.question_region set explain_status_at = now() - p_age where id = p_id;
end $$;

-- ── run_advance and machine reasons ────────────────────────────────────────

select public.run_advance('aaaaaaaa-0000-4000-8000-0000000000b4', 'failed', 'user copy', 'structure_write_failed');
select public._t('a failed run stores the machine reason, separate from the user copy',
  (select failure_reason = 'structure_write_failed' and status_reason = 'user copy'
     from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b4'));

insert into public.extraction_run (id, paper_id, student_id, pipeline_version, status, reconciled)
values ('aaaaaaaa-0000-4000-8000-0000000000b5','aaaaaaaa-0000-4000-8000-0000000000a4','aaaaaaaa-0000-4000-8000-000000000002','1.0.0','content', true);
select public.run_advance('aaaaaaaa-0000-4000-8000-0000000000b5', 'failed', 'user copy');
select public._t('a caller that gives no code still leaves a countable reason, never NULL',
  (select failure_reason = 'unclassified' from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b5'));

do $$ begin begin
  update public.extraction_run set failure_reason = 'Not A Code!' where id = 'aaaaaaaa-0000-4000-8000-0000000000b4';
  perform public._t('a free-text failure_reason is refused', false, 'update succeeded');
exception when check_violation then
  perform public._t('a free-text failure_reason is refused', true);
end; end $$;

-- ── the sweep reaches committed runs ───────────────────────────────────────

select public._region('aaaaaaaa-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 1, 'running', interval '1 hour');
select public._region('aaaaaaaa-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 2, 'running', interval '1 minute');
select public._region('aaaaaaaa-0000-4000-8000-0000000000c3','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 3, 'queued',  interval '2 hours');
select public._region('aaaaaaaa-0000-4000-8000-0000000000c4','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 4, 'queued',  interval '5 minutes');
select public._region('aaaaaaaa-0000-4000-8000-0000000000c5','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 5, 'done',    interval '3 days');

select private.sweep_stuck_explanations();

select public._t('a stale running region on a COMMITTED run is failed with a machine reason',
  (select explain_status = 'failed' and explain_failure_reason = 'sweep_timeout:explain'
     from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'));
select public._t('a region that started a minute ago is left alone',
  (select explain_status = 'running' and explain_failure_reason is null
     from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c2'));
select public._t('a queued region whose message is long lost is failed',
  (select explain_status = 'failed' and explain_failure_reason = 'sweep_timeout:explain_queued'
     from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c3'));
select public._t('a recently queued region is left alone',
  (select explain_status = 'queued' from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c4'));
select public._t('a finished explanation is never touched',
  (select explain_status = 'done' from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c5'));

-- an explaining run finishes once its stuck region is failed
select public._region('aaaaaaaa-0000-4000-8000-0000000000d1','aaaaaaaa-0000-4000-8000-0000000000b3','aaaaaaaa-0000-4000-8000-0000000000a3', 1, 'running', interval '1 hour');
select private.sweep_stuck_explanations();
select public._t('an explaining run advances to ready once the sweep resolves its last stuck region',
  (select status = 'ready' from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b3'),
  (select status::text from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b3'));

-- the status-change stamp: a fresh claim is not stale
update public.question_region set explain_status = 'queued', explain_status_at = now() - interval '5 hours'
 where id = 'aaaaaaaa-0000-4000-8000-0000000000c2';
update public.question_region set explain_status = 'running' where id = 'aaaaaaaa-0000-4000-8000-0000000000c2';
select private.sweep_stuck_explanations();
select public._t('claiming a long-queued region restarts its clock, so the sweep does not fail it',
  (select explain_status = 'running' from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000c2'));

-- ── sweep_stuck_runs: machine reason on swept runs ─────────────────────────

update public.extraction_run set heartbeat_at = now() - interval '1 hour'
 where id = 'aaaaaaaa-0000-4000-8000-0000000000b1';
select private.sweep_stuck_runs();
select public._t('a swept run records sweep_timeout:<stage> as its machine reason',
  (select status = 'failed' and failure_reason = 'sweep_timeout:content'
     from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b1'),
  (select status::text || '/' || coalesce(failure_reason, '-') from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b1'));

-- ── retry ──────────────────────────────────────────────────────────────────

select public._region('aaaaaaaa-0000-4000-8000-0000000000e1','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 11, 'failed', interval '1 hour');
select public._region('aaaaaaaa-0000-4000-8000-0000000000e2','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 12, 'failed', interval '1 hour', false);
select public._region('aaaaaaaa-0000-4000-8000-0000000000e3','aaaaaaaa-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-0000000000a2', 13, 'failed', interval '1 hour', true, 3);
update public.question_region set explain_failure_reason = 'explain_schema_invalid'
 where id in ('aaaaaaaa-0000-4000-8000-0000000000e1','aaaaaaaa-0000-4000-8000-0000000000e2','aaaaaaaa-0000-4000-8000-0000000000e3');

create temp table _retry as select public.retry_failed_explanations('aaaaaaaa-0000-4000-8000-0000000000b2') as r;

select public._t('retry re-queues a failed, confirmed, mark-losing region and clears its reason',
  (select explain_status = 'queued' and explain_failure_reason is null
     from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'));
select public._t('retry leaves an unconfirmed region alone',
  (select explain_status = 'failed' from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000e2'));
select public._t('retry leaves a full-marks region alone (nothing to explain)',
  (select explain_status = 'failed' from public.question_region where id = 'aaaaaaaa-0000-4000-8000-0000000000e3'));
select public._t('retry does not pull a committed run back out of committed',
  (select status = 'committed' from public.extraction_run where id = 'aaaaaaaa-0000-4000-8000-0000000000b2'));
select public._t('retry reports which regions it queued',
  (select (r ->> 'queued')::int >= 1 and (r -> 'region_ids') @> '["aaaaaaaa-0000-4000-8000-0000000000e1"]'::jsonb from _retry));

-- ── nothing here is reachable by a client ──────────────────────────────────

select public._t('clients cannot call retry_failed_explanations or run_advance',
  not has_function_privilege('authenticated', 'public.retry_failed_explanations(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.retry_failed_explanations(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.run_advance(uuid, public.extraction_status, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.run_advance(uuid, public.extraction_status, text, text)', 'execute'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
