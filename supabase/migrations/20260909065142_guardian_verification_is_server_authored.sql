-- ============================================================================
-- Guardian verification is server-authored
-- ============================================================================
-- Remediation P0-001. The onboarding screen said "Verify it's you", and what
-- happened next was `sb.from('guardian').update({ verified_at, ... })` from the
-- browser, with a development adapter that returns success without asserting
-- anything about a real person.
--
-- Two separate problems live in that sentence, and the build guard in
-- src/verification.js only fixes the first:
--
--   1. a shipped bundle could select the development adapter;
--   2. *any* client could write those three columns regardless of adapter,
--      because `guardian_update_own` grants UPDATE on the whole row.
--
-- (2) is the one that survives a fixed build, so it is fixed here, in the only
-- place a tampered bundle cannot argue with. After this migration:
--
--   · a trigger refuses any change to those three columns made as the
--     `authenticated` role, so an UPDATE from the browser fails outright;
--   · the only way in is public.record_guardian_verification(), which is the
--     seam a real server-side adapter will land in;
--   · that function refuses methods that assert nothing about a person,
--     unless the database it is running in has explicitly opted in.
--
-- The opt-in is a row, not a GUC or an environment variable, because it has to
-- be false in production *by virtue of having applied this migration* — not by
-- virtue of someone remembering to set something afterwards. A local database
-- opts in with one deliberate statement:
--
--   update private.app_config set value = 'true'::jsonb
--    where key = 'allow_unverified_verification_methods';
--
-- The hosted project gets `false` from this migration and keeps it, and
-- supabase/tests/guardian_verification.sql asserts both sides of the switch.
-- ============================================================================

-- ── the opt-in ─────────────────────────────────────────────────────────────

create table if not exists private.app_config (
  key         text        primary key,
  value       jsonb       not null,
  updated_at  timestamptz not null default now(),
  note        text
);

comment on table private.app_config is
  'Deployment-scoped switches that must default to the safe value on a fresh database. Service-role only: it is in the private schema and carries no policy, so authenticated reaches nothing here.';

alter table private.app_config enable row level security;

insert into private.app_config (key, value, note) values
  ('allow_unverified_verification_methods', 'false'::jsonb,
   'When true, record_guardian_verification accepts methods that prove nothing about a real person (the development stub). Must stay false anywhere a real family can sign up.')
on conflict (key) do nothing;

create or replace function private.config_flag(p_key text, p_default boolean default false)
returns boolean
language sql
stable
security definer
set search_path = private, pg_temp
as $$
  select coalesce((select (c.value #>> '{}')::boolean from private.app_config c where c.key = p_key), p_default);
$$;

revoke all on function private.config_flag(text, boolean) from public, anon, authenticated;

comment on function private.config_flag is
  'Reads a private.app_config boolean, falling back to the safe default when the row is absent — a missing switch must never read as "permitted".';

-- ── methods that assert nothing ────────────────────────────────────────────
--
-- Kept as a function rather than inlined, so the day DigiLocker lands there is
-- one place to say so and the tests keep pointing at it.

create or replace function private.verification_method_proves_identity(p_method text)
returns boolean
language sql
immutable
as $$
  select p_method is not null and p_method <> 'stub';
$$;

revoke all on function private.verification_method_proves_identity(text) from public, anon;
grant execute on function private.verification_method_proves_identity(text) to authenticated;

comment on function private.verification_method_proves_identity is
  'False for adapters that return success without checking a person. Rule 10 of the DPDP Rules 2025 needs identity, adulthood and relationship; the stub establishes none of the three.';

-- ── the seam ───────────────────────────────────────────────────────────────

create or replace function public.record_guardian_verification(p_method text, p_reference text)
returns public.guardian
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_auth uuid := (select auth.uid());
  v_row  public.guardian;
begin
  if v_auth is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_reference is null or length(btrim(p_reference)) = 0 then
    raise exception 'a verification reference is required' using errcode = '22023';
  end if;

  -- The enum is the schema's own list of methods; anything outside it is a
  -- caller inventing one, which is exactly what this function exists to stop.
  if p_method is null or not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'verify_method' and e.enumlabel = p_method
  ) then
    raise exception 'unknown verification method: %', coalesce(p_method, '(null)')
      using errcode = '22023';
  end if;

  if not private.verification_method_proves_identity(p_method)
     and not private.config_flag('allow_unverified_verification_methods') then
    raise exception
      'verification method % proves nothing about a real person and is not permitted on this database', p_method
      using errcode = '42501';
  end if;

  -- `verified_at` is now() and never a caller-supplied timestamp: a client
  -- that could choose it could back-date a verification to before a consent
  -- notice changed. The reference is the adapter's, because only the adapter
  -- can produce it; it is opaque to us either way.
  update public.guardian g
     set verified_at         = now(),
         verification_method = p_method::public.verify_method,
         verification_ref    = p_reference,
         updated_at          = now()
   where g.auth_user_id = v_auth
     and g.deleted_at is null
  returning g.* into v_row;

  if v_row.id is null then
    raise exception 'no account for this session' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke all on function public.record_guardian_verification(text, text) from public, anon;
grant execute on function public.record_guardian_verification(text, text) to authenticated;

comment on function public.record_guardian_verification is
  'The only way a verification reaches public.guardian. Sets verified_at to now() rather than a caller-supplied time, validates the method against the verify_method enum, and refuses methods that assert nothing about a real person unless this database has explicitly opted in.';

-- ── close the direct route ─────────────────────────────────────────────────
--
-- A trigger rather than a column-level revoke, and the reason is specific:
-- 20260826074500_public_schema_default_grants.sql issues a blanket
-- `grant select, insert, update, delete on all tables in schema public` plus a
-- matching ALTER DEFAULT PRIVILEGES. A column grant carved out of that is one
-- re-run of a routine grants migration away from quietly coming back, and the
-- failure would be silent — exactly the shape of bug this rule exists to stop.
--
-- The discriminator is `current_user`. PostgREST executes a client request as
-- `authenticated`; record_guardian_verification() above is SECURITY DEFINER, so
-- inside it — and inside any trigger it fires — `current_user` is that
-- function's owner instead.
--
-- Two ways to get this wrong, both of which look right and protect nothing:
--
--   · `current_setting('role')` instead of `current_user`. SECURITY DEFINER
--     changes the effective user without changing that GUC, so the RPC would
--     trip its own guard and no verification could ever be recorded.
--   · marking THIS function SECURITY DEFINER. Then `current_user` is its owner
--     on every call, a client UPDATE included, and the branch never runs.

create or replace function private.guardian_verification_is_server_authored()
returns trigger
language plpgsql
-- SECURITY INVOKER, and that is the entire mechanism rather than an oversight.
-- A SECURITY DEFINER trigger would see `current_user` as its own owner on every
-- call, including a client UPDATE, and would therefore never fire — it would
-- look correct and protect nothing.
set search_path = public, private, pg_temp
as $$
begin
  if current_user = 'authenticated' then
    if new.verified_at         is distinct from old.verified_at
    or new.verification_method is distinct from old.verification_method
    or new.verification_ref    is distinct from old.verification_ref then
      raise exception
        'verification columns are server-authored; use record_guardian_verification()'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_verification_server_authored on public.guardian;
create trigger guardian_verification_server_authored
  before update on public.guardian
  for each row execute function private.guardian_verification_is_server_authored();

comment on function private.guardian_verification_is_server_authored is
  'Makes "the browser cannot mint its own verified result" true rather than intended. Blocks any change to the three verification columns made as the authenticated role; record_guardian_verification() runs as definer and so passes.';
