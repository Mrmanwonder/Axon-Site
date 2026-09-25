-- ============================================================================
-- Security remediation: remove the stale production consent INSERT policy
-- ============================================================================
--
-- Finding AUTHZ-001 (2026-09-15): production still has an older permissive
-- policy named "Guardians can append their own consent events" in addition to
-- `consent_event_insert_own`. PostgreSQL ORs permissive policies for the same
-- command. The stale policy has no `private.has_fresh_auth()` requirement, so
-- it defeats Parent Mode for consent grants/withdrawals on a shared device.
--
-- It also contains the historical typo `s.guardian_id = s.guardian_id`, which
-- allows an owned guardian id to be paired with another student's id. That does
-- not currently change that other student's effective consent because the
-- consent evaluator also keys by guardian id, but it can create cross-account
-- inconsistent audit rows and must not exist.
--
-- Reassert the intended policy instead of only dropping the known stale name.
-- This makes the migration repair production drift and fail closed if another
-- environment has an older definition under the canonical name.
-- ============================================================================

drop policy if exists "Guardians can append their own consent events" on public.consent_event;
drop policy if exists consent_event_insert_own on public.consent_event;

create policy consent_event_insert_own on public.consent_event
  for insert to authenticated
  with check (
    guardian_id = private.current_guardian_id()
    and (
      student_id is null
      or exists (
        select 1
          from public.student s
         where s.id = consent_event.student_id
           and s.guardian_id = private.current_guardian_id()
      )
    )
    and private.has_fresh_auth()
  );

comment on policy consent_event_insert_own on public.consent_event is
  'Only the signed-in guardian may append consent for their own scope/student, and only after recent interactive Parent Mode authentication. This policy must remain the sole authenticated INSERT policy on consent_event.';
