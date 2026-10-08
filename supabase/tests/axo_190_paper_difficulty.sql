-- AXO-190 schema/access regression assertions. No student data is created.
begin;
create temp table axo_190_assertion (name text, passed boolean, detail text) on commit drop;
insert into axo_190_assertion values
  ('perceived difficulty table exists', to_regclass('public.paper_perceived_difficulty') is not null, null),
  ('one response per paper', exists(
    select 1 from pg_constraint where conrelid='public.paper_perceived_difficulty'::regclass and contype='p'
  ), null),
  ('foreign keys to paper/student', 2 = (
    select count(*) from pg_constraint where conrelid='public.paper_perceived_difficulty'::regclass and contype='f'
  ), null),
  ('RLS is enabled', exists(
    select 1 from pg_class where oid='public.paper_perceived_difficulty'::regclass and relrowsecurity
  ), null),
  ('no anon SELECT', not has_table_privilege('anon','public.paper_perceived_difficulty','SELECT'), null),
  ('authenticated INSERT/UPDATE, not DELETE', has_table_privilege('authenticated','public.paper_perceived_difficulty','INSERT')
    and has_table_privilege('authenticated','public.paper_perceived_difficulty','UPDATE')
    and not has_table_privilege('authenticated','public.paper_perceived_difficulty','DELETE'), null),
  ('RLS SELECT scopes to student', exists(
    select 1 from pg_policies where tablename='paper_perceived_difficulty' and cmd='SELECT'
      and qual like '%current_student_scope_id%'
  ), null),
  ('RLS writes also require paper ownership', exists(
    select 1 from pg_policies where tablename='paper_perceived_difficulty' and cmd='INSERT'
      and with_check like '%student_scope_allows%' and with_check like '%paper%'
  ) and exists(
    select 1 from pg_policies where tablename='paper_perceived_difficulty' and cmd='UPDATE'
      and with_check like '%student_scope_allows%' and with_check like '%paper%'
  ), null),
  ('insights view is security invoker', exists(
    select 1 from pg_class where oid='public.paper_difficulty_analytics'::regclass
      and 'security_invoker=true'=any(coalesce(reloptions,'{}'::text[]))
  ), null);
select count(*)::text||'|'||count(*) filter (where passed)::text||'|'||count(*) filter (where not passed)::text
  from axo_190_assertion;
select name,detail from axo_190_assertion where not passed;
rollback;