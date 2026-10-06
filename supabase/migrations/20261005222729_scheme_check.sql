-- ══════════════════════════════════════════════════════════════════════════
-- Scheme check for unmarked Cambridge papers (2026-10-06)
-- ══════════════════════════════════════════════════════════════════════════
-- Owner decision (6 Oct 2026, overriding hard rules 1 and 2 for this path only):
-- an UNMARKED Cambridge past paper whose exact code is printed on it may be
-- checked against the published mark scheme for that paper. The student gets
-- feedback and an ESTIMATED mark per question.
--
-- What keeps the other rules intact:
--   * Estimates live only here. Nothing writes question_region.marks_awarded,
--     teacher_mark, mark_loss_event or region_explanation; attempt_analytics and
--     mark_loss_analytics never see an estimate.
--   * An estimate is never 'confirmed' (the constraint below) and is always
--     labelled in the UI as Axon's estimate.
--   * The scheme itself is never stored: scheme_ref holds only the filename
--     (e.g. 9231_w25_ms_11.pdf), never its text.

create table public.paper_check (
  run_id       uuid primary key references public.extraction_run (id) on delete cascade,
  paper_id     uuid not null references public.paper (id) on delete cascade,
  student_id   uuid not null references public.student (id) on delete cascade,
  paper_label  text not null check (paper_label ~ '^\d{4}/\d{2}/(O/N|M/J|F/M)/\d{2}$'),
  scheme_ref   text not null check (scheme_ref ~ '^\d{4}_[msw]\d{2}_ms_\d{2}\.pdf$'),
  status       text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'unavailable')),
  reason       text,
  checked      integer not null default 0 check (checked >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index paper_check_student_idx on public.paper_check (student_id);
create index paper_check_paper_idx on public.paper_check (paper_id);

comment on table public.paper_check is
  'One scheme check of an unmarked Cambridge paper. Holds the scheme filename only, never scheme text. Owner decision 2026-10-06.';

create table public.region_check (
  region_id        uuid primary key references public.question_region (id) on delete cascade,
  run_id           uuid not null references public.paper_check (run_id) on delete cascade,
  student_id       uuid not null references public.student (id) on delete cascade,
  can_check        boolean not null,
  reason           text,
  estimated_marks  numeric(5, 1),
  max_marks        numeric(5, 1),
  -- An estimate is at most 'likely'. Only a teacher or an official scheme
  -- applied by a person makes a mark 'confirmed'.
  confidence       public.confidence not null check (confidence <> 'confirmed'),
  what_was_right   text,
  what_was_missing text[] not null default '{}',
  do_this_next     text,
  model_version    text,
  prompt_version   text not null,
  created_at       timestamptz not null default now(),
  check (not can_check or (estimated_marks is not null and max_marks is not null
         and max_marks > 0 and estimated_marks >= 0 and estimated_marks <= max_marks)),
  check (can_check or (estimated_marks is null and reason is not null))
);
create index region_check_run_idx on public.region_check (run_id);
create index region_check_student_idx on public.region_check (student_id);

comment on table public.region_check is
  'Axon''s estimated mark and feedback for one question on an unmarked paper. Never a teacher mark; never read by analytics.';

-- ── RLS: read under the live student scope; all writes are server-side ────
alter table public.paper_check enable row level security;
alter table public.region_check enable row level security;

create policy paper_check_select_scope on public.paper_check
  for select to authenticated using (private.student_scope_allows(student_id));
create policy region_check_select_scope on public.region_check
  for select to authenticated using (private.student_scope_allows(student_id));

revoke all on public.paper_check, public.region_check from anon, authenticated;
grant select on public.paper_check, public.region_check to authenticated;

-- ── Model route for the new stage ─────────────────────────────────────────
alter table public.model_route drop constraint model_route_stage_check;
alter table public.model_route add constraint model_route_stage_check
  check (stage = any (array['triage', 'structure', 'content', 'adjudicate', 'explain', 'tutor', 'topic_tag', 'scheme_check']));
alter table public.model_call drop constraint model_call_stage_check;
alter table public.model_call add constraint model_call_stage_check
  check (stage = any (array['triage', 'structure', 'content', 'adjudicate', 'explain', 'tutor', 'topic_tag', 'scheme_check']));

-- Quality first: the strongest route at high thinking. Model IDs live here.
insert into public.model_route
  (stage, primary_model, provider, fallbacks, temperature, max_tokens, prompt_version, thinking_level, allow_training, enabled, notes)
values
  ('scheme_check', 'gemini-3.8-flash', 'ai_studio', '{}'::text[], 0, 16384, 'scheme_check.v1', 'high', false, true,
   'Checks one question of an unmarked Cambridge paper against its exact mark scheme. Writes estimates to region_check only.')
on conflict (stage) do nothing;
