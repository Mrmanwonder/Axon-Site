-- ============================================================================
-- 0011 · Entitlements and billing
-- ============================================================================
-- UX_AND_MONETIZATION_THESIS.md Part 2: free = full value on each paper,
-- individually; Pro = value that only exists because we're looking across many
-- papers, over time, across subjects. That line is drawn here, once, in the
-- database, so no feature has to re-derive it and no modified client can move
-- it.
--
-- Two rules this migration exists to make true:
--
--   1. Nothing that answers "what did I get wrong on this paper and why" is
--      ever gated. There is no `tier`/`pro` check anywhere near
--      student_attempt, mark_loss_event or canonical_question WRITE paths, and
--      the only READ gate this file adds to that data is time-windowed (a
--      rolling archive), never per-paper.
--   2. Every Pro-only read is gated server-side, in RLS, not just hidden by the
--      client. A modified client asking straight for cross-subject patterns or
--      the full archive gets nothing back from Postgres itself.
-- ============================================================================

-- ── subscription state on the account holder ────────────────────────────────
-- Lives on guardian, not a separate parent_accounts table: guardian already IS
-- the account holder and payer (see 0001), and splitting billing state onto a
-- second one-to-one table would just be a join everything else has to redo.

create type public.subscription_status as enum ('free', 'pro', 'pro_annual', 'past_due', 'canceled');
create type public.subscription_plan   as enum ('monthly', 'annual');

comment on type public.subscription_status is
  'free/canceled/past_due-expired all resolve to the free tier. pro and pro_annual are the two paid plans; past_due is pro that has not paid, held at full access until subscription_grace_until per the 7-day grace period in the thesis.';

alter table public.guardian
  add column subscription_status     public.subscription_status not null default 'free',
  add column subscription_plan       public.subscription_plan,
  add column subscription_renews_at  timestamptz,
  add column subscription_grace_until timestamptz,
  add column stripe_customer_id      text unique,
  add column stripe_subscription_id  text unique;

comment on column public.guardian.subscription_grace_until is
  'Set when a payment first fails (invoice.payment_failed). Entitlements stay at pro until this passes, giving the calm 7-day grace period the thesis specifies before anything downgrades.';

create index guardian_stripe_customer_idx on public.guardian (stripe_customer_id) where stripe_customer_id is not null;

-- ── stripe event ledger ──────────────────────────────────────────────────────
-- Idempotency for the webhook: Stripe retries on anything but a 2xx, and two
-- deliveries of the same event must not double-apply. Written only by the
-- webhook function, which is the one legitimate service_role writer in this
-- product (Stripe carries no user JWT to run as). RLS with no policies at all
-- means authenticated and anon reach it through neither PostgREST nor a client
-- bug; only service_role, which bypasses RLS by design, can touch it.

create table public.stripe_event (
  id           text        primary key,   -- Stripe event id, e.g. evt_...
  type         text        not null,
  received_at  timestamptz not null default now()
);

alter table public.stripe_event enable row level security;
comment on table public.stripe_event is
  'Webhook idempotency ledger. No RLS policy is intentional: nothing but the service-role webhook handler should ever touch this table.';

-- ── entitlements: the one place gating logic lives ──────────────────────────

create or replace function private.guardian_is_pro(p_guardian uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select g.subscription_status in ('pro', 'pro_annual')
       or (g.subscription_status = 'past_due'
           and g.subscription_grace_until is not null
           and now() < g.subscription_grace_until)
     from public.guardian g where g.id = p_guardian),
    false);
$$;

comment on function private.guardian_is_pro is
  'The single yes/no this whole gating layer reduces to. past_due counts as pro until the grace deadline, so a card failure never downgrades a family mid-grace-period.';

grant execute on function private.guardian_is_pro(uuid) to authenticated;

-- Rolling free-tier archive window: current term stays in full depth for free;
-- older papers keep their date and count in the library (never hidden) but lose
-- per-question depth unless the account is Pro. ~150 days approximates one CBSE
-- term. INFERRED constant — the thesis names the shape ("current term") but not
-- a day count; revisit once real term-boundary data exists.

create or replace function private.in_free_archive_window(p_date date)
returns boolean language sql immutable as $$
  select p_date >= (current_date - interval '150 days');
$$;

comment on function private.in_free_archive_window is
  'INFERRED 150-day rolling window standing in for "current academic term" per the thesis, pending real term-boundary data.';

grant execute on function private.in_free_archive_window(date) to authenticated;

-- The typed entitlements object every feature reads instead of re-deriving the
-- free/Pro line. No arguments and no RPC surface for arbitrary ids: like
-- delete_my_account(), it always resolves from the caller's own session.

create type public.entitlements as (
  tier                      text,
  cross_subject_patterns    boolean,
  full_historical_archive   boolean,
  parent_progress_reports   boolean,
  priority_processing       boolean,
  max_student_profiles      integer   -- null = unlimited
);

create or replace function public.get_entitlements()
returns public.entitlements
language sql stable security definer set search_path = public, pg_temp as $$
  with pro as (select private.guardian_is_pro(private.current_guardian_id()) as is_pro)
  select (
    case when pro.is_pro then 'pro' else 'free' end,
    pro.is_pro,
    pro.is_pro,
    pro.is_pro,
    pro.is_pro,
    case when pro.is_pro then null else 1 end
  )::public.entitlements
  from pro;
$$;

comment on function public.get_entitlements is
  'The one function every Pro-gated feature (client and server alike) calls. Resolves from auth.uid() via current_guardian_id() — nothing to pass, nothing to spoof.';

revoke all on function public.get_entitlements() from public, anon;
grant execute on function public.get_entitlements() to authenticated;

-- ── max_student_profiles, enforced where students are actually created ──────

create or replace function private.enforce_student_profile_limit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
  v_free_limit constant integer := 1;
begin
  -- Computed straight from new.guardian_id, not the caller's session: this
  -- must hold for any writer (including a future admin/service path), not
  -- only one authenticated as the guardian in question.
  if private.guardian_is_pro(new.guardian_id) then
    return new;
  end if;
  select count(*) into v_count from public.student where guardian_id = new.guardian_id;
  if v_count >= v_free_limit then
    raise exception 'Free includes % student profile(s). Pro adds more at no extra cost per child.', v_free_limit
      using errcode = 'P0001', hint = 'This is a parent-account limit, surfaced only in the parent''s own account area.';
  end if;
  return new;
end;
$$;

create trigger student_profile_limit before insert on public.student
  for each row execute function private.enforce_student_profile_limit();

comment on trigger student_profile_limit on public.student is
  'This only ever fires from the parent-driven "add a student" flow in onboarding/account settings, never inside the student''s own capture->understand->act loop — the paywall-never-mid-session rule stays intact.';

-- ── priority_processing: an entitlement snapshot, not a live check ──────────
-- Snapshotted at run creation so a mid-run downgrade can't reorder a queue a
-- student is already waiting on.

alter table public.extraction_run
  add column priority smallint not null default 0;

comment on column public.extraction_run.priority is
  'Snapshot of Pro priority_processing at run creation. Higher sorts first in any future queue; free and Pro papers alike still always get a full, unlimited scan.';

create or replace function private.snapshot_run_priority()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_guardian uuid;
begin
  select s.guardian_id into v_guardian from public.student s where s.id = new.student_id;
  new.priority := case when private.guardian_is_pro(v_guardian) then 10 else 0 end;
  return new;
end;
$$;

create trigger extraction_run_priority before insert on public.extraction_run
  for each row execute function private.snapshot_run_priority();

-- ── full_historical_archive: depth gate on OLD papers only ──────────────────
-- Restrictive policies only affect the command they name and only combine by
-- AND with the existing permissive "own data" policies, so insert/update from
-- the scanning pipeline are untouched — this is a SELECT-only ceiling, and it
-- never applies to a paper inside the current window regardless of tier.

create policy attempt_archive_depth_gate on public.student_attempt as restrictive for select to authenticated
  using (
    private.guardian_is_pro((select s.guardian_id from public.student s where s.id = student_attempt.student_id))
    or exists (select 1 from public.paper p
               where p.id = student_attempt.paper_id and private.in_free_archive_window(p.date_taken))
  );

create policy loss_archive_depth_gate on public.mark_loss_event as restrictive for select to authenticated
  using (
    private.guardian_is_pro((select s.guardian_id from public.student s where s.id = mark_loss_event.student_id))
    or exists (
      select 1 from public.student_attempt a join public.paper p on p.id = a.paper_id
      where a.id = mark_loss_event.attempt_id and private.in_free_archive_window(p.date_taken))
  );

comment on policy attempt_archive_depth_gate on public.student_attempt is
  'full_historical_archive gate. paper rows themselves (date, subject, type) are never restricted -- library always shows the complete, bounded list of papers; only per-question depth on OLD papers requires Pro.';

-- ── cross_subject_patterns: real signal, gated read ──────────────────────────
-- Populated by the patterns edge function after every extraction commit,
-- regardless of tier -- the detector always runs and always tells the truth.
-- What differs by tier is which rows a guardian can SELECT.

create table public.pattern_insight (
  id             uuid              primary key default gen_random_uuid(),
  student_id     uuid              not null references public.student (id) on delete cascade,
  scope          text              not null check (scope in ('single_subject', 'cross_subject')),
  cause          public.loss_cause not null,
  subjects       text[]            not null check (array_length(subjects, 1) >= 1),
  paper_ids      uuid[]            not null check (array_length(paper_ids, 1) >= 2),
  question_count smallint          not null check (question_count >= 2),
  summary_text   text              not null check (length(btrim(summary_text)) > 0),
  detected_at    timestamptz       not null default now(),
  dismissed_at   timestamptz,
  created_at     timestamptz       not null default now(),

  constraint cross_subject_has_multiple_subjects check (
    scope = 'single_subject' or array_length(subjects, 1) >= 2
  ),
  constraint single_subject_has_one_subject check (
    scope = 'cross_subject' or array_length(subjects, 1) = 1
  ),
  unique (student_id, scope, cause, subjects)
);

comment on table public.pattern_insight is
  'A genuine repeated cause across >=2 papers (thesis 2.4: N>=2, same cause). single_subject rows are the free, student-facing insight -- identical experience regardless of tier. cross_subject rows are the Pro-only wider lens, gated below.';
comment on column public.pattern_insight.summary_text is
  'Translator tone, pattern-neutral: what the marking shows, never a second-person blame construction. The model never writes cause or marks here -- this table restates confirmed mark_loss_analytics, it does not judge.';

create index pattern_insight_student_idx on public.pattern_insight (student_id, scope);

alter table public.pattern_insight enable row level security;

create policy pattern_insight_select_single_subject on public.pattern_insight for select to authenticated
  using (
    scope = 'single_subject'
    and exists (select 1 from public.student s
                where s.id = pattern_insight.student_id and s.guardian_id = private.current_guardian_id())
  );

create policy pattern_insight_select_cross_subject on public.pattern_insight for select to authenticated
  using (
    scope = 'cross_subject'
    and exists (select 1 from public.student s
                where s.id = pattern_insight.student_id and s.guardian_id = private.current_guardian_id())
    and private.guardian_is_pro(private.current_guardian_id())
  );

comment on policy pattern_insight_select_cross_subject on public.pattern_insight is
  'The server-side half of the paywall: a free guardian querying pattern_insight for scope=cross_subject gets zero rows back from Postgres itself, not just a hidden UI element.';

-- No insert/update/delete policy for authenticated: only the patterns edge
-- function (running as the caller''s own JWT, same as every other pipeline
-- stage -- see AGENTS.md) writes here, via student_attempt/mark_loss_event
-- access it already has through the existing "own data" policies plus an
-- explicit insert policy scoped the same way.

create policy pattern_insight_insert_own on public.pattern_insight for insert to authenticated
  with check (
    exists (select 1 from public.student s
            where s.id = pattern_insight.student_id and s.guardian_id = private.current_guardian_id())
  );

create policy pattern_insight_update_own on public.pattern_insight for update to authenticated
  using (exists (select 1 from public.student s
                 where s.id = pattern_insight.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s
                 where s.id = pattern_insight.student_id and s.guardian_id = private.current_guardian_id()));

-- ── the parent-facing teaser: existence only, never the paid specifics ──────
-- Powers "Pro shows whether this pattern shows up in her other subjects too."
-- Exposes that a genuine cross-subject match exists for a cause the student
-- already sees explained for free (via the single_subject row) -- but not
-- which other subject, which papers, or the cross-subject summary itself.
-- That is what the free guardian is allowed to know before paying: a true fact
-- about their own child's marking, never the wider content it is gating.

-- Deliberately a SECURITY DEFINER function, not a security_invoker view: a
-- plain view over pattern_insight would inherit pattern_insight's own RLS,
-- including the Pro-only cross_subject policy, and a free guardian would see
-- nothing here either -- exactly the speculative-teaser failure the thesis
-- rules out. This function checks ownership itself, explicitly leaves the tier
-- check out, and returns only existence -- not subjects, paper_ids or
-- summary_text, which stay Pro-only on the base table.

create or replace function public.get_cross_subject_signal()
returns table (student_id uuid, cause public.loss_cause, detected_at timestamptz, dismissed_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select pi.student_id, pi.cause, pi.detected_at, pi.dismissed_at
  from public.pattern_insight pi
  join public.student s on s.id = pi.student_id
  where pi.scope = 'cross_subject' and s.guardian_id = private.current_guardian_id();
$$;

comment on function public.get_cross_subject_signal is
  'Existence-only, readable regardless of tier so "Pro shows whether this pattern shows up in her other subjects too" is never shown speculatively -- it is only ever printed when this returns a row. subjects/paper_ids/summary_text stay behind pattern_insight''s Pro-only RLS.';

revoke all on function public.get_cross_subject_signal() from public, anon;
grant execute on function public.get_cross_subject_signal() to authenticated;

-- ── parent_progress_reports: Pro-only, service-generated ────────────────────

create table public.parent_progress_report (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.student (id) on delete cascade,
  period_start date        not null,
  period_end   date        not null check (period_end >= period_start),
  summary_text text        not null check (length(btrim(summary_text)) > 0),
  generated_at timestamptz not null default now(),

  unique (student_id, period_start, period_end)
);

comment on table public.parent_progress_report is
  'Periodic, shareable summary a parent can read without opening the app (thesis 2.2). Written only by the report-generation edge function; read-only to authenticated, and only when Pro.';

alter table public.parent_progress_report enable row level security;

create policy report_select_own_pro on public.parent_progress_report for select to authenticated
  using (
    exists (select 1 from public.student s
            where s.id = parent_progress_report.student_id and s.guardian_id = private.current_guardian_id())
    and private.guardian_is_pro(private.current_guardian_id())
  );

-- No write policy for authenticated -- same shared-reference-data shape as
-- canonical_question: absence of a policy is what makes it service-role-only.
