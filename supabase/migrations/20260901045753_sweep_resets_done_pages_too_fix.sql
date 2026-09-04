-- Correction to the previous migration: keep the existing 'running' ->
-- 'failed' behavior exactly as it was (a page genuinely was mid-processing
-- and its run just got failed out from under it — 'failed' says what
-- happened). Only 'done' additionally resets to 'pending', per the brief's
-- literal §9.3 ask: a page whose structure pass genuinely finished, but
-- under a run that stalled before committing anything from it, is not
-- "failed" — it just needs to be re-read by the next run rather than
-- silently treated as already-done output nothing downstream ever used.
create or replace function private.sweep_stuck_runs(p_stale interval DEFAULT '00:10:00'::interval)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
         status_reason = 'This paper stopped partway through. Your pages are kept — you can try again.',
         finished_at   = now()
   where id = any(v_run_ids);
  get diagnostics v_swept = row_count;

  -- Close out anything left mid-flight under a run we just failed, so a
  -- swept paper never leaves individual questions/pages frozen at
  -- "running"/"pending" forever (the orphaned-region bug found 2026-08-31).
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

  -- AXON_FIX_BRIEF.md §4.D3 / §9.3: a page whose structure pass already
  -- finished ('done') under a run that stalled further downstream and just
  -- got swept never had a reason to be re-read — nothing set it back to
  -- 'pending' except a brand-new run's triage-side reset (§3.2), which only
  -- fires if a *new* run is ever started. Make the sweep self-sufficient
  -- instead of depending on that.
  update public.paper_page
     set structure_status = 'pending'
   where paper_id in (select paper_id from public.extraction_run where id = any(v_run_ids))
     and structure_status = 'done';

  return v_swept;
end; $function$;
