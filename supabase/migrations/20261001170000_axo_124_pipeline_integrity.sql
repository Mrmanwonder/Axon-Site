-- AXO-124: pipeline integrity.
--
--  1. Every terminal failure carries a stable machine reason, separate from the user copy.
--     Runs: extraction_run.failure_reason. Explanations: question_region.explain_failure_reason.
--     Format: `code` or `code:detail`, lower snake case (e.g. structure_write_failed,
--     explain_schema_invalid, sweep_timeout:content).
--  2. `explain_status = 'running'` always resolves. The sweep used to ignore committed runs, so
--     a region could stay `running` forever (run 89c8d7a9: 3 regions, 26h). It now fails stale
--     `running` and long-`queued` regions on ANY run, including committed ones, and lets an
--     `explaining` run finish.
--  3. A failed explanation can be retried through a server-side RPC (service role only; the API
--     worker checks ownership first), without re-processing the paper.
--
-- Commit contract: committing a run no longer has to wait for explanations. Explanation continues
-- after commit, and the sweep guarantees every region reaches done / skipped / failed.

-- ── 1. machine reasons ─────────────────────────────────────────────────────

alter table public.question_region
  add column if not exists explain_failure_reason text;

alter table public.question_region
  drop constraint if exists explain_failure_reason_is_a_code;
alter table public.question_region
  add constraint explain_failure_reason_is_a_code
  check (explain_failure_reason is null or explain_failure_reason ~ '^[a-z0-9_]+(:[a-z0-9_]+)?$');

alter table public.extraction_run
  drop constraint if exists failure_reason_is_a_code;
alter table public.extraction_run
  add constraint failure_reason_is_a_code
  check (failure_reason is null or failure_reason ~ '^[a-z0-9_]+(:[a-z0-9_]+)?$');

comment on column public.question_region.explain_failure_reason is
  'Stable machine code for why this region''s explanation failed (e.g. explain_schema_invalid, sweep_timeout:explain). Not user copy. NULL unless explain_status = failed.';
comment on column public.extraction_run.failure_reason is
  'Stable machine code for why the run failed (e.g. structure_write_failed, sweep_timeout:content). Not user copy: status_reason holds that. Never NULL on a failed run written after AXO-124.';

-- When did explain_status last change? question_region has no updated_at trigger, so updated_at
-- is NOT bumped when a worker claims a region, and judging staleness from it would fail work
-- that has only just started. This column is stamped by a trigger on every status change.
alter table public.question_region
  add column if not exists explain_status_at timestamptz;

update public.question_region
   set explain_status_at = updated_at
 where explain_status_at is null
   and explain_status in ('queued', 'running');

create or replace function private.stamp_explain_status_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.explain_status is distinct from old.explain_status then
    new.explain_status_at := now();
  end if;
  return new;
end; $$;

revoke all on function private.stamp_explain_status_at() from public, anon, authenticated;

drop trigger if exists question_region_explain_status_at on public.question_region;
create trigger question_region_explain_status_at
  before insert or update of explain_status on public.question_region
  for each row execute function private.stamp_explain_status_at();

comment on column public.question_region.explain_status_at is
  'When explain_status last changed. The sweep judges stale running/queued explanations from this, not from updated_at.';

-- run_advance carries the machine reason. The old three-argument form is replaced (a second
-- overload with a defaulted argument would make PostgREST calls ambiguous).
drop function if exists public.run_advance(uuid, public.extraction_status, text);

create or replace function public.run_advance(
  p_run_id uuid,
  p_to public.extraction_status,
  p_reason text default null,
  p_failure_reason text default null)
returns public.extraction_status
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_from public.extraction_status;
begin
  perform private.run_lock(p_run_id);
  select status into v_from from public.extraction_run where id = p_run_id for update;
  if v_from is null then
    raise exception 'no such extraction run' using errcode = 'P0002';
  end if;

  -- Terminal is terminal. A late worker finishing after a sweep already failed
  -- the run must not resurrect it into a state nothing will ever advance.
  if v_from in ('committed', 'failed', 'rejected') then
    return v_from;
  end if;

  update public.extraction_run
     set status         = p_to,
         status_reason  = coalesce(p_reason, case when p_to in ('failed','rejected') then status_reason end),
         -- A failed run always says why in machine terms. A caller that has not been taught
         -- to classify yet lands on 'unclassified', which is visible and countable, not NULL.
         failure_reason = case when p_to = 'failed' then coalesce(p_failure_reason, 'unclassified') else failure_reason end,
         heartbeat_at   = now(),
         finished_at    = case when p_to in ('committed','failed','rejected') then now() else finished_at end
   where id = p_run_id;

  return p_to;
end; $$;

revoke all on function public.run_advance(uuid, public.extraction_status, text, text) from public, anon, authenticated;
grant execute on function public.run_advance(uuid, public.extraction_status, text, text) to service_role;

-- ── 2. the sweep reaches explanations on every run ─────────────────────────

create or replace function private.sweep_stuck_explanations(p_stale interval default interval '15 minutes')
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_failed integer;
  v_runs   uuid[];
  v_run    uuid;
begin
  -- `running` means a worker claimed the region; one that has not touched it for p_stale is gone.
  -- `queued` means a message was sent; one still unclaimed after four times that has lost its
  -- message. Both end as `failed` with a reason, which the card shows as a retryable state.
  with stale as (
    update public.question_region
       set explain_status         = 'failed',
           explain_failure_reason = case when explain_status = 'running'
                                         then 'sweep_timeout:explain'
                                         else 'sweep_timeout:explain_queued' end,
           updated_at             = now()
     where (explain_status = 'running' and coalesce(explain_status_at, updated_at) < now() - p_stale)
        or (explain_status = 'queued'  and coalesce(explain_status_at, updated_at) < now() - p_stale * 4)
    returning run_id
  )
  select count(*), array_agg(distinct run_id) into v_failed, v_runs from stale;

  -- A run that was waiting on those regions can finish now ('failed' counts as finished).
  for v_run in select unnest(coalesce(v_runs, '{}'::uuid[])) loop
    perform public.advance_after_explain(v_run);
  end loop;

  return coalesce(v_failed, 0);
end; $$;

revoke all on function private.sweep_stuck_explanations(interval) from public, anon, authenticated;

comment on function private.sweep_stuck_explanations(interval) is
  'AXO-124: fails explain_status running (stale) / queued (very stale) on any run including committed ones, with a machine reason, and lets explaining runs finish.';

-- sweep_stuck_runs: same behaviour as before, plus a machine reason on the runs it fails, plus
-- the explanation sweep (which the committed-run exclusion above used to leave out).
create or replace function private.sweep_stuck_runs(p_stale interval default interval '00:10:00')
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_swept integer;
  v_run_ids uuid[];
begin
  select array_agg(id) into v_run_ids
    from public.extraction_run
   where status not in ('queued', 'needs_review', 'ready', 'committed', 'failed', 'rejected')
     and coalesce(heartbeat_at, started_at) < now() - p_stale;

  if v_run_ids is not null then
    update public.extraction_run
       set status         = 'failed',
           failure_reason = 'sweep_timeout:' || status::text,
           status_reason  = case when private.run_pages_stored(paper_id)
             then 'This paper stopped partway through, but your pages are kept — you can try again.'
             else 'We could not find the pages for this paper. Try scanning it again.'
           end,
           finished_at    = now()
     where id = any(v_run_ids);
    get diagnostics v_swept = row_count;

    update public.question_region
       set extract_status = case when extract_status = 'running' then 'failed' else extract_status end,
           explain_status = case when explain_status = 'running' then 'failed' else explain_status end,
           explain_failure_reason = case when explain_status = 'running' then 'sweep_timeout:explain' else explain_failure_reason end,
           confidence_tier = case when extract_status = 'running' then 'unreadable' else confidence_tier end,
           needs_review = needs_review or extract_status = 'running',
           confidence_signals = case when extract_status = 'running'
             then coalesce(confidence_signals, '{}'::jsonb) || '{"unreadable_reason":"We could not finish checking this question. It has been flagged for review."}'::jsonb
             else confidence_signals end,
           updated_at = now()
     where run_id = any(v_run_ids)
       and (extract_status = 'running' or explain_status = 'running');

    update public.paper_page
       set structure_status = 'failed'
     where paper_id in (select paper_id from public.extraction_run where id = any(v_run_ids))
       and structure_status = 'running';

    update public.paper_page
       set structure_status = 'pending'
     where paper_id in (select paper_id from public.extraction_run where id = any(v_run_ids))
       and structure_status = 'done';

    update public.paper_page
       set crop_status = 'failed'
     where paper_id in (select paper_id from public.extraction_run where id = any(v_run_ids))
       and crop_status = 'running';

    update public.paper_page
       set crop_status = 'pending'
     where paper_id in (select paper_id from public.extraction_run where id = any(v_run_ids))
       and crop_status in ('done', 'skipped');
  end if;

  perform private.sweep_stuck_explanations();

  return coalesce(v_swept, 0);
end; $$;

-- ── 3. retry a failed explanation without re-processing the paper ─────────

create or replace function public.retry_failed_explanations(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_regions uuid[];
begin
  perform private.run_lock(p_run_id);

  select array_agg(id order by (marks_available - marks_awarded) desc, order_index) into v_regions
    from public.question_region
   where run_id = p_run_id
     and explain_status = 'failed'
     and student_confirmed_at is not null
     and marks_awarded is not null and marks_available is not null
     and marks_awarded < marks_available;

  update public.question_region
     set explain_status = 'queued',
         explain_failure_reason = null,
         updated_at = now()
   where id = any(coalesce(v_regions, '{}'::uuid[]));

  -- The run's own status is left alone: an `explaining` run keeps explaining, and a run that
  -- is already ready or committed is not pulled back (run_advance would refuse anyway).
  return jsonb_build_object(
    'queued', coalesce(array_length(v_regions, 1), 0),
    'region_ids', coalesce(to_jsonb(v_regions), '[]'::jsonb));
end; $$;

revoke all on function public.retry_failed_explanations(uuid) from public, anon, authenticated;
grant execute on function public.retry_failed_explanations(uuid) to service_role;

comment on function public.retry_failed_explanations(uuid) is
  'AXO-124: re-queues failed, student-confirmed, mark-losing regions of a run for explanation and clears their failure reason. Service role only; the API worker verifies ownership first.';
