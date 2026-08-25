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
--   createdb axon && psql -d axon -f supabase/local/shim.sql
--   for f in supabase/migrations/*.sql; do psql -d axon -v ON_ERROR_STOP=1 -f "$f"; done
--   psql -d axon -f supabase/tests/rls_and_hard_rules.sql
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

-- ── pgmq, enough of it ─────────────────────────────────────────────────────
-- The migrations create queues and the dead-letter sweep reads their tables.
-- Neither needs a working queue to be schema-checked, so this provides the
-- three functions the migrations call and the per-queue table shape the sweep
-- addresses dynamically. Message delivery is not simulated: anything that
-- depends on visibility timeouts has to be tested on the real extension.

create schema if not exists pgmq;

create table if not exists pgmq.meta (
  queue_name text primary key,
  created_at timestamptz not null default now()
);

create or replace function pgmq.list_queues()
returns table (queue_name text, created_at timestamptz)
language sql stable as $$ select m.queue_name, m.created_at from pgmq.meta m $$;

create or replace function pgmq.create(queue_name text)
returns void language plpgsql as $$
begin
  insert into pgmq.meta (queue_name) values (queue_name) on conflict do nothing;
  execute format(
    'create table if not exists pgmq.q_%I (
       msg_id     bigserial primary key,
       read_ct    integer     not null default 0,
       enqueued_at timestamptz not null default now(),
       vt         timestamptz not null default now(),
       message    jsonb)', queue_name);
  execute format(
    'create table if not exists pgmq.a_%I (like pgmq.q_%I including all)', queue_name, queue_name);
end; $$;

create or replace function pgmq.send(queue_name text, msg jsonb, delay integer default 0)
returns bigint language plpgsql as $$
declare v_id bigint;
begin
  execute format(
    'insert into pgmq.q_%I (message, vt) values ($1, now() + make_interval(secs => $2)) returning msg_id',
    queue_name) into v_id using msg, delay;
  return v_id;
end; $$;

create or replace function pgmq.read(queue_name text, p_vt integer, qty integer)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
language plpgsql as $$
begin
  return query execute format(
    'update pgmq.q_%I q set read_ct = q.read_ct + 1, vt = now() + make_interval(secs => $1)
      where q.msg_id in (select msg_id from pgmq.q_%I where vt <= now() order by msg_id limit $2)
      returning q.msg_id, q.read_ct, q.enqueued_at, q.vt, q.message',
    queue_name, queue_name) using p_vt, qty;
end; $$;

create or replace function pgmq.delete(queue_name text, msg_id bigint)
returns boolean language plpgsql as $$
begin
  execute format('delete from pgmq.q_%I where msg_id = $1', queue_name) using msg_id;
  return true;
end; $$;

create or replace function pgmq.archive(queue_name text, msg_id bigint)
returns boolean language plpgsql as $$
begin
  execute format(
    'with moved as (delete from pgmq.q_%I where msg_id = $1 returning *)
     insert into pgmq.a_%I select * from moved', queue_name, queue_name) using msg_id;
  return true;
end; $$;

-- ── cron and net, named only ───────────────────────────────────────────────
-- schedule_pipeline_tick() references these inside a plpgsql body, which is not
-- resolved at creation time. The schemas exist so a call made by hand fails
-- with something legible rather than "schema does not exist".

create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create schema if not exists net;

grant usage on schema pgmq, cron, net to service_role;
