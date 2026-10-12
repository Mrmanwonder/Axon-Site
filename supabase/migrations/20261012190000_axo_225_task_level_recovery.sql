-- AXO-225 slice 2: a stalled run is re-driven, not failed and reset.
--
-- Today `private.sweep_stuck_runs` (pg_cron, every minute) fails any run whose
-- heartbeat is 10 minutes old and resets the paper's DONE pages to pending, so
-- the retry starts over. Both 9 Oct failures were `sweep_timeout:content`.
--
-- With the `task_recovery` flag on, a stale run in `structure` or `content` is
-- instead re-driven: only its unfinished pages or regions are put back to
-- pending, and in the SAME transaction an outbox row is written for each of
-- them. The sweep Worker dispatches those rows to the stage queues. Finished
-- pages and regions are not touched. If nothing is unfinished (the fan-out
-- message itself was lost), one "nudge" row is written for a finished unit;
-- the stage worker's already-done path advances the run.
--
-- Bounded: a run is re-driven at most twice. The third stall takes the old path
-- (fail with a machine reason), so nothing loops forever.
--
-- Flag off (the default) leaves today's behaviour byte-for-byte. Turn it on
-- only after the sweep Worker that dispatches the outbox is deployed.

-- ── state ──────────────────────────────────────────────────────────────────
alter table public.extraction_run
  add column if not exists recovery_attempts integer not null default 0 check (recovery_attempts >= 0);

comment on column public.extraction_run.recovery_attempts is
  'AXO-225: times the sweep re-drove this run instead of failing it. Bounded at 2.';

insert into private.feature_flag (key, enabled, note)
values ('task_recovery', false,
        'AXO-225. Stale structure/content runs are re-driven through private.stage_outbox instead of failed. Turn on only once the sweep Worker dispatches the outbox.')
on conflict (key) do nothing;

-- ── outbox ─────────────────────────────────────────────────────────────────
create table private.stage_outbox (
  event_id        uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.extraction_run (id) on delete cascade,
  paper_id        uuid not null,
  student_id      uuid not null,
  stage           text not null check (stage in ('structure', 'content')),
  -- paper_page.id for structure, question_region.id for content
  unit_id         uuid not null,
  reason          text not null check (reason in ('recover', 'nudge')),
  created_at      timestamptz not null default now(),
  available_at    timestamptz not null default now(),
  send_attempts   integer not null default 0 check (send_attempts >= 0),
  claimed_until   timestamptz,
  last_send_error text,
  delivered_at    timestamptz,
  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade
);

comment on table private.stage_outbox is
  'AXO-225: queue messages written in the same transaction that makes work runnable. The sweep Worker sends them and marks them delivered. A message is only a wake-up: workers re-read the database.';

-- One undelivered message per unit is enough.
create unique index stage_outbox_pending_unit_uq on private.stage_outbox (stage, unit_id) where delivered_at is null;
create index stage_outbox_ready_idx on private.stage_outbox (available_at) where delivered_at is null;
create index stage_outbox_run_idx on private.stage_outbox (run_id);
create index stage_outbox_paper_idx on private.stage_outbox (paper_id, student_id);

alter table private.stage_outbox enable row level security;
revoke all on private.stage_outbox from public, anon, authenticated, service_role;

-- ── re-drive one run ───────────────────────────────────────────────────────
create function private.redrive_run(p_run_id uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_run     public.extraction_run;
  v_count   integer := 0;
  v_pending integer := 0;
begin
  select * into v_run from public.extraction_run r where r.id = p_run_id for update;
  if not found or v_run.status::text not in ('structure', 'content') then
    return 0;
  end if;

  update public.extraction_run r
     set recovery_attempts = r.recovery_attempts + 1,
         heartbeat_at      = now()
   where r.id = p_run_id;

  if v_run.status::text = 'structure' then
    update public.paper_page p
       set structure_status = 'pending'
     where p.paper_id = v_run.paper_id
       and p.structure_status = 'running';

    select count(*) into v_pending from public.paper_page p
     where p.paper_id = v_run.paper_id and p.structure_status = 'pending';

    insert into private.stage_outbox (run_id, paper_id, student_id, stage, unit_id, reason)
    select p_run_id, v_run.paper_id, v_run.student_id, 'structure', p.id, 'recover'
      from public.paper_page p
     where p.paper_id = v_run.paper_id and p.structure_status = 'pending'
    on conflict (stage, unit_id) where delivered_at is null do nothing;
    get diagnostics v_count = row_count;

    -- Nothing unfinished: the fan-out after the last page was lost. Nudge one page.
    if v_pending = 0 then
      insert into private.stage_outbox (run_id, paper_id, student_id, stage, unit_id, reason)
      select p_run_id, v_run.paper_id, v_run.student_id, 'structure', p.id, 'nudge'
        from public.paper_page p where p.paper_id = v_run.paper_id
       order by p.page_number limit 1
      on conflict (stage, unit_id) where delivered_at is null do nothing;
      get diagnostics v_count = row_count;
    end if;
  else
    update public.question_region q
       set extract_status = 'pending',
           updated_at     = now()
     where q.run_id = p_run_id
       and q.extract_status = 'running';

    select count(*) into v_pending from public.question_region q
     where q.run_id = p_run_id and q.extract_status = 'pending';

    insert into private.stage_outbox (run_id, paper_id, student_id, stage, unit_id, reason)
    select p_run_id, v_run.paper_id, v_run.student_id, 'content', q.id, 'recover'
      from public.question_region q
     where q.run_id = p_run_id and q.extract_status = 'pending'
    on conflict (stage, unit_id) where delivered_at is null do nothing;
    get diagnostics v_count = row_count;

    -- Nothing unfinished: the fan-out after the last region was lost. Nudge one region.
    if v_pending = 0 then
      insert into private.stage_outbox (run_id, paper_id, student_id, stage, unit_id, reason)
      select p_run_id, v_run.paper_id, v_run.student_id, 'content', q.id, 'nudge'
        from public.question_region q where q.run_id = p_run_id
       order by q.order_index limit 1
      on conflict (stage, unit_id) where delivered_at is null do nothing;
      get diagnostics v_count = row_count;
    end if;
  end if;

  return v_count;
end;
$$;

revoke all on function private.redrive_run(uuid) from public, anon, authenticated, service_role;

-- ── the sweep ──────────────────────────────────────────────────────────────
-- The failing branch below is the live body as read from production on
-- 12 Oct 2026, unchanged. Only the selection of which runs reach it changes.
create or replace function private.sweep_stuck_runs(p_stale interval default interval '00:10:00')
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_swept integer;
  v_run_ids uuid[];
  v_run uuid;
begin
  if private.flag('task_recovery') then
    for v_run in
      select id from public.extraction_run
       where status::text in ('structure', 'content')
         and recovery_attempts < 2
         and coalesce(heartbeat_at, started_at) < now() - p_stale
       for update skip locked
    loop
      perform private.redrive_run(v_run);
    end loop;
  end if;

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

revoke all on function private.sweep_stuck_runs(interval) from public, anon, authenticated;

-- ── dispatcher contract (sweep Worker, service role) ───────────────────────
create function public.claim_stage_outbox(p_limit integer default 50)
returns table (event_id uuid, stage text, run_id uuid, unit_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'limit must be 1 to 200' using errcode = '22023';
  end if;

  -- A run that finished or failed meanwhile needs no wake-up.
  update private.stage_outbox o
     set delivered_at = now(), last_send_error = 'run_finished'
    from public.extraction_run r
   where r.id = o.run_id and o.delivered_at is null
     and r.status::text in ('committed', 'failed', 'rejected', 'ready', 'needs_review');

  return query
  with picked as (
    select o.event_id from private.stage_outbox o
     where o.delivered_at is null
       and o.available_at <= now()
       and (o.claimed_until is null or o.claimed_until < now())
       and o.send_attempts < 10
     order by o.available_at
     limit p_limit
     for update skip locked
  )
  update private.stage_outbox o
     set claimed_until = now() + interval '2 minutes',
         send_attempts = o.send_attempts + 1
    from picked
   where o.event_id = picked.event_id
  returning o.event_id, o.stage, o.run_id, o.unit_id;
end;
$$;

create function public.finish_stage_outbox(p_delivered uuid[], p_failed uuid[] default '{}', p_error text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare v_rows integer := 0; v_more integer;
begin
  update private.stage_outbox o set delivered_at = now(), claimed_until = null
   where o.event_id = any(coalesce(p_delivered, '{}')) and o.delivered_at is null;
  get diagnostics v_rows = row_count;

  update private.stage_outbox o
     set claimed_until   = null,
         last_send_error = left(coalesce(p_error, 'send_failed'), 300),
         available_at    = now() + make_interval(secs => least(600, 15 * power(2, o.send_attempts)::integer))
   where o.event_id = any(coalesce(p_failed, '{}')) and o.delivered_at is null;
  get diagnostics v_more = row_count;

  return v_rows + v_more;
end;
$$;

revoke all on function public.claim_stage_outbox(integer) from public, anon, authenticated;
revoke all on function public.finish_stage_outbox(uuid[], uuid[], text) from public, anon, authenticated;
grant execute on function public.claim_stage_outbox(integer) to service_role;
grant execute on function public.finish_stage_outbox(uuid[], uuid[], text) to service_role;

comment on function public.claim_stage_outbox(integer) is
  'AXO-225: hands the sweep Worker up to p_limit undelivered stage messages, each claimed for 2 minutes. Service role only.';
comment on function public.finish_stage_outbox(uuid[], uuid[], text) is
  'AXO-225: marks sent messages delivered and backs off the ones whose send failed. Service role only.';
