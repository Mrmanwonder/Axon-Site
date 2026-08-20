-- ============================================================================
-- Enough of Supabase to run the migrations and the test suites on a bare
-- Postgres, so the SQL can be checked without a project.
-- ============================================================================
-- The suites in supabase/tests/ are written to run against any database and
-- roll back. That is only useful if there is a database to run them against,
-- and standing up a real Supabase project to check a CHECK constraint is a
-- disproportionate amount of ceremony. This creates the parts of the platform
-- the migrations actually touch — the two roles, auth.users, auth.uid(),
-- storage.objects and storage.foldername() — and nothing else.
--
-- It is a test fixture, not a model of Supabase. Anything that passes here
-- still has to hold on the real thing, where auth and storage have their own
-- constraints, triggers and grants.
--
--   createdb mastery && psql -d mastery -f supabase/local/shim.sql
--   for f in supabase/migrations/*.sql; do psql -d mastery -v ON_ERROR_STOP=1 -f "$f"; done
--   psql -d mastery -f supabase/tests/rls_and_hard_rules.sql
-- ============================================================================

-- Roles are cluster-wide, not per-database, so a rebuilt database finds them
-- already there. Creating them conditionally keeps a re-run from failing on the
-- first statement.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  instance_id        uuid,
  id                 uuid primary key default gen_random_uuid(),
  aud                text,
  role               text,
  email              text,
  phone              text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Supabase puts the whole JWT in request.jwt.claims and reads `sub` out of it.
-- The older per-claim GUC is accepted too, because some tooling still sets it.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create table storage.buckets (
  id                 text primary key,
  name               text,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz default now()
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

-- Path segments, minus the file name — the policies key on the first segment
-- being a student the signed-in guardian owns.
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1];
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema storage to authenticated, service_role;
grant all on all tables in schema auth to authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
