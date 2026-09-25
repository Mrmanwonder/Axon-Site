-- ============================================================================
-- 0014 · The runtime: queues, idempotent submit, and state transitions
-- ============================================================================
-- REVIEW_PIPELINE.md §5, §6 and §11 turned into the SQL side of the pipeline.
-- Everything here exists because of one constraint: an Edge Function has two
-- seconds of CPU. Anything that has to be atomic, or has to be right when two
-- workers finish at the same instant, belongs in Postgres — a worker that
-- checks-then-writes is a worker that races the identical worker beside it.
--
-- PostgREST only reaches `public`, so the pgmq wrappers live there. Every one
-- of them is revoked from anon and authenticated: a student who could read a
-- queue could read another student's paper id, and one who could write to a
-- queue could enqueue work against it.
-- ============================================================================

-- ── queue access ───────────────────────────────────────────────────────────

create or replace function public.pgmq_send(queue_name text, msg jsonb, delay integer default 0)
returns bigint language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
declare v_id bigint;
begin
  select pgmq.send(queue_name, msg, delay) into v_id;
  return v_id;
end; $$;

create or replace function public.pgmq_read(queue_name text, vt integer, qty integer)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
begin
  return query select m.msg_id, m.read_ct, m.enqueued_at, m.message
               from pgmq.read(queue_name, vt, qty) m;
end; $$;

create or replace function public.pgmq_delete(queue_name text, msg_id bigint)
returns boolean language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
begin
  return pgmq.delete(queue_name, msg_id);
end; $$;

create or replace function public.pgmq_archive(queue_name text, msg_id bigint)
returns boolean language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
begin
  return pgmq.archive(queue_name, msg_id);
end; $$;

revoke all on function public.pgmq_send(text, jsonb, integer)  from public, anon, authenticated;
revoke all on function public.pgmq_read(text, integer, integer) from public, anon, authenticated;
revoke all on function public.pgmq_delete(text, bigint)         from public, anon, authenticated;
revoke all on function public.pgmq_archive(text, bigint)        from public, anon, authenticated;
grant execute on function public.pgmq_send(text, jsonb, integer)   to service_role;
grant execute on function public.pgmq_read(text, integer, integer) to service_role;
grant execute on function public.pgmq_delete(text, bigint)         to service_role;
grant execute on function public.pgmq_archive(text, bigint)        to service_role;

comment on function public.pgmq_read(text, integer, integer) is
  'Claims messages for the visibility timeout. The timeout is the retry mechanism: a worker that dies mid-call does not ack, and the message comes back on its own.';

-- ── idempotent submit ──────────────────────────────────────────────────────
-- A retried submit from a flaky connection must not create two papers. The key
-- is minted on the device before the first attempt, so every retry of that
-- submit carries the same one.

alter table public.paper add column if not exists idempotency_key uuid;

do $$ begin
  alter table public.paper add constraint paper_idempotency_key_unique unique (idempotency_key);
exception when duplicate_object then null; end $$;

comment on column public.paper.idempotency_key is
  'Minted on the device before the first submit. Two attempts at the same submit produce one paper; two genuinely different papers carry different keys.';

-- One more queue than 0013 created. Reconciliation is arithmetic with no model
-- call, but it still has to survive the worker that runs it dying halfway, and
-- a queue is the only thing here that guarantees that.
do $$ begin
  if not exists (select 1 from pgmq.list_queues() where queue_name = 'axon_reconcile') then
    perform pgmq.create('axon_reconcile');
  end if;
end $$;

-- The device measured these in stage 2 and they are the input to stage 5. They
-- travel on the page rather than in the submit call's body alone, because the
-- worker that needs them runs minutes later, woken by a tick, with no request to
-- read them out of.
alter table public.paper_page
  add column if not exists teacher_marks jsonb not null default '[]'::jsonb;

comment on column public.paper_page.teacher_marks is
  'Measured geometry from the device: [{page, box, shape, metrics}]. Not a model output — this is what the red mask found, and stage 5 binds it to questions.';

create or replace function public.submit_paper(
  p_student_id      uuid,
  p_type            public.paper_type,
  p_tier            public.paper_tier,
  p_date_taken      date,
  p_subject         text,
  p_pages           jsonb,
  p_idempotency_key uuid,
  p_reported_total  numeric default null,
  p_stated_maximum  numeric default null,
  p_pipeline_version text default '1.0.0'
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_paper   public.paper;
  v_run_id  uuid;
  v_page    jsonb;
  v_created boolean := false;
begin
  if p_idempotency_key is null then
    raise exception 'an idempotency key is required' using errcode = '22004';
  end if;
  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
    raise exception 'a paper needs at least one page' using errcode = '22023';
  end if;

  -- The retry lands here. RLS still decides whose paper this is, so a second
  -- caller with a guessed key finds nothing rather than someone else's row.
  select * into v_paper from public.paper where idempotency_key = p_idempotency_key;

  if v_paper.id is null then
    insert into public.paper (student_id, type, tier, date_taken, subject,
                              reported_total, stated_maximum, idempotency_key)
    values (p_student_id, p_type, p_tier, coalesce(p_date_taken, current_date), p_subject,
            p_reported_total, p_stated_maximum, p_idempotency_key)
    returning * into v_paper;
    v_created := true;

    for v_page in select * from jsonb_array_elements(p_pages) loop
      insert into public.paper_page (
        paper_id, student_id, page_number, source_kind, status,
        r2_bucket, r2_key, mask_key, original_key, thumb_key,
        bytes, sha256, etag, preprocess_version,
        quality_verdict, quality_signals, conditioning_meta, layer_fallback,
        teacher_marks, teacher_mark_count)
      values (
        v_paper.id, p_student_id,
        (v_page ->> 'page_number')::smallint,
        coalesce((v_page ->> 'source_kind')::public.page_source, 'upload'),
        'stored',
        coalesce(v_page ->> 'r2_bucket', 'derived'),
        v_page ->> 'r2_key',
        v_page ->> 'mask_key',
        v_page ->> 'original_key',
        v_page ->> 'thumb_key',
        (v_page ->> 'bytes')::integer,
        v_page ->> 'sha256',
        v_page ->> 'etag',
        coalesce(v_page ->> 'preprocess_version', 'v2'),
        v_page ->> 'quality_verdict',
        coalesce(v_page -> 'quality_signals', '{}'::jsonb),
        coalesce(v_page -> 'conditioning_meta', '{}'::jsonb),
        v_page ->> 'layer_fallback',
        coalesce(v_page -> 'teacher_marks', '[]'::jsonb),
        coalesce(jsonb_array_length(v_page -> 'teacher_marks'), 0));
    end loop;
  end if;

  -- A resubmit reuses the run that is already in flight rather than starting a
  -- second one against the same pages, which would double every model call.
  select id into v_run_id from public.extraction_run
   where paper_id = v_paper.id and status not in ('failed', 'rejected')
   order by started_at desc limit 1;

  if v_run_id is null then
    insert into public.extraction_run (paper_id, student_id, pipeline_version,
                                       preprocess_version, status, heartbeat_at)
    values (v_paper.id, p_student_id, p_pipeline_version,
            coalesce(p_pages -> 0 ->> 'preprocess_version', 'v2'), 'queued', now())
    returning id into v_run_id;
  end if;

  return jsonb_build_object(
    'paper_id', v_paper.id, 'run_id', v_run_id, 'created', v_created,
    'pages', (select count(*) from public.paper_page where paper_id = v_paper.id));
end; $$;

revoke all on function public.submit_paper(uuid, public.paper_type, public.paper_tier, date, text,
  jsonb, uuid, numeric, numeric, text) from public, anon;
grant execute on function public.submit_paper(uuid, public.paper_type, public.paper_tier, date, text,
  jsonb, uuid, numeric, numeric, text) to authenticated, service_role;

comment on function public.submit_paper is
  'Creates the paper, its pages and its run in one transaction, keyed on an idempotency key. Runs as the caller, so RLS proves the student belongs to them.';

-- ── state transitions ──────────────────────────────────────────────────────
-- The completion checks live here rather than in a worker because two workers
-- finishing the same instant is normal, not exceptional: twenty content calls
-- go out together and the last two land microseconds apart. Both would see
-- "everything is done", both would advance the paper, and the paper would be
-- enqueued for reconciliation twice.
--
-- The advisory lock is transaction-scoped, so it releases on commit or on the
-- worker dying, whichever comes first.

create or replace function private.run_lock(p_run_id uuid) returns void
language sql set search_path = public, pg_temp as $$
  select pg_advisory_xact_lock(hashtextextended(p_run_id::text, 0));
$$;

create or replace function public.run_heartbeat(p_run_id uuid)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.extraction_run set heartbeat_at = now() where id = p_run_id;
$$;

create or replace function public.run_advance(
  p_run_id uuid,
  p_to     public.extraction_status,
  p_reason text default null
) returns public.extraction_status
language plpgsql security definer set search_path = public, pg_temp as $$
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
     set status        = p_to,
         status_reason = coalesce(p_reason, case when p_to in ('failed','rejected') then status_reason end),
         heartbeat_at  = now(),
         finished_at   = case when p_to in ('committed','failed','rejected') then now() else finished_at end
   where id = p_run_id;

  return p_to;
end; $$;

comment on function public.run_advance is
  'The only writer of extraction_run.status in the runtime. Refuses to move a terminal run, so a late worker cannot resurrect one a sweep already failed.';

-- Structure is done when every page is. A page that could not be read is done
-- too — it becomes a visible gap on the review screen rather than a paper that
-- never advances.
create or replace function public.advance_after_structure(p_run_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_paper uuid; v_pending integer; v_queued integer := 0; v_region record;
begin
  perform private.run_lock(p_run_id);
  select paper_id into v_paper from public.extraction_run where id = p_run_id;
  if v_paper is null then return false; end if;

  select count(*) into v_pending from public.paper_page
   where paper_id = v_paper and structure_status in ('pending', 'running');
  if v_pending > 0 then return false; end if;

  if (select status from public.extraction_run where id = p_run_id) <> 'structure' then
    return false;
  end if;

  perform public.run_advance(p_run_id, 'content');

  for v_region in
    select id from public.question_region
     where run_id = p_run_id and extract_status = 'pending' order by order_index
  loop
    perform pgmq.send('axon_content',
      jsonb_build_object('run_id', p_run_id, 'region_id', v_region.id));
    v_queued := v_queued + 1;
  end loop;

  -- A paper whose structure pass found no questions at all has nothing to
  -- extract, and going quiet here is exactly the invisible failure hard rule 4
  -- forbids. Send it straight to reconciliation, which will say so.
  if v_queued = 0 then
    perform pgmq.send('axon_reconcile', jsonb_build_object('run_id', p_run_id));
  end if;
  return true;
end; $$;

create or replace function public.advance_after_content(p_run_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pending integer;
begin
  perform private.run_lock(p_run_id);
  select count(*) into v_pending from public.question_region
   where run_id = p_run_id and extract_status in ('pending', 'running');
  if v_pending > 0 then return false; end if;

  if (select status from public.extraction_run where id = p_run_id) <> 'content' then
    return false;
  end if;

  perform public.run_advance(p_run_id, 'attribution');
  perform pgmq.send('axon_reconcile', jsonb_build_object('run_id', p_run_id));
  return true;
end; $$;

revoke all on function public.run_heartbeat(uuid)                       from public, anon, authenticated;
revoke all on function public.run_advance(uuid, public.extraction_status, text) from public, anon, authenticated;
revoke all on function public.advance_after_structure(uuid)             from public, anon, authenticated;
revoke all on function public.advance_after_content(uuid)               from public, anon, authenticated;
grant execute on function public.run_heartbeat(uuid)                       to service_role;
grant execute on function public.run_advance(uuid, public.extraction_status, text) to service_role;
grant execute on function public.advance_after_structure(uuid)             to service_role;
grant execute on function public.advance_after_content(uuid)               to service_role;

-- ── the deletion drain ─────────────────────────────────────────────────────
-- Claim-and-release rather than read-and-delete: a worker that dies between
-- taking a row and finishing the walk must leave the row for the next tick,
-- and a row whose delete failed must come back rather than disappear.

create or replace function public.claim_deletions(p_limit integer default 5)
returns table (id bigint, bucket text, prefix text, key text, attempts integer)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  update public.r2_deletion d
     set attempts = d.attempts + 1
   where d.id in (
     select c.id from public.r2_deletion c
      where c.done_at is null
        and c.attempts < 20
      order by c.created_at
      for update skip locked
      limit p_limit)
  returning d.id, d.bucket, d.prefix, d.key, d.attempts;
end; $$;

create or replace function public.finish_deletion(p_id bigint, p_error text default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.r2_deletion
     set done_at = case when p_error is null then now() else null end,
         last_error = p_error
   where id = p_id;
$$;

revoke all on function public.claim_deletions(integer)    from public, anon, authenticated;
revoke all on function public.finish_deletion(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_deletions(integer)    to service_role;
grant execute on function public.finish_deletion(bigint, text) to service_role;

comment on function public.claim_deletions(integer) is
  'Takes a bounded batch and counts the attempt. A row that keeps failing keeps coming back until it has been tried twenty times, and then stays visible rather than being dropped.';

-- ── explanations run after review ──────────────────────────────────────────
-- No explanation may be built on a mark the student has not confirmed.
-- Generating twenty and then having question seven corrected buys either a
-- stale explanation or a wasted call, and the stale one is worse: it is wrong
-- prose about a right answer, in a product whose whole claim is the opposite.

-- Stage 8's own per-question state. Without it a retried begin_explanations()
-- queues every question a second time, and — worse — a question whose
-- explanation permanently failed leaves the run pending forever, so nineteen
-- good explanations wait on the twentieth that is never coming.
alter table public.question_region
  add column if not exists explain_status text not null default 'pending';

do $$ begin
  alter table public.question_region
    add constraint explain_status_is_known
    check (explain_status in ('pending', 'queued', 'running', 'done', 'skipped', 'failed'));
exception when duplicate_object then null; end $$;

comment on column public.question_region.explain_status is
  'skipped means there was nothing to explain — full marks, or a region nobody could read. failed means we tried and could not, which is a visible gap rather than a stalled paper.';

create or replace function public.begin_explanations(p_run_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pending integer; v_queued integer := 0; v_region record;
begin
  perform private.run_lock(p_run_id);

  select count(*) into v_pending from public.question_region
   where run_id = p_run_id and needs_review and student_confirmed_at is null;
  if v_pending > 0 then
    raise exception '% question(s) still need review before explanations can start', v_pending
      using errcode = '42501';
  end if;

  if (select status from public.extraction_run where id = p_run_id) not in ('needs_review', 'explaining') then
    return 0;
  end if;
  perform public.run_advance(p_run_id, 'explaining');

  -- Nothing to explain is not a pending explanation. A question with full marks
  -- needs no prose, and paying a model to produce "well done" would be the most
  -- expensive way to say it.
  update public.question_region r
     set explain_status = 'skipped'
   where r.run_id = p_run_id
     and r.explain_status = 'pending'
     and (r.confidence_tier = 'unreadable'
          or r.marks_awarded is null or r.marks_available is null
          or r.marks_awarded >= r.marks_available);

  -- Hardest-hit first, so the questions a student most wants explained are the
  -- ones that land while they are still looking at the screen.
  for v_region in
    select r.id from public.question_region r
     where r.run_id = p_run_id and r.explain_status = 'pending'
     order by (r.marks_available - r.marks_awarded) desc, r.order_index
  loop
    update public.question_region set explain_status = 'queued' where id = v_region.id;
    perform pgmq.send('axon_explain',
      jsonb_build_object('run_id', p_run_id, 'region_id', v_region.id));
    v_queued := v_queued + 1;
  end loop;

  -- Nothing to explain is a finished paper, not a stalled one. Checked against
  -- what is outstanding rather than what this call queued, so a retry that
  -- queued nothing does not declare a paper ready while work is still in flight.
  if not exists (select 1 from public.question_region
                  where run_id = p_run_id and explain_status in ('pending', 'queued', 'running')) then
    perform public.run_advance(p_run_id, 'ready');
  end if;
  return v_queued;
end; $$;

create or replace function public.advance_after_explain(p_run_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pending integer;
begin
  perform private.run_lock(p_run_id);
  -- 'failed' counts as finished. A question we could not explain is a visible
  -- gap on one card; nineteen good explanations waiting on it would be a
  -- stalled paper, which is the worse failure and the invisible one.
  select count(*) into v_pending from public.question_region
   where run_id = p_run_id and explain_status in ('pending', 'queued', 'running');
  if v_pending > 0 then return false; end if;

  if (select status from public.extraction_run where id = p_run_id) <> 'explaining' then
    return false;
  end if;
  perform public.run_advance(p_run_id, 'ready');
  return true;
end; $$;

revoke all on function public.begin_explanations(uuid)    from public, anon, authenticated;
revoke all on function public.advance_after_explain(uuid) from public, anon, authenticated;
grant execute on function public.begin_explanations(uuid)    to service_role;
grant execute on function public.advance_after_explain(uuid) to service_role;

comment on function public.begin_explanations(uuid) is
  'Opens stage 8, and refuses while any question still needs the student''s eyes. Queues only questions that actually lost marks, hardest-hit first.';

-- ── the eval harness ───────────────────────────────────────────────────────
-- The golden set, run against the real pipeline rather than against a mock of
-- it. `route_override` is the whole point: point the content stage at a
-- different model, rerun, compare. That is how model selection gets decided
-- instead of guessed, and it is why model_route is a table.
--
-- It lives on the run rather than on the queue message so it survives every
-- enqueue downstream. An override that reached only the first stage would have
-- the eval measuring the default model for everything after it — the wrong
-- number, told confidently, which is the failure mode an eval exists to prevent.

alter table public.extraction_run
  add column if not exists route_override jsonb,
  add column if not exists eval_run_id    uuid;

comment on column public.extraction_run.route_override is
  'Set only by eval-run. Never by a client, and never able to relax the provider policy — allow_training is not overridable.';

create table if not exists public.eval_run (
  id                 uuid        primary key default gen_random_uuid(),
  golden_set_version text        not null,
  stages             text[]      not null default '{}',
  route_override     jsonb,
  notes              text,
  papers             integer     not null default 0 check (papers >= 0),
  started_at         timestamptz not null default now(),
  finished_at        timestamptz
);

create table if not exists public.eval_result (
  id           bigserial   primary key,
  eval_run_id  uuid        not null references public.eval_run (id) on delete cascade,
  run_id       uuid,
  paper_id     uuid,
  golden_id    text        not null,
  status       text        not null default 'queued'
                 check (status in ('queued', 'done', 'failed')),
  created_at   timestamptz not null default now(),

  unique (eval_run_id, golden_id)
);

alter table public.eval_run    enable row level security;
alter table public.eval_result enable row level security;

create index if not exists eval_result_run_idx on public.eval_result (eval_run_id);

comment on table public.eval_run is
  'One pass of the golden set. Service-role only: it names models and costs, which is operational rather than student-facing.';
