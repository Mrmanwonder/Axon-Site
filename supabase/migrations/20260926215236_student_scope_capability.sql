-- ============================================================================
-- AXO-60 — Student Mode server scope
-- ============================================================================
-- The guardian remains the Supabase auth principal, but daily academic access
-- must be constrained to one explicitly selected student profile. The active
-- student is stored server-side and bound to the signed Supabase auth
-- session_id claim; clients cannot widen scope by changing a student_id query.
--
-- Multi-profile selection requires fresh Parent Mode. Single-profile households
-- may establish their only possible scope without an extra re-auth challenge.
-- ============================================================================

create table if not exists private.student_scope_session (
  guardian_id     uuid        not null references public.guardian(id) on delete cascade,
  auth_session_id text        not null,
  student_id      uuid        not null references public.student(id) on delete cascade,
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  primary key (guardian_id, auth_session_id),
  constraint student_scope_expiry_after_issue check (expires_at > issued_at)
);

revoke all on table private.student_scope_session from public, anon, authenticated;

comment on table private.student_scope_session is
  'AXO-60. One short-lived active Student Mode profile per guardian auth session. Server-authored only; academic RLS consumes it through private.student_scope_allows().';

create or replace function private.current_auth_session_id()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select nullif(btrim(coalesce((select auth.jwt()->>'session_id'), '')), '');
$$;

revoke all on function private.current_auth_session_id() from public, anon;
grant execute on function private.current_auth_session_id() to authenticated;

comment on function private.current_auth_session_id is
  'Signed Supabase session_id claim. Null means Student Mode scope cannot be established or trusted.';

create or replace function private.student_scope_allows(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(exists (
    select 1
      from private.student_scope_session scope
      join public.student s on s.id = scope.student_id
     where scope.guardian_id = private.current_guardian_id()
       and scope.auth_session_id = private.current_auth_session_id()
       and scope.student_id = p_student
       and scope.revoked_at is null
       and scope.expires_at > now()
       and s.guardian_id = scope.guardian_id
       and s.deleted_at is null
  ), false);
$$;

revoke all on function private.student_scope_allows(uuid) from public, anon;
grant execute on function private.student_scope_allows(uuid) to authenticated;

comment on function private.student_scope_allows is
  'AXO-60 fail-closed Student Mode authorization primitive. True only for the one unexpired student selected for this exact signed auth session.';

create or replace function public.student_scope_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_session text := private.current_auth_session_id();
  v_scope private.student_scope_session%rowtype;
begin
  if v_guardian is null or v_session is null then
    return jsonb_build_object(
      'active', false,
      'student_id', null,
      'remaining_seconds', 0,
      'reason', case when v_guardian is null then 'no_guardian' else 'missing_session_id' end
    );
  end if;

  select * into v_scope
    from private.student_scope_session
   where guardian_id = v_guardian
     and auth_session_id = v_session
     and revoked_at is null
     and expires_at > now();

  if not found then
    return jsonb_build_object(
      'active', false,
      'student_id', null,
      'remaining_seconds', 0,
      'reason', 'no_active_scope'
    );
  end if;

  return jsonb_build_object(
    'active', true,
    'student_id', v_scope.student_id,
    'expires_at', v_scope.expires_at,
    'remaining_seconds', greatest(0, floor(extract(epoch from (v_scope.expires_at - now())))::int)
  );
end;
$$;

revoke all on function public.student_scope_state() from public, anon;
grant execute on function public.student_scope_state() to authenticated;

create or replace function public.set_student_scope(
  p_student uuid,
  p_ttl_seconds integer default 1800
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_session text := private.current_auth_session_id();
  v_owned_count integer;
  v_current_student uuid;
  v_expires timestamptz;
begin
  if v_guardian is null then
    raise exception 'no account for this session'
      using errcode = '42501';
  end if;
  if v_session is null then
    raise exception 'this auth session cannot establish Student Mode'
      using errcode = '42501', hint = 'missing_session_id';
  end if;
  if p_student is null then
    raise exception 'student is required'
      using errcode = '22023';
  end if;
  if p_ttl_seconds < 300 or p_ttl_seconds > 3600 then
    raise exception 'student scope lifetime must be between 5 and 60 minutes'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.student s
     where s.id = p_student
       and s.guardian_id = v_guardian
       and s.deleted_at is null
  ) then
    raise exception 'student is unavailable'
      using errcode = '42501';
  end if;

  select count(*) into v_owned_count
    from public.student s
   where s.guardian_id = v_guardian
     and s.deleted_at is null;

  select scope.student_id into v_current_student
    from private.student_scope_session scope
   where scope.guardian_id = v_guardian
     and scope.auth_session_id = v_session
     and scope.revoked_at is null
     and scope.expires_at > now();

  -- A household with more than one possible student needs a parent present for
  -- the first selection and every switch. Refreshing the same live scope is
  -- harmless and does not repeatedly interrupt the daily student session.
  if v_owned_count > 1
     and (v_current_student is null or v_current_student is distinct from p_student)
     and not private.has_fresh_auth() then
    raise exception 'switching profiles needs a parent to confirm it is them'
      using errcode = '42501', hint = 'parent_mode_required';
  end if;

  v_expires := now() + make_interval(secs => p_ttl_seconds);

  insert into private.student_scope_session(
    guardian_id, auth_session_id, student_id, issued_at, expires_at, revoked_at
  ) values (
    v_guardian, v_session, p_student, now(), v_expires, null
  )
  on conflict (guardian_id, auth_session_id)
  do update set
    student_id = excluded.student_id,
    issued_at = excluded.issued_at,
    expires_at = excluded.expires_at,
    revoked_at = null;

  return jsonb_build_object(
    'active', true,
    'student_id', p_student,
    'expires_at', v_expires,
    'remaining_seconds', p_ttl_seconds
  );
end;
$$;

revoke all on function public.set_student_scope(uuid, integer) from public, anon;
grant execute on function public.set_student_scope(uuid, integer) to authenticated;

comment on function public.set_student_scope is
  'AXO-60. Establishes the one active student for this signed auth session. Multi-profile first selection/switch requires fresh Parent Mode; ownership is server-verified.';

create or replace function public.clear_student_scope()
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_session text := private.current_auth_session_id();
  v_count integer;
begin
  if v_guardian is null or v_session is null then
    return false;
  end if;

  update private.student_scope_session
     set revoked_at = coalesce(revoked_at, now())
   where guardian_id = v_guardian
     and auth_session_id = v_session
     and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.clear_student_scope() from public, anon;
grant execute on function public.clear_student_scope() to authenticated;

comment on function public.clear_student_scope is
  'AXO-60. Revokes Student Mode for the current auth session, used before sign-out and on explicit scope reset.';
