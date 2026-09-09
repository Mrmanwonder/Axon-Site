-- ============================================================================
-- Parent Mode: the guardian's authority is not the student's
-- ============================================================================
-- Remediation P0-002 / INV-02. The account model is deliberate and stays as it
-- is: the guardian is the only auth principal, and the student is a profile
-- under the guardian's session. That is what makes RLS simple and what keeps a
-- child from needing an account of their own.
--
-- It also means the phone in the student's hands holds the parent's authority.
-- The daily user of this app is a teenager, and the same session that scans a
-- physics paper can withdraw consent, remove the parent's passkey, delete every
-- paper, open the billing portal, or delete the account.
--
-- RLS cannot fix that on its own, and it is worth being precise about why: RLS
-- sees a bearer token, the bearer token belongs to the guardian, and no policy
-- can tell whether the device is currently in the guardian's hands. The missing
-- fact is not "who owns this session" — it is "did a parent authorise THIS
-- action, just now".
--
-- ── What proves it ────────────────────────────────────────────────────────
--
-- The `amr` claim: Supabase records each authentication a session has performed
-- as {method, timestamp}. Re-authenticating — an emailed code, a passkey — puts
-- a new entry in it. So "a parent authorised this in the last few minutes" is a
-- claim already in the token, and nothing new needs minting, storing or
-- expiring. The client cannot forge it: the JWT is signed.
--
-- This fails CLOSED. A token with no `amr` is not fresh, and the guarded
-- actions refuse. That is the right direction for a gate, but it does mean the
-- gate depends on a claim Supabase must actually emit — so the failure, if that
-- ever stops being true, is Parent Mode never unlocking. Loud, diagnosable
-- through public.parent_mode_state(), and one function to fix. It is not a
-- failure that silently lets a student through.
--
-- ── What is guarded here, and what cannot be ──────────────────────────────
--
-- Guarded in the database, which is the only place a direct API call is also
-- refused rather than merely hidden:
--
--   · withdrawing or changing consent
--   · deleting papers
--   · deleting a student profile
--   · deleting the account
--
-- NOT guarded here, and honestly so:
--
--   · passkey add/remove lives in Supabase Auth (GoTrue), not in a table this
--     schema owns. There is no policy that can reach it. The UI gates it; a
--     direct GoTrue call from a student's console is not stopped by anything
--     in this migration. Closing that needs an auth-hook or a proxy, and is
--     tracked separately.
--   · full data export is built from ordinary RLS-scoped SELECTs. Gating it
--     server-side means routing it through one export RPC — P1-FE-004 — and
--     doing that here would mean shipping half of it.
--
-- Creating a student profile is deliberately NOT guarded, though the spec lists
-- it beside deletion. Onboarding creates one, sometimes twenty minutes after
-- signing in, and adding a profile to your own account is not a control-plane
-- action — it takes nothing away and reveals nothing. Deleting one does both.
-- ============================================================================

-- ── how long ago did a person prove they were there ───────────────────────

create or replace function private.auth_age()
returns interval
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when v.latest is null then null
    else now() - to_timestamp(v.latest)
  end
  from (
    select max((e->>'timestamp')::bigint) as latest
      from jsonb_array_elements(
             coalesce(nullif((select auth.jwt() -> 'amr'), 'null'::jsonb), '[]'::jsonb)
           ) e
     where (e ? 'timestamp')
  ) v;
$$;

revoke all on function private.auth_age() from public, anon;
grant execute on function private.auth_age() to authenticated;

comment on function private.auth_age is
  'Time since this session last authenticated, from the JWT amr claim. Null when the token carries no amr — which every caller must treat as "not fresh", never as "unknown, allow".';

create or replace function private.has_fresh_auth(p_max interval default interval '15 minutes')
returns boolean
language sql
stable
set search_path = public, private, pg_temp
as $$
  select coalesce(private.auth_age() <= p_max, false);
$$;

revoke all on function private.has_fresh_auth(interval) from public, anon;
grant execute on function private.has_fresh_auth(interval) to authenticated;

comment on function private.has_fresh_auth is
  'True when a person re-authenticated within the window. coalesce(..., false) is load-bearing: a null age means no amr claim, and a gate that reads unknown as permitted is not a gate.';

-- The UI needs to know whether Parent Mode is open and for how much longer,
-- without guessing from a failed write. Returning seconds rather than a
-- timestamp keeps it independent of client clock skew.
create or replace function public.parent_mode_state()
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select jsonb_build_object(
    'fresh',              private.has_fresh_auth(),
    'window_seconds',     900,
    'age_seconds',        case when private.auth_age() is null then null
                               else floor(extract(epoch from private.auth_age()))::int end,
    'remaining_seconds',  case when private.has_fresh_auth()
                               then greatest(0, 900 - floor(extract(epoch from private.auth_age()))::int)
                               else 0 end,
    -- Distinguishes "you have not re-authenticated recently" from "this token
    -- cannot express when you did", which are the same refusal and completely
    -- different bugs.
    'amr_present',        private.auth_age() is not null
  );
$$;

revoke all on function public.parent_mode_state() from public, anon;
grant execute on function public.parent_mode_state() to authenticated;

comment on function public.parent_mode_state is
  'Whether Parent Mode is currently unlocked, and for how much longer. Advisory only — every guarded action re-checks freshness itself, so a client that lies about this reaches nothing.';

-- ── consent: a change needs a parent, the first decision is onboarding ─────
--
-- The distinction is deliberate. "Change guardian consent" is what INV-02
-- forbids a student session; the first consent for a purpose is not a change,
-- it is onboarding, and it happens minutes after a sign-up that may itself have
-- been slow. Gating it would mean a parent who paused halfway through signing
-- up is asked to prove themselves again to finish the sentence they started.
--
-- Everything after that — including turning an optional purpose back on — is a
-- change, and needs a parent present.

drop policy if exists consent_event_insert_own on public.consent_event;

create policy consent_event_insert_own on public.consent_event for insert to authenticated
  with check (
    guardian_id = private.current_guardian_id()
    and (student_id is null or exists (
      select 1 from public.student s
       where s.id = consent_event.student_id
         and s.guardian_id = private.current_guardian_id()))
    and (
      private.has_fresh_auth()
      or not exists (
        select 1 from public.consent_event prior
         where prior.guardian_id = consent_event.guardian_id
           and prior.purpose     = consent_event.purpose
           and prior.student_id is not distinct from consent_event.student_id)
    )
  );

comment on policy consent_event_insert_own on public.consent_event is
  'Ownership as before, plus P0-002: changing an existing consent decision needs a guardian who re-authenticated recently. The first decision for a purpose is onboarding, not a change, and is not gated.';

-- ── deleting papers ───────────────────────────────────────────────────────
--
-- paper_all_own was FOR ALL, so delete could not be treated differently from
-- select. Split so the three harmless verbs keep the policy they had and delete
-- gets the gate. Reading and writing a paper is the daily work of the app;
-- destroying one is not.

drop policy if exists paper_all_own on public.paper;

create policy paper_rw_own on public.paper for select to authenticated
  using (exists (select 1 from public.student s where s.id = paper.student_id and s.guardian_id = private.current_guardian_id()));
create policy paper_insert_own on public.paper for insert to authenticated
  with check (exists (select 1 from public.student s where s.id = paper.student_id and s.guardian_id = private.current_guardian_id()));
create policy paper_update_own on public.paper for update to authenticated
  using (exists (select 1 from public.student s where s.id = paper.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s where s.id = paper.student_id and s.guardian_id = private.current_guardian_id()));
create policy paper_delete_own on public.paper for delete to authenticated
  using (
    exists (select 1 from public.student s where s.id = paper.student_id and s.guardian_id = private.current_guardian_id())
    and private.has_fresh_auth()
  );

comment on policy paper_delete_own on public.paper is
  'P0-002. A student session can scan, read and correct papers all day; removing them is the parent''s. Deletion cascades to attempts, loss events and unreadable pages, so this one policy covers the whole subtree.';

-- ── deleting a student profile ────────────────────────────────────────────

drop policy if exists student_delete_own on public.student;

create policy student_delete_own on public.student for delete to authenticated
  using (guardian_id = private.current_guardian_id() and private.has_fresh_auth());

comment on policy student_delete_own on public.student is
  'P0-002. Removing a profile destroys every paper under it. Creating one is deliberately not gated — see this migration''s header.';

-- ── deleting the account ──────────────────────────────────────────────────
--
-- SECURITY DEFINER, so no policy applies to what it does; the check has to be
-- inside the function. The body below is the live definition unchanged — the
-- tombstone form from 20260810190200, which strips the student rather than
-- deleting it so the append-only consent ledger keeps its referent — with
-- nothing added but the freshness check. Reverting to an older body while
-- adding a gate would quietly reintroduce the erasure bug that migration fixed.

create or replace function public.delete_my_account()
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_auth     uuid := (select auth.uid());
  v_guardian uuid;
  v_students int;
begin
  if v_auth is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  -- P0-002: the most destructive action in the product, and the one most
  -- clearly not a student's to take. A distinct message, because 'not
  -- authenticated' would be both wrong and unactionable — the caller IS
  -- authenticated, just not recently enough.
  if not private.has_fresh_auth() then
    raise exception 'this needs a parent to confirm it is them'
      using errcode = '42501', hint = 'parent_mode_required';
  end if;

  select g.id into v_guardian from public.guardian g where g.auth_user_id = v_auth;
  if v_guardian is null then raise exception 'no account for this session' using errcode = '42501'; end if;

  -- Papers first. Cascades paper_page, student_attempt, mark_loss_event,
  -- page_unreadable and attempt_concept — all of the actual content.
  delete from public.paper
   where student_id in (select id from public.student where guardian_id = v_guardian);

  delete from public.student_subject
   where student_id in (select id from public.student where guardian_id = v_guardian);

  update public.student
     set first_name = '[erased]', deleted_at = now(), updated_at = now()
   where guardian_id = v_guardian and deleted_at is null;
  get diagnostics v_students = row_count;

  delete from public.app_preference where guardian_id = v_guardian;

  update public.guardian
     set name = '[erased]', contact = '[erased]',
         verified_at = null, verification_method = null, verification_ref = null,
         auth_user_id = null, deleted_at = now(), updated_at = now()
   where id = v_guardian;

  -- Releasing the auth row ends access. Last, because auth.uid() is needed above.
  delete from auth.users where id = v_auth;

  return jsonb_build_object(
    'erased', true,
    'students_erased', v_students,
    'guardian_retained_as_tombstone', v_guardian);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account is
  'Erases the signed-in account: papers are deleted, student and guardian rows are kept as tombstones without personal data so the consent ledger keeps its referents, and the auth row is released. Requires a recently re-authenticated guardian (P0-002). Storage objects must be cleared by the caller first via the Storage API.';
