-- ============================================================================
-- 0003 · RLS on every table, and the analytics boundary
-- ============================================================================
-- The anon key ships inside the client and must be assumed public, so `anon` gets
-- no policy on anything holding personal data. Every policy is scoped to
-- `authenticated` and resolved through auth.uid().
--
-- The student is not an auth principal, so "a student reads its own papers only"
-- is enforced as: the row's student must belong to the guardian owning the
-- current session.
-- ============================================================================

create or replace function public.current_guardian_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select g.id from public.guardian g where g.auth_user_id = (select auth.uid());
$$;

revoke all on function public.current_guardian_id() from public, anon;
grant execute on function public.current_guardian_id() to authenticated;
revoke all on function public.consent_is_granted(uuid, uuid, text) from public, anon;
grant execute on function public.consent_is_granted(uuid, uuid, text) to authenticated;
revoke all on function public.all_required_consents_granted(uuid, uuid) from public, anon;
grant execute on function public.all_required_consents_granted(uuid, uuid) to authenticated;

-- ── guardian ───────────────────────────────────────────────────────────────
alter table public.guardian enable row level security;

create policy guardian_select_own on public.guardian for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy guardian_insert_own on public.guardian for insert to authenticated
  with check (auth_user_id = (select auth.uid()));
create policy guardian_update_own on public.guardian for update to authenticated
  using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
-- No delete policy: erasure runs through an audited server path, because
-- consent_event references guardian ON DELETE RESTRICT by design.

-- ── student and subjects ───────────────────────────────────────────────────
alter table public.student enable row level security;

create policy student_select_own on public.student for select to authenticated
  using (guardian_id = public.current_guardian_id());
create policy student_insert_own on public.student for insert to authenticated
  with check (guardian_id = public.current_guardian_id());
create policy student_update_own on public.student for update to authenticated
  using (guardian_id = public.current_guardian_id()) with check (guardian_id = public.current_guardian_id());
create policy student_delete_own on public.student for delete to authenticated
  using (guardian_id = public.current_guardian_id());

alter table public.student_subject enable row level security;
create policy student_subject_all_own on public.student_subject for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = student_subject.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = student_subject.student_id and s.guardian_id = public.current_guardian_id()));

-- ── consent_event: readable and appendable, never mutable ──────────────────
alter table public.consent_event enable row level security;

create policy consent_event_select_own on public.consent_event for select to authenticated
  using (guardian_id = public.current_guardian_id());
create policy consent_event_insert_own on public.consent_event for insert to authenticated
  with check (
    guardian_id = public.current_guardian_id()
    and (student_id is null or exists (
      select 1 from public.student s
      where s.id = consent_event.student_id and s.guardian_id = public.current_guardian_id())));
-- No UPDATE or DELETE policy. With the triggers in 0001 the ledger is immutable
-- to clients, to the service role, and to the table owner alike.

-- ── student content ────────────────────────────────────────────────────────
-- All single-hop on student_id, so each policy is cheap and obviously correct.

alter table public.paper enable row level security;
create policy paper_all_own on public.paper for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = paper.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = paper.student_id and s.guardian_id = public.current_guardian_id()));

alter table public.student_attempt enable row level security;
create policy attempt_all_own on public.student_attempt for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = student_attempt.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = student_attempt.student_id and s.guardian_id = public.current_guardian_id()));

alter table public.mark_loss_event enable row level security;
create policy loss_all_own on public.mark_loss_event for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = mark_loss_event.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = mark_loss_event.student_id and s.guardian_id = public.current_guardian_id()));

alter table public.page_unreadable enable row level security;
create policy page_unreadable_all_own on public.page_unreadable for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = page_unreadable.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = page_unreadable.student_id and s.guardian_id = public.current_guardian_id()));

alter table public.attempt_concept enable row level security;
create policy attempt_concept_all_own on public.attempt_concept for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = attempt_concept.student_id and s.guardian_id = public.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = attempt_concept.student_id and s.guardian_id = public.current_guardian_id()));

-- ── shared reference data: read-only to authenticated ──────────────────────
-- No write policy anywhere below. service_role bypasses RLS, so that absence is
-- exactly what makes these service-role-only.

alter table public.canonical_question enable row level security;
create policy canonical_question_read on public.canonical_question for select to authenticated using (true);

alter table public.canonical_question_concept enable row level security;
create policy cqc_read on public.canonical_question_concept for select to authenticated using (true);

alter table public.chapter enable row level security;
create policy chapter_read on public.chapter for select to authenticated using (true);

alter table public.concept enable row level security;
create policy concept_read on public.concept for select to authenticated using (true);

alter table public.consent_purpose enable row level security;
create policy consent_purpose_read on public.consent_purpose for select to authenticated using (true);

-- ══════════════════════════════════════════════════════════════════════════
-- Hard rule 3 · unsure data never reaches analytics
-- ══════════════════════════════════════════════════════════════════════════
-- Making this a boundary in the schema rather than a filter each caller must
-- remember. Aggregation reads these views; nothing aggregates the base tables.
-- security_invoker so the caller's RLS still applies — without it a view is a
-- hole straight through RLS.

create view public.attempt_analytics with (security_invoker = true) as
select a.*
from public.student_attempt a
where a.extraction_confidence <> 'unsure' or a.student_confirmed_at is not null;

comment on view public.attempt_analytics is
  'Attempts eligible for aggregation. An unsure extraction is excluded until the student confirms it, so one bad read cannot compound into a confidently wrong conclusion.';

create view public.mark_loss_analytics with (security_invoker = true) as
select m.*
from public.mark_loss_event m
join public.attempt_analytics a on a.id = m.attempt_id
where (m.confidence <> 'unsure' or m.student_confirmed_at is not null)
  and m.student_rejected_at is null;

comment on view public.mark_loss_analytics is
  'Loss events eligible for aggregation: not unsure-and-unconfirmed, not rejected by the student, and hanging off an attempt that is itself eligible.';

grant select on public.attempt_analytics, public.mark_loss_analytics to authenticated;

-- Sample size, so every headline insight can show it. CLAUDE.md: with fewer than
-- about four papers, say there isn't enough data rather than render noise.
create view public.student_analytics_readiness with (security_invoker = true) as
select
  s.id                                          as student_id,
  count(distinct a.paper_id)                    as papers_counted,
  count(a.id)                                   as questions_counted,
  count(distinct a.paper_id) >= 4               as has_enough_data
from public.student s
left join public.attempt_analytics a on a.student_id = s.id
group by s.id;

comment on view public.student_analytics_readiness is
  'Sample size behind any headline insight, and whether there is enough to show one at all.';

grant select on public.student_analytics_readiness to authenticated;
