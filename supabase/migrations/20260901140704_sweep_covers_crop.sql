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
         status_reason = 'This paper stopped partway through. Your pages are kept — you can try again.',
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
