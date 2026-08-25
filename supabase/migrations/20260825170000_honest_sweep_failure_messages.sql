-- Fix the same lying-about-data-loss bug the mastery-triage worker had, but
-- at the database level: both sweeps in 0013 (r2_and_runtime) unconditionally
-- tell the student "nothing was saved" whenever they fail a stalled run.
--
-- That was never a checked fact. paper-submit requires every page to already
-- carry a real r2_key before an extraction_run can exist at all, so by the
-- time either sweep runs, the pages are almost always sitting in R2 exactly
-- as they were — the sweep is closing out a run that stalled somewhere in
-- processing, not one that lost the photo. See supabase/functions/_shared/
-- failure_messages.ts for the client-side worker fix this mirrors.

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

create or replace function private.sweep_dead_letters(p_max_attempts integer default 5)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_queue  text;
  v_msg    record;
  v_run_id uuid;
  v_stored boolean;
  v_swept  integer := 0;
begin
  foreach v_queue in array array[
    'axon_triage', 'axon_structure', 'axon_content',
    'axon_adjudicate', 'axon_explain'
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
end; $$;

create or replace function private.sweep_stuck_runs(p_stale interval default interval '10 minutes')
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_swept integer;
begin
  update public.extraction_run
     set status        = 'failed',
         status_reason = case when private.run_pages_stored(paper_id)
           then 'This paper stopped partway through, but your pages are kept — you can try again.'
           else 'We could not find the pages for this paper. Try scanning it again.'
         end,
         finished_at   = now()
   where status not in ('queued', 'needs_review', 'ready', 'committed', 'failed', 'rejected')
     and coalesce(heartbeat_at, started_at) < now() - p_stale;
  get diagnostics v_swept = row_count;
  return v_swept;
end; $$;

comment on function private.sweep_dead_letters(integer) is
  'Fails a run whose message exhausted its attempts, worded honestly: never claims data loss unless run_pages_stored() actually says so. Was previously unconditional — see 0025 (this migration).';
comment on function private.sweep_stuck_runs(interval) is
  'Fails a run whose worker stopped heartbeating, worded honestly: never claims data loss unless run_pages_stored() actually says so. Was previously unconditional — see 0025 (this migration).';
