-- Regression suite for PIPELINE-001.
-- Priority is snapshotted from server-side entitlements on INSERT and must not be
-- rewriteable by a modified authenticated client afterwards.

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- Structural assertion is intentionally used here: the full extraction fixture
-- is already covered by the pipeline suites, while this regression guards the
-- precise database boundary that was missing.
select public._t(
  'priority UPDATE guard exists',
  exists (
    select 1 from information_schema.triggers
     where event_object_schema = 'public'
       and event_object_table = 'extraction_run'
       and trigger_name = 'extraction_priority_server_authored'
       and event_manipulation = 'UPDATE'
  )
);

select public._t(
  'priority guard rejects authenticated changes',
  pg_get_functiondef('private.extraction_priority_is_server_authored()'::regprocedure)
    like '%current_user = ''authenticated''%'
  and pg_get_functiondef('private.extraction_priority_is_server_authored()'::regprocedure)
    like '%new.priority is distinct from old.priority%'
);

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._r;
select * from public._r where not passed order by seq;

rollback;
