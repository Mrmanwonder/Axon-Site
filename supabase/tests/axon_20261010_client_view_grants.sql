-- Least-privilege regression test for the public student-data view surface.
-- This is metadata-only: safe against a test database containing real data.
do $audit$
declare
  view_name text;
  v_oid oid;
begin
  foreach view_name in array ARRAY[
    'attempt_analytics','consent_current','mark_loss_analytics',
    'paper_canonical_run','paper_progress','review_queue',
    'student_analytics_readiness','topic_evidence'
  ] loop
    select c.oid into v_oid
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = view_name and c.relkind = 'v'
       and 'security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[]));
    if v_oid is null then
      raise exception 'Missing security_invoker view: %', view_name;
    end if;
    if has_table_privilege('anon',v_oid,'SELECT')
       or has_table_privilege('anon',v_oid,'UPDATE')
       or has_table_privilege('authenticated',v_oid,'INSERT')
       or has_table_privilege('authenticated',v_oid,'UPDATE')
       or has_table_privilege('authenticated',v_oid,'DELETE')
       or not has_table_privilege('authenticated',v_oid,'SELECT')
       or not has_table_privilege('service_role',v_oid,'SELECT') then
      raise exception 'Unsafe view privileges: %', view_name;
    end if;
    v_oid := null;
  end loop;
  if has_function_privilege('anon','public.bootstrap_current_user()'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.bootstrap_current_user()'::regprocedure,'EXECUTE') then
    raise exception 'Unsafe bootstrap_current_user grants';
  end if;
end
$audit$;

-- CI harness expects a pipe-delimited total|passed|failed count.
select 1 as total, 1 as passed, 0 as failed;
