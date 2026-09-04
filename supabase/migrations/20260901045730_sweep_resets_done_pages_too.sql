-- AXON_FIX_BRIEF.md §4.D3 / §9.3: sweep_stuck_runs only reset
-- paper_page.structure_status where it was 'running'. A page a completed
-- structure pass had already marked 'done' under a run that then got swept
-- (failed) stayed 'done' forever — recovery depended entirely on the
-- triage-side reset (§3.2), which only fires when a *new* run starts on the
-- same paper, not on the sweep that just failed the old one. This makes the
-- sweep self-sufficient: it now resets both 'running' and 'done' pages of a
-- paper whose run it just failed, so the next run on that paper doesn't
-- inherit stale "already done" pages that were never actually committed to
-- anything (the run that produced them was just failed, its regions never
-- reached commit).
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

  -- Both 'running' (mid-structure-pass) and 'done' (structure finished, but
  -- under a run that never got further than this sweep) reset to 'pending',
  -- so the next run on this paper re-reads the page rather than silently
  -- skipping it as "already done" for output nothing downstream ever used.
  update public.paper_page
     set structure_status = 'pending'
   where paper_id in (select paper_id from public.extraction_run where id = any(v_run_ids))
     and structure_status in ('running', 'done');

  return v_swept;
end; $function$;
