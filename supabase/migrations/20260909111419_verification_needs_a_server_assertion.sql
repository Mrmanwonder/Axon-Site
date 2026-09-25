-- ============================================================================
-- Verification needs a server assertion, and consent always needs a parent
-- ============================================================================
-- Re-audit P0-A and P0-C. Both are defects in the migration that shipped this
-- morning (20260909120000 / 20260909140000), and both are the same mistake in
-- two places: a rule enforced in one layer and trusted in the adjacent one.
--
-- ── P0-A: the RPC moved the forge path, it did not close it ───────────────
--
-- 20260909120000 correctly stopped the browser writing verification columns
-- directly, then granted the replacement to `authenticated`:
--
--     grant execute on function
--       public.record_guardian_verification(text, text) to authenticated;
--
-- and validated the method as `p_method <> 'stub'`. The enum holds exactly
-- two values, so `digilocker` passes by construction. Any signed-in browser
-- could therefore run
--
--     select public.record_guardian_verification('digilocker', 'anything');
--
-- and be verified. Confirmed against production before writing this.
--
-- "Server-authored" is not "server-validated". The timestamp was ours; the
-- fact being attested was still the caller's. A SECURITY DEFINER function
-- creates no trust when its input is an unauthenticated assertion.
--
-- So the two-argument function is no longer reachable by `authenticated` at
-- all, and the way in becomes a single-use assertion that only the service
-- role can create. A browser may ASK to be verified; it may not ATTEST that
-- it was.
--
-- ── P0-C: "no prior row" is not proof of onboarding ───────────────────────
--
-- 20260909140000 let a consent decision skip Parent Mode when no earlier row
-- existed for that purpose, reasoning that a first decision is onboarding.
-- That equivalence is not durable. A purpose added next year, a second child,
-- or an account migrated without a row all create a fresh "first" decision
-- that a student holding the guardian session can make alone.
--
-- The exemption is removed outright rather than replaced with an onboarding
-- lease, because it turns out not to be needed: onboarding records consent
-- immediately after an OTP or OAuth sign-in, so `amr` is seconds old and the
-- ordinary freshness check already passes. The case the exemption was written
-- for — a parent who paused halfway and came back much later — is one where
-- asking them to confirm is correct, not an inconvenience to design around.
-- ============================================================================

-- ── the assertion ──────────────────────────────────────────────────────────

create table if not exists private.guardian_verification_assertion (
  id                    uuid primary key default gen_random_uuid(),
  auth_user_id          uuid not null references auth.users (id) on delete cascade,
  provider              text not null,
  provider_reference    text not null,
  identity_verified     boolean not null,
  adulthood_verified    boolean not null,
  relationship_verified boolean not null,
  expires_at            timestamptz not null,
  consumed_at           timestamptz,
  created_at            timestamptz not null default now(),

  -- One assertion per provider reference. A replayed provider callback
  -- conflicts here rather than minting a second chance to verify.
  constraint guardian_verification_assertion_reference_unique
    unique (provider, provider_reference)
);

alter table private.guardian_verification_assertion enable row level security;

comment on table private.guardian_verification_assertion is
  'What a verification provider actually attested, written only by a service-role callback that has checked the provider signature. In the private schema with no policy, so no authenticated session can read or write it. This table is the reason a browser cannot verify itself: it can consume an assertion, never create one.';

create index if not exists guardian_verification_assertion_open_idx
  on private.guardian_verification_assertion (auth_user_id)
  where consumed_at is null;

-- ── consuming one ──────────────────────────────────────────────────────────

create or replace function public.claim_guardian_verification()
returns public.guardian
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_auth      uuid := (select auth.uid());
  v_assertion private.guardian_verification_assertion;
  v_row       public.guardian;
begin
  if v_auth is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Scoped to the caller's own auth user, so naming someone else's assertion
  -- id finds nothing. Locked and re-checked so two concurrent calls cannot
  -- both consume the same row.
  select a.* into v_assertion
    from private.guardian_verification_assertion a
   where a.auth_user_id = v_auth
     and a.consumed_at is null
     and a.expires_at > now()
     and a.identity_verified
     and a.adulthood_verified
     and a.relationship_verified
   order by a.created_at desc
   limit 1
     for update skip locked;

  if v_assertion.id is null then
    raise exception 'no verification has been completed for this account'
      using errcode = '42501', hint = 'verification_not_completed';
  end if;

  update private.guardian_verification_assertion
     set consumed_at = now()
   where id = v_assertion.id;

  update public.guardian g
     set verified_at         = now(),
         verification_method = v_assertion.provider::public.verify_method,
         verification_ref    = v_assertion.provider_reference,
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

revoke all on function public.claim_guardian_verification() from public, anon;
grant execute on function public.claim_guardian_verification() to authenticated;

comment on function public.claim_guardian_verification is
  'Turns a completed provider assertion into a verified guardian. Safe to expose to authenticated because it creates nothing: with no assertion written by the service role it can only raise. Single-use and expiring, so a replay verifies nobody twice.';

-- ── close the forgeable route ─────────────────────────────────────────────
--
-- Kept rather than dropped: a server-side provider callback running as the
-- service role is exactly what should call it. What changes is who can.

revoke all on function public.record_guardian_verification(text, text)
  from public, anon, authenticated;
grant execute on function public.record_guardian_verification(text, text) to service_role;

comment on function public.record_guardian_verification is
  'Service role only. Writes a verification from a method and reference the CALLER supplies, which is safe only where the caller has already validated a provider response. An authenticated browser is not such a caller — it reaches verification through claim_guardian_verification(), which requires an assertion it cannot create.';

-- ── retract the attestations that assert nothing ──────────────────────────
--
-- Every verified guardian in production was verified by the development stub:
-- nine rows, all method 'stub', all with a 'stub:' reference minted in the
-- browser. The column says a legal check established identity, adulthood and
-- the parent-child relationship. No such check happened for any of them.
--
-- Retained as a compliance record, they are false evidence, and false evidence
-- is worse than an admitted gap — the whole reason the stub screen was removed.
-- Nothing gates on verified_at today, so clearing it changes no behaviour; it
-- makes the column honest, and makes the size of the real gap visible instead
-- of hiding it behind nine rows that look like compliance.
--
-- All three columns go together, because guardian_verification_complete
-- requires them to be all-null or all-set.

update public.guardian
   set verified_at         = null,
       verification_method = null,
       verification_ref    = null,
       updated_at          = now()
 where verification_method = 'stub';

-- ── consent always needs a parent ─────────────────────────────────────────

drop policy if exists consent_event_insert_own on public.consent_event;

create policy consent_event_insert_own on public.consent_event for insert to authenticated
  with check (
    guardian_id = private.current_guardian_id()
    and (student_id is null or exists (
      select 1 from public.student s
       where s.id = consent_event.student_id
         and s.guardian_id = private.current_guardian_id()))
    and private.has_fresh_auth()
  );

comment on policy consent_event_insert_own on public.consent_event is
  'Ownership, plus a guardian who re-authenticated recently — for every consent decision, including the first. The earlier "no prior row means onboarding" exemption is gone: a purpose added later, a second student, or a migrated account each manufacture a new first decision that a student holding the guardian session could otherwise make alone.';
