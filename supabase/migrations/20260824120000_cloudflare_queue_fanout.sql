-- ============================================================================
-- 0015 · Fan-out moves from pgmq to the Worker that calls the RPC
-- ============================================================================
-- CLOUDFLARE_WORKERS.md. pgmq is gone — Cloudflare Queues has no SQL-callable
-- send, so nothing in Postgres can enqueue anything any more. The three RPCs
-- that used to call `pgmq.send(...)` as part of their own transaction
-- (advance_after_structure, advance_after_content, begin_explanations) keep
-- their advisory-locked completion check — that part is still safest done in
-- one transaction, for exactly the reason 0014 gives: two workers finishing
-- the same instant is normal, not exceptional. What changes is the return
-- value: instead of enqueueing internally, each function now returns *what*
-- to enqueue, and the calling Cloudflare Worker does the actual
-- `env.<QUEUE>.send()` after the RPC returns successfully.
--
-- This does trade one guarantee for another, worth stating plainly: the
-- enqueue is no longer in the same transaction as the state transition. A
-- worker that crashes between the RPC returning and the queue send would
-- leave a run advanced with nothing enqueued behind it. That gap is exactly
-- what `sweep_stuck_runs` exists to close — REVIEW_PIPELINE.md §11's rule
-- that no run may sit in a non-terminal status past an hour without the
-- student being told holds regardless of which side of that gap it stalled
-- on, and mastery-sweep's cron runs every 15 minutes, not every hour, against
-- exactly this class of failure.
-- ============================================================================

drop function if exists public.advance_after_structure(uuid);
drop function if exists public.advance_after_content(uuid);
drop function if exists public.begin_explanations(uuid);

-- Structure is done when every page is. A page that could not be read is done
-- too — it becomes a visible gap on the review screen rather than a paper
-- that never advances.
create or replace function public.advance_after_structure(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_paper   uuid;
  v_pending integer;
  v_regions uuid[];
begin
  perform private.run_lock(p_run_id);
  select paper_id into v_paper from public.extraction_run where id = p_run_id;
  if v_paper is null then return jsonb_build_object('advanced', false); end if;

  select count(*) into v_pending from public.paper_page
   where paper_id = v_paper and structure_status in ('pending', 'running');
  if v_pending > 0 then return jsonb_build_object('advanced', false); end if;

  if (select status from public.extraction_run where id = p_run_id) <> 'structure' then
    return jsonb_build_object('advanced', false);
  end if;

  perform public.run_advance(p_run_id, 'content');

  select array_agg(id order by order_index) into v_regions
    from public.question_region
   where run_id = p_run_id and extract_status = 'pending';

  -- A paper whose structure pass found no questions at all has nothing to
  -- extract, and going quiet here is exactly the invisible failure hard rule
  -- 4 forbids. Tell the caller to send it straight to reconciliation, which
  -- will say so.
  return jsonb_build_object(
    'advanced', true,
    'enqueue_content', coalesce(to_jsonb(v_regions), '[]'::jsonb),
    'enqueue_reconcile', coalesce(array_length(v_regions, 1), 0) = 0
  );
end; $$;

create or replace function public.advance_after_content(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pending integer;
begin
  perform private.run_lock(p_run_id);
  select count(*) into v_pending from public.question_region
   where run_id = p_run_id and extract_status in ('pending', 'running');
  if v_pending > 0 then return jsonb_build_object('advanced', false); end if;

  if (select status from public.extraction_run where id = p_run_id) <> 'content' then
    return jsonb_build_object('advanced', false);
  end if;

  perform public.run_advance(p_run_id, 'attribution');
  return jsonb_build_object('advanced', true, 'enqueue_reconcile', true);
end; $$;

revoke all on function public.advance_after_structure(uuid) from public, anon, authenticated;
revoke all on function public.advance_after_content(uuid)   from public, anon, authenticated;
grant execute on function public.advance_after_structure(uuid) to service_role;
grant execute on function public.advance_after_content(uuid)   to service_role;

comment on function public.advance_after_structure(uuid) is
  'Advisory-locked completion check for stage 3. Returns what to enqueue rather than enqueueing itself — pgmq is gone, so the calling Cloudflare Worker sends to content-queue / reconcile-queue after this returns.';
comment on function public.advance_after_content(uuid) is
  'Advisory-locked completion check for stage 4. Returns enqueue_reconcile: true rather than sending to reconcile-queue itself.';

-- ── explanations run after review ──────────────────────────────────────────

create or replace function public.begin_explanations(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pending integer; v_regions uuid[];
begin
  perform private.run_lock(p_run_id);

  select count(*) into v_pending from public.question_region
   where run_id = p_run_id and needs_review and student_confirmed_at is null;
  if v_pending > 0 then
    raise exception '% question(s) still need review before explanations can start', v_pending
      using errcode = '42501';
  end if;

  if (select status from public.extraction_run where id = p_run_id) not in ('needs_review', 'explaining') then
    return jsonb_build_object('queued', 0, 'region_ids', '[]'::jsonb);
  end if;
  perform public.run_advance(p_run_id, 'explaining');

  -- Nothing to explain is not a pending explanation. A question with full
  -- marks needs no prose, and paying a model to produce "well done" would be
  -- the most expensive way to say it.
  update public.question_region r
     set explain_status = 'skipped'
   where r.run_id = p_run_id
     and r.explain_status = 'pending'
     and (r.confidence_tier = 'unreadable'
          or r.marks_awarded is null or r.marks_available is null
          or r.marks_awarded >= r.marks_available);

  -- Hardest-hit first, so the questions a student most wants explained are
  -- the ones that land while they are still looking at the screen.
  select array_agg(id) into v_regions from (
    select r.id from public.question_region r
     where r.run_id = p_run_id and r.explain_status = 'pending'
     order by (r.marks_available - r.marks_awarded) desc, r.order_index
  ) ordered;

  update public.question_region
     set explain_status = 'queued'
   where id = any(coalesce(v_regions, '{}'::uuid[]));

  -- Nothing to explain is a finished paper, not a stalled one. Checked against
  -- what is outstanding rather than what this call queued, so a retry that
  -- queued nothing does not declare a paper ready while work is still in
  -- flight. The Worker enqueues v_regions; this only decides whether the run
  -- can move straight to 'ready' when there was nothing to send.
  if not exists (select 1 from public.question_region
                  where run_id = p_run_id and explain_status in ('pending', 'queued', 'running')) then
    perform public.run_advance(p_run_id, 'ready');
  end if;

  return jsonb_build_object('queued', coalesce(array_length(v_regions, 1), 0),
                             'region_ids', coalesce(to_jsonb(v_regions), '[]'::jsonb));
end; $$;

revoke all on function public.begin_explanations(uuid) from public, anon, authenticated;
grant execute on function public.begin_explanations(uuid) to service_role;

comment on function public.begin_explanations(uuid) is
  'Opens stage 8, and refuses while any question still needs the student''s eyes. Returns the region ids to enqueue rather than sending to explain-queue itself.';
