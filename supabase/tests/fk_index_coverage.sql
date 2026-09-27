-- ============================================================================
-- AXO-64 — Axon-owned unindexed foreign-key coverage
-- ============================================================================
-- Structural regression: every FK targeted by AXO-64 must have a valid index
-- whose FIRST key is the FK column. Merely appearing later in a composite index
-- does not satisfy the foreign-key advisor or parent-delete lookup.
-- ============================================================================

begin;

create table public._axo64_fk_index_test (
  seq serial primary key,
  name text not null,
  passed boolean not null,
  detail text
);

create or replace function public._axo64_t(n text, p boolean, d text default null)
returns void
language sql
as $$ insert into public._axo64_fk_index_test(name, passed, detail) values (n, p, d); $$;

do $$
declare
  r record;
  covered boolean;
begin
  for r in
    select *
    from (values
      ('private','student_scope_session','student_id'),
      ('public','assessment_identity','subject_offering_id'),
      ('public','canonical_question','scheme_document_id'),
      ('public','curriculum_stage','programme_id'),
      ('public','scheme_document','policy_id'),
      ('public','scheme_document','superseded_by_id'),
      ('public','student','programme_id'),
      ('public','student','stage_id'),
      ('public','student_subject','subject_offering_id'),
      ('public','subject_offering','stage_id'),
      ('public','subject_offering','subject_id')
    ) as targets(schema_name, table_name, column_name)
  loop
    select exists (
      select 1
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = r.schema_name
        and t.relname = r.table_name
        and i.indisvalid
        and i.indisready
        and pg_get_indexdef(i.indexrelid, 1, true) = r.column_name
    ) into covered;

    perform public._axo64_t(
      format('%I.%I.%I has a leading-key FK index', r.schema_name, r.table_name, r.column_name),
      covered,
      case when covered then null else 'no valid/ready index begins with this FK column' end
    );
  end loop;
end $$;

-- Axon migrations must not mutate Stripe-managed schema to clear its advisor
-- warning. This test intentionally makes no assertion that Stripe's warning is
-- gone; its disposition is a documented provider-managed no-op.

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._axo64_fk_index_test;

select seq, name, passed, detail
from public._axo64_fk_index_test
where not passed
order by seq;

do $$
begin
  if exists (select 1 from public._axo64_fk_index_test where not passed) then
    raise exception 'AXO-64 FK index coverage tests failed';
  end if;
end $$;

rollback;
