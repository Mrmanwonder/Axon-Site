-- Issue #301: REST 500s on rpc/set_practice_pref, mark_loss_analytics and
-- student_attempt, which left Home, Insights and Settings on loaders.
--
-- The 500s were `canceling statement due to statement timeout` (the
-- `authenticated` role runs at 8s). The tables involved are tiny; what was
-- slow was the database itself, and the largest avoidable load was
-- set_practice_pref, called on every Home load: it validated the zone with
-- `pg_catalog.pg_timezone_names`, which reads and parses the whole tz database
-- on every call (pg_stat_statements: mean 540 ms, max 7.4 s for that scan,
-- mean 1.7 s for the RPC). The reads that failed beside it in the same second
-- were queued behind it.

-- 1. Validate the zone without scanning the tz database. Casting through
--    AT TIME ZONE asks the server's own resolver, which is a hash lookup. The
--    shape check keeps POSIX offsets ("UTC+5") and abbreviations out, as the
--    catalog lookup did: only Area/Location names and UTC are stored.
create or replace function public.set_practice_pref(
  p_student uuid,
  p_timezone text default null,
  p_outlook_opt_in boolean default null,
  p_dismiss_target_prompt boolean default null
)
returns public.student_practice_pref
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.student_practice_pref;
begin
  perform private.require_scope(p_student);
  if p_timezone is not null then
    if p_timezone !~ '^(UTC|[A-Za-z_]+(/[A-Za-z0-9_+-]+)+)$' then
      raise exception 'unknown time zone' using errcode = '22023';
    end if;
    begin
      perform now() at time zone p_timezone;
    exception when others then
      raise exception 'unknown time zone' using errcode = '22023';
    end;
  end if;
  insert into public.student_practice_pref (student_id) values (p_student) on conflict do nothing;
  update public.student_practice_pref
     set timezone = coalesce(p_timezone, timezone),
         outlook_opt_in = coalesce(p_outlook_opt_in, outlook_opt_in),
         target_prompt_dismissed_at = case when p_dismiss_target_prompt then coalesce(target_prompt_dismissed_at, now())
                                           when p_dismiss_target_prompt is false then null
                                           else target_prompt_dismissed_at end,
         updated_at = now()
   where student_id = p_student
  returning * into v_row;
  return v_row;
end;
$$;

-- 2. in_free_archive_window reads current_date, so it is not IMMUTABLE. As
--    IMMUTABLE the planner may fold it into a cached plan for the
--    student_attempt archive-gate policy and keep yesterday's answer.
alter function private.in_free_archive_window(date) stable;

-- 3. pg_cron history. cron.job_run_details had taken >110k inserts with no
--    retention, and its own insert/update statements were among the slowest on
--    the instance (max 60 s), alongside "job startup timeout" errors. Keep a
--    week.
create or replace function private.purge_cron_history()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer := 0;
begin
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < now() - interval ''7 days''';
    get diagnostics v_rows = row_count;
  end if;
  return v_rows;
end;
$$;
revoke all on function private.purge_cron_history() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'axon-cron-history-retention';
    perform cron.schedule('axon-cron-history-retention', '23 4 * * *', 'select private.purge_cron_history();');
  end if;
end $$;
