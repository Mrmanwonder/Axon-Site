-- ============================================================================
-- 0003 · Row Level Security — every table, no exceptions
-- ============================================================================
-- Threat model: the anon key ships inside the client and must be assumed
-- public. Therefore `anon` gets no policy on any table holding personal data,
-- and every policy below is scoped to `authenticated` and resolved through
-- auth.uid().
--
-- Because the student is not an auth principal in v1, "the student profile reads
-- its own papers only" is enforced as: the row's student must belong to the
-- guardian who owns the current session. A guardian therefore cannot reach
-- another guardian's student, and no session can reach a student it does not own.
--
-- auth.uid() is wrapped as (select auth.uid()) throughout so the planner
-- evaluates it once per statement rather than once per row.
-- ============================================================================

-- ── helper: the guardian owning the current session ────────────────────────
-- SECURITY DEFINER so policies on other tables can resolve ownership without
-- recursively triggering guardian's own RLS.

create or replace function public.current_guardian_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select g.id from public.guardian g where g.auth_user_id = (select auth.uid());
$$;

comment on function public.current_guardian_id is
  'The guardian row owning the current session, or NULL when unauthenticated.';

revoke all on function public.current_guardian_id() from public, anon;
grant execute on function public.current_guardian_id() to authenticated;

revoke all on function public.consent_is_granted(uuid, uuid, text) from public, anon;
grant execute on function public.consent_is_granted(uuid, uuid, text) to authenticated;

revoke all on function public.all_required_consents_granted(uuid, uuid) from public, anon;
grant execute on function public.all_required_consents_granted(uuid, uuid) to authenticated;

-- ── guardian: own row only ─────────────────────────────────────────────────

alter table public.guardian enable row level security;

-- Compared against auth_user_id directly rather than via current_guardian_id(),
-- which would be circular on this table.
create policy guardian_select_own on public.guardian
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy guardian_insert_own on public.guardian
  for insert to authenticated
  with check (auth_user_id = (select auth.uid()));

create policy guardian_update_own on public.guardian
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- No delete policy: account deletion runs through an audited server-side path,
-- not a client DELETE, because consent_event references guardian ON DELETE
-- RESTRICT and erasure has a defined retention procedure.

-- ── student: only the owning guardian's students ───────────────────────────

alter table public.student enable row level security;

create policy student_select_own on public.student
  for select to authenticated
  using (guardian_id = public.current_guardian_id());

create policy student_insert_own on public.student
  for insert to authenticated
  with check (guardian_id = public.current_guardian_id());

create policy student_update_own on public.student
  for update to authenticated
  using (guardian_id = public.current_guardian_id())
  with check (guardian_id = public.current_guardian_id());

create policy student_delete_own on public.student
  for delete to authenticated
  using (guardian_id = public.current_guardian_id());

-- ── consent_event: readable and appendable by its guardian, never mutable ──

alter table public.consent_event enable row level security;

create policy consent_event_select_own on public.consent_event
  for select to authenticated
  using (guardian_id = public.current_guardian_id());

-- A guardian may only record consent in their own name, and only about a
-- student they own (or with no student, during onboarding step 4).
create policy consent_event_insert_own on public.consent_event
  for insert to authenticated
  with check (
    guardian_id = public.current_guardian_id()
    and (
      student_id is null
      or exists (
        select 1 from public.student s
        where s.id = consent_event.student_id
          and s.guardian_id = public.current_guardian_id()
      )
    )
  );

-- Deliberately no UPDATE and no DELETE policy. Combined with the triggers in
-- 0001, the ledger is immutable to clients, to the service role, and to the
-- table owner alike.

-- ── student content: reachable only through an owned student ───────────────

alter table public.paper enable row level security;

create policy paper_all_own on public.paper
  for all to authenticated
  using (exists (
    select 1 from public.student s
    where s.id = paper.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (
    select 1 from public.student s
    where s.id = paper.student_id and s.guardian_id = public.current_guardian_id()));

alter table public.attempt enable row level security;

create policy attempt_all_own on public.attempt
  for all to authenticated
  using (exists (
    select 1 from public.student s
    where s.id = attempt.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (
    select 1 from public.student s
    where s.id = attempt.student_id and s.guardian_id = public.current_guardian_id()));

alter table public.loss_event enable row level security;

create policy loss_event_all_own on public.loss_event
  for all to authenticated
  using (exists (
    select 1 from public.student s
    where s.id = loss_event.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (
    select 1 from public.student s
    where s.id = loss_event.student_id and s.guardian_id = public.current_guardian_id()));

-- ── canonical_question: read-only to authenticated, service-role writes ────

alter table public.canonical_question enable row level security;

create policy canonical_question_read_all on public.canonical_question
  for select to authenticated
  using (true);

-- No insert/update/delete policy. service_role bypasses RLS, so that absence is
-- precisely what makes writes service-role-only.

-- ── consent_purpose: read-only catalogue ───────────────────────────────────

alter table public.consent_purpose enable row level security;

create policy consent_purpose_read_all on public.consent_purpose
  for select to authenticated
  using (true);

-- ── current consent state ──────────────────────────────────────────────────
-- security_invoker so the view is filtered by the caller's RLS on
-- consent_event rather than the view owner's privileges. Without this a view
-- silently becomes a hole straight through RLS.

create view public.consent_current
  with (security_invoker = true)
as
select distinct on (guardian_id, student_id, purpose)
  guardian_id, student_id, purpose, granted, notice_version, method, seq, created_at
from public.consent_event
order by guardian_id, student_id, purpose, seq desc;

comment on view public.consent_current is
  'Latest consent decision per (guardian, student, purpose). Read authoritatively — consent state must never be cached optimistically.';

grant select on public.consent_current to authenticated;
