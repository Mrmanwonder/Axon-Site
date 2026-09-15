-- Regression coverage for AUTHZ-001.
-- PostgreSQL ORs permissive policies, so "the secure policy exists" is not
-- enough: it must be the only authenticated INSERT policy on consent_event.

begin;

create table public._r (
  seq serial primary key,
  name text,
  passed boolean,
  detail text
);

create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$
  insert into public._r (name, passed, detail) values (n, p, d);
$$;

select public._t(
  'stale production consent policy is absent',
  not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'consent_event'
       and policyname = 'Guardians can append their own consent events'
  )
);

select public._t(
  'exactly one authenticated INSERT policy protects consent_event',
  (
    select count(*)
      from pg_policies
     where schemaname = 'public'
       and tablename = 'consent_event'
       and cmd = 'INSERT'
       and 'authenticated' = any(roles)
  ) = 1,
  (
    select string_agg(policyname, ', ' order by policyname)
      from pg_policies
     where schemaname = 'public'
       and tablename = 'consent_event'
       and cmd = 'INSERT'
       and 'authenticated' = any(roles)
  )
);

select public._t(
  'consent INSERT policy requires Parent Mode freshness',
  exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'consent_event'
       and policyname = 'consent_event_insert_own'
       and with_check like '%private.has_fresh_auth()%'
  )
);

select public._t(
  'consent INSERT policy binds student to current guardian',
  exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'consent_event'
       and policyname = 'consent_event_insert_own'
       and with_check like '%s.guardian_id = private.current_guardian_id()%'
  )
);

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._r;
select * from public._r where not passed order by seq;

rollback;
