-- AXO-191 source precedence, version history and scoped read tests.
begin;
create temp table axo_191_assertion (name text, passed boolean, detail text) on commit drop;
insert into axo_191_assertion values
  ('canonical difficulty table and snapshot exist', to_regclass('public.canonical_question_difficulty') is not null
    and to_regclass('public.attempt_question_difficulty_snapshot') is not null, null),
  ('canonical question/source/version unique constraint', exists(
    select 1 from pg_constraint where conrelid='public.canonical_question_difficulty'::regclass
      and contype='u' and pg_get_constraintdef(oid) like '%method_version%'
  ), null),
  ('difficulty RLS protected', exists(
    select 1 from pg_class where oid='public.canonical_question_difficulty'::regclass and relrowsecurity
  ) and exists(
    select 1 from pg_class where oid='public.attempt_question_difficulty_snapshot'::regclass and relrowsecurity
  ), null),
  ('anon cannot read difficulty', not has_table_privilege('anon','public.canonical_question_difficulty','SELECT'), null),
  ('authenticated cannot alter intrinsic evidence', not has_table_privilege('authenticated','public.canonical_question_difficulty','INSERT')
    and not has_table_privilege('authenticated','public.canonical_question_difficulty','UPDATE')
    and not has_table_privilege('authenticated','public.canonical_question_difficulty','DELETE'), null),
  ('scope checked on reads', exists(
    select 1 from pg_policies where tablename='canonical_question_difficulty' and cmd='SELECT'
      and qual like '%current_student_scope_id%'
  ), null),
  ('current and analytics views use invoker RLS', exists(
    select 1 from pg_class where oid='public.canonical_question_difficulty_current'::regclass
      and 'security_invoker=true'=any(coalesce(reloptions,'{}'::text[]))
  ) and exists(
    select 1 from pg_class where oid='public.question_difficulty_analytics'::regclass
      and 'security_invoker=true'=any(coalesce(reloptions,'{}'::text[]))
  ), null),
  ('structural 1 mark estimates very easy', private.structural_question_band(1::smallint, 'State the law')=1, null),
  ('higher-mark reasoning is never very easy', private.structural_question_band(9::smallint, 'Evaluate evidence')>=4, null),
  ('evaluate command is recognized even when maximum mark is small', private.structural_question_band(2::smallint, 'Evaluate the result')=4, null),
  ('state command is not promoted to evaluative', private.structural_question_band(2::smallint, 'State the result')=2, null),
  ('snapshot trigger is present', exists(
    select 1 from pg_trigger where tgrelid='public.student_attempt'::regclass
      and tgname='axo_191_snapshot_attempt_difficulty' and not tgisinternal
  ), null);
select count(*)::text||'|'||count(*) filter (where passed)::text||'|'||count(*) filter (where not passed)::text
  from axo_191_assertion;
select name,detail from axo_191_assertion where not passed;
rollback;