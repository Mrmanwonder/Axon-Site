-- ============================================================================
-- The sweeps stop claiming data loss they never checked for
-- ============================================================================
-- This supersedes 20260825170000_honest_sweep_failure_messages.sql, which is
-- deleted in the same commit. That file merged on 2026-08-25 and was never
-- applied to the live project — ten days dead in the tree — and it can no
-- longer be applied verbatim, for two reasons that only showed up on
-- inspecting the running database rather than the file:
--
-- 1. **It would have renamed the queues the dead-letter sweep reads.** It
--    iterates `axon_triage`, `axon_structure`, `axon_content`,
--    `axon_adjudicate`, `axon_explain`. The queues that actually exist are
--    `pgmq.q_mastery_*` — the project rename never reached pgmq. Applied as
--    written, `sweep_dead_letters` would have thrown "relation
--    pgmq.q_axon_triage does not exist" on its first tick and swept nothing,
--    ever. The names below are the ones that exist.
--
-- 2. **It would have reverted `sweep_stuck_runs` by five days.** That function
--    has been rewritten three times in production since 2026-08-25, by
--    migrations that had no files here either (sweep_resets_done_pages_too,
--    ..._fix, sweep_covers_crop — all reconstructed in this same commit). The
--    current body resets `crop_status` for the crop stage and resets `done`
--    structure pages back to `pending`. The old file knows about none of it,
--    and replaying it would have silently deleted both recoveries.
--
-- So the honesty fix is applied ON TOP of the current live bodies rather than
-- by replaying the old file. What actually changes:
--
--   · `private.run_pages_stored()` is created. It did not exist in production
--     at all, which is why nothing downstream could check the fact.
--   · Both sweeps stop asserting an outcome they never verified.
--
-- The bug being fixed: `sweep_dead_letters` told every student "Nothing was
-- saved — you can try again", unconditionally, on every dead-lettered run.
-- That was never a checked fact. `paper-submit` requires every page to carry a
-- real `r2_key` before an `extraction_run` can exist, so by the time a sweep
-- runs the pages are almost always sitting in R2 exactly as they were — the
-- run stalled in processing, it did not lose the photograph. Telling someone
-- their work is gone when it is not is the invisible-failure rule inverted:
-- an admitted gap is recoverable, and a false one costs the trust that makes
-- the rest of the app worth using.
-- ============================================================================

create or replace function private.run_pages_stored(p_paper_id uuid)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.paper_page
     where paper_id = p_paper_id and r2_key is not null
  );
$$;

comment on function private.run_pages_stored(uuid) is
  'Whether this paper actually has stored pages — the checked fact a sweep''s failure message must be based on, never assumed. See failure_messages.ts''s honestFailureReason for the client-side equivalent.';

revoke all on function private.run_pages_stored(uuid) from public, anon, authenticated;

-- ── dead letters ───────────────────────────────────────────────────────────
-- Live body, with the queue names it really has, and the message made
-- conditional on the fact rather than assumed.
create or replace function private.sweep_dead_letters(p_max_attempts integer default 5)
returns integer language plpgsql security definer set search_path = 'public', 'pg_temp' as $function$
declare
  v_queue  text;
  v_msg    record;
  v_run_id uuid;
  v_stored boolean;
  v_swept  integer := 0;
begin
  foreach v_queue in array array[
    'mastery_triage', 'mastery_structure', 'mastery_content',
    'mastery_adjudicate', 'mastery_explain'
  ] loop
    for v_msg in
      execute format(
        'select msg_id, read_ct, message from pgmq.q_%I where read_ct >= $1', v_queue)
      using p_max_attempts
    loop
      v_run_id := (v_msg.message ->> 'run_id')::uuid;
      select private.run_pages_stored(paper_id) into v_stored
        from public.extraction_run where id = v_run_id;

      update public.extraction_run
         set status        = 'failed',
             status_reason = case when coalesce(v_stored, false)
               then 'We could not finish reading this paper — your pages are kept, and you can try again.'
               else 'We could not find the pages for this paper. Try scanning it again.'
             end,
             finished_at   = coalesce(finished_at, now())
       where id = v_run_id
         and status not in ('committed', 'failed', 'rejected');

      perform pgmq.archive(v_queue, v_msg.msg_id);
      v_swept := v_swept + 1;
    end loop;
  end loop;
  return v_swept;
end; $function$;

-- ── stuck runs ─────────────────────────────────────────────────────────────
-- The body below is the current live one (sweep_covers_crop, 2026-09-01) with
-- exactly one change: the hardcoded status_reason becomes the same conditional
-- the dead-letter sweep uses. Every crop_status and structure_status reset is
-- carried over unchanged — that is the part replaying the old file would have
-- destroyed.
create or replace function private.sweep_stuck_runs(p_stale interval default '00:10:00')
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

  if v_run_ids is null then
    return 0;
  end if;

  update public.extraction_run
     set status        = 'failed',
         status_reason = case when private.run_pages_stored(paper_id)
           then 'This paper stopped partway through, but your pages are kept — you can try again.'
           else 'We could not find the pages for this paper. Try scanning it again.'
         end,
         finished_at   = now()
   where id = any(v_run_ids);
  get diagnostics v_swept = row_count;

  update public.question_region
     set extract_status = case when extract_status = 'running' then 'failed' else extract_status end,
         explain_status = case when explain_status = 'running' then 'failed' else explain_status end,
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

  return v_swept;
end; $$;

comment on function private.sweep_dead_letters(integer) is
  'Fails a run whose message exhausted its attempts, worded honestly: never claims data loss unless run_pages_stored() actually says so. Was unconditional until 2026-09-04.';
comment on function private.sweep_stuck_runs(interval) is
  'Fails a run whose worker stopped heartbeating, worded honestly: never claims data loss unless run_pages_stored() actually says so. Also resets structure_status and crop_status so the next run re-reads the pages rather than inheriting stale done/skipped state.';
