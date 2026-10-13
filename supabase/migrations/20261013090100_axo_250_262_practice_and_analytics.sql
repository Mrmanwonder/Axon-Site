-- AXO-244 Phases 1 to 3 (AXO-250 to AXO-262): ranking, the spaced re-attempt
-- scheduler, the practice loop, and v1 analytics. Builds on the error items in
-- 20261013090000_axo_245_249_error_items_and_tagging.sql.
--
-- Every read here starts with private.ensure_error_items, so a student's items
-- are current with their latest confirmed papers before anything is ranked.
-- Every public function checks Student Mode scope first (private.require_scope).
--
-- Copy and display rules (Axon.md §8) are the client's job; this layer returns
-- sourced numbers and counts, never percentages of correctness or a single
-- confident grade.

-- ── the student's day and exam dates ───────────────────────────────────────
create or replace function private.student_today(p_student uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
            (select timezone from public.student_practice_pref where student_id = p_student), 'UTC'))::date;
$$;
revoke all on function private.student_today(uuid) from public, anon, authenticated;

-- The next fixed sitting of any paper the student sits for this syllabus, from
-- the board's own timetable (AXO-207). Null when the plan or timetable is not
-- there; nothing is inferred.
create or replace function private.next_exam_date(p_student uuid, p_syllabus text, p_today date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(es.exam_date)
    from public.student_exam_plan sp
    join public.exam_zone_location z on z.location_key = sp.location_key
    join public.exam_timetable t
      on t.provider_key = 'cambridge' and t.series_key = sp.series_key
     and t.zone = z.zone and t.timetable_variant = z.timetable_variant
    join public.exam_sitting es on es.timetable_id = t.id and es.syllabus_code = p_syllabus
    left join public.student_exam_papers sep
      on sep.student_id = sp.student_id and sep.syllabus_code = p_syllabus
   where sp.student_id = p_student
     and p_syllabus is not null
     and es.exam_date >= p_today
     and (sep.papers is null or es.paper = any (sep.papers));
$$;
revoke all on function private.next_exam_date(uuid, text, date) from public, anon, authenticated;

-- A paper's weight relative to an equal share of its qualification: 1.0 is an
-- average paper, 1.7 a heavy one. Unknown paper or syllabus is 1.0, which
-- ranks it as average rather than inventing a weight.
create or replace function private.component_weight_factor(
  p_provider text, p_syllabus text, p_paper smallint, p_programme text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select c.paper,
           case when p_programme = 'cambridge_as' then coalesce(c.as_weight_pct, c.a_weight_pct)
                else coalesce(c.a_weight_pct, c.as_weight_pct) end as pct,
           case when p_programme = 'cambridge_as' then c.as_weight_pct else c.a_weight_pct end as level_pct
      from public.syllabus_component c
     where c.provider_key = p_provider and c.syllabus_code = p_syllabus
  )
  select coalesce(
    (select w.pct / nullif((select avg(level_pct) from w where level_pct is not null), 0)
       from w where w.paper = p_paper),
    1.0)::numeric;
$$;
revoke all on function private.component_weight_factor(text, text, smallint, text) from public, anon, authenticated;

create or replace function private.component_weight_pct(
  p_provider text, p_syllabus text, p_paper smallint, p_programme text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_programme = 'cambridge_as' then coalesce(c.as_weight_pct, c.a_weight_pct)
              else coalesce(c.a_weight_pct, c.as_weight_pct) end
    from public.syllabus_component c
   where c.provider_key = p_provider and c.syllabus_code = p_syllabus and c.paper = p_paper;
$$;
revoke all on function private.component_weight_pct(text, text, smallint, text) from public, anon, authenticated;

-- Minutes a re-attempt takes: answer from memory, check, remedy. Bounded so a
-- 15-minute session holds 3 to 6 items.
create or replace function private.item_minutes(p_marks numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(6, greatest(2, ceil(1 + coalesce(p_marks, 1) * 0.75)))::int;
$$;

-- ── the scored item set ───────────────────────────────────────────────────
-- One place computes each open item's weight, used by ranking, the due queue
-- and next best action alike.
create or replace function private.scored_items(p_student uuid)
returns table (
  id uuid, subject text, syllabus_code text, paper_number smallint, topic_id uuid,
  command_word text, ao text, mistake_type text, cause public.loss_cause, paper_id uuid,
  marks_lost numeric, marks_available numeric, status text, next_review_at timestamptz,
  recurrence_count integer, exam_date date, exam_days integer, weight_pct numeric,
  minutes integer, weight numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with ctx as (
    select private.student_today(p_student) as today,
           (select cp.key from public.student s left join public.curriculum_programme cp on cp.id = s.programme_id
             where s.id = p_student) as programme_key,
           coalesce((select pr.key from public.student s
                       join public.curriculum_programme cp on cp.id = s.programme_id
                       join public.curriculum_provider pr on pr.id = cp.provider_id
                      where s.id = p_student), 'cambridge') as provider_key
  ),
  items as (
    select e.*, ctx.today, ctx.programme_key, ctx.provider_key,
           private.next_exam_date(p_student, e.syllabus_code, ctx.today) as exam_date
      from public.error_item e cross join ctx
     where e.student_id = p_student and e.withdrawn_at is null
  )
  select i.id, i.subject, i.syllabus_code, i.paper_number, i.topic_id, i.command_word, i.ao,
         i.mistake_type, i.cause, i.paper_id, i.marks_lost, i.marks_available, i.status,
         i.next_review_at, i.recurrence_count, i.exam_date, (i.exam_date - i.today),
         private.component_weight_pct(i.provider_key, i.syllabus_code, i.paper_number, i.programme_key),
         private.item_minutes(i.marks_available),
         -- marks lost × paper weight × recency (half-life 90 days, floor 0.25)
         -- × exam proximity (up to ×2 inside 120 days of the subject's exam).
         i.marks_lost
           * private.component_weight_factor(i.provider_key, i.syllabus_code, i.paper_number, i.programme_key)
           * greatest(0.25, power(0.5, greatest(0, i.today - i.paper_date) / 90.0))
           * case when i.exam_date is not null and i.exam_date - i.today <= 120
                  then 1 + (120 - (i.exam_date - i.today)) / 120.0 else 1 end
    from items i;
$$;
revoke all on function private.scored_items(uuid) from public, anon, authenticated;

-- ── AXO-250: recoverable-marks ranking ─────────────────────────────────────
create or replace function public.focus_areas(p_student uuid, p_subject text default null, p_limit integer default 5)
returns table (
  kind text, key text, label text, subject text, marks_recoverable numeric,
  items_open integer, papers_seen integer, exam_date date, exam_days integer,
  heaviest_paper smallint, heaviest_weight_pct numeric, score numeric, reason text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_types boolean := private.flag('mistake_type_ui');
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);
  return query
  with open_items as (
    -- Fixed items are recovered; they are not something to work on.
    select * from private.scored_items(p_student) s
     where s.status <> 'fixed' and (p_subject is null or s.subject = p_subject)
  ),
  -- A command word is named only once it covers 3 parts that lost marks
  -- (owner, 5 Oct 2026). Counted over every item, recovered ones included.
  named_words as (
    select e.subject, e.command_word
      from public.error_item e
     where e.student_id = p_student and e.withdrawn_at is null and e.command_word is not null
     group by 1, 2 having count(*) >= 3
  ),
  tagged as (
    select 'topic'::text as kind, o.topic_id::text as key, o.* from open_items o where o.topic_id is not null
    union all
    select 'command_word', o.command_word, o.* from open_items o
      join named_words n on n.subject is not distinct from o.subject and n.command_word = o.command_word
    union all
    select 'mistake_type', o.mistake_type, o.* from open_items o where v_types and o.mistake_type is not null
    union all
    select 'subject', coalesce(o.subject, ''), o.* from open_items o
  ),
  areas as (
    select t.kind, t.key, t.subject,
           sum(t.marks_lost) as marks, count(*)::int as n, count(distinct t.paper_id)::int as papers,
           min(t.exam_date) as exam_date, min(t.exam_days) as exam_days,
           (array_agg(t.paper_number order by t.weight_pct desc nulls last))[1] as heaviest_paper,
           max(t.weight_pct) as heaviest_weight,
           sum(t.weight)
             -- Recurring across papers is worth more than one bad paper.
             * (1 + 0.5 * (count(distinct t.paper_id) - 1))
             as score
      from tagged t
     group by t.kind, t.key, t.subject
  )
  select a.kind, a.key,
         case a.kind
           when 'topic' then (select coalesce(st.code || ' ', '') || st.title from public.syllabus_topic st where st.id = a.key::uuid)
           else a.key end,
         a.subject, a.marks, a.n, a.papers, a.exam_date, a.exam_days, a.heaviest_paper, a.heaviest_weight,
         round(a.score, 3),
         concat_ws('; ',
           trim(to_char(a.marks, 'FM999990.##')) || case when a.marks = 1 then ' mark' else ' marks' end
             || ' recoverable across ' || a.papers || case when a.papers = 1 then ' paper' else ' papers' end,
           case when a.exam_days is not null then 'exam in ' || a.exam_days || case when a.exam_days = 1 then ' day' else ' days' end end,
           case when a.heaviest_weight is not null and a.heaviest_paper is not null
                then 'Paper ' || a.heaviest_paper || ' is ' || trim(to_char(a.heaviest_weight, 'FM990.##')) || '% of the qualification' end)
    from areas a
   -- The whole-subject area is the fallback: listed after every specific area.
   order by (a.kind = 'subject'), a.score desc, a.marks desc, a.kind, a.key
   limit greatest(1, least(coalesce(p_limit, 5), 20));
end;
$$;
revoke all on function public.focus_areas(uuid, text, integer) from public, anon;
grant execute on function public.focus_areas(uuid, text, integer) to authenticated;

-- Items to practise for one focus: due first, then the heaviest, filling a
-- 15-minute budget, at most six.
create or replace function private.items_for_focus(
  p_student uuid, p_kind text, p_key text, p_subject text, p_budget integer default 15, p_max integer default 6)
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := '{}';
  v_used integer := 0;
  r record;
begin
  for r in
    select s.id, s.minutes
      from private.scored_items(p_student) s
     where (p_kind = 'due' and s.next_review_at <= now())
        or (p_kind <> 'due' and s.status <> 'fixed'
            and (p_subject is null or s.subject is not distinct from p_subject)
            and case p_kind
                  when 'topic' then s.topic_id::text = p_key
                  when 'command_word' then s.command_word = p_key
                  when 'ao' then s.ao = p_key
                  when 'mistake_type' then s.mistake_type = p_key
                  when 'subject' then coalesce(s.subject, '') = coalesce(p_key, '')
                  when 'item' then s.id::text = p_key
                  else false end)
     order by (s.next_review_at <= now()) desc,
              s.weight * (1 + 0.5 * (s.recurrence_count - 1)) desc,
              s.next_review_at, s.id
  loop
    exit when cardinality(v_ids) >= p_max;
    -- Always take one, so a single long question is still practisable.
    if cardinality(v_ids) > 0 and v_used + r.minutes > p_budget then continue; end if;
    v_ids := v_ids || r.id;
    v_used := v_used + r.minutes;
  end loop;
  return v_ids;
end;
$$;
revoke all on function private.items_for_focus(uuid, text, text, text, integer, integer) from public, anon, authenticated;

-- ── AXO-252: today's due queue ─────────────────────────────────────────────
-- Missed days do not pile up: however many are overdue, the queue is the
-- 3-6 most valuable that fit in 15 minutes, and the rest wait their turn.
create or replace function public.due_queue(p_student uuid)
returns table (
  id uuid, subject text, question_label text, paper_id uuid, attempt_id uuid,
  marks_lost numeric, marks_available numeric, minutes integer, next_review_at timestamptz,
  overdue_days integer, status text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_ids uuid[];
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);
  v_ids := private.items_for_focus(p_student, 'due', null, null);
  return query
  select e.id, e.subject, e.question_label, e.paper_id, e.attempt_id, e.marks_lost, e.marks_available,
         private.item_minutes(e.marks_available), e.next_review_at,
         greatest(0, (private.student_today(p_student) - (e.next_review_at at time zone 'UTC')::date))::int,
         e.status
    from unnest(v_ids) with ordinality u(id, ord)
    join public.error_item e on e.id = u.id
   order by u.ord;
end;
$$;
revoke all on function public.due_queue(uuid) from public, anon;
grant execute on function public.due_queue(uuid) to authenticated;

-- ── AXO-251: next best action ──────────────────────────────────────────────
create or replace function public.next_best_action(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area record;
  v_ids uuid[];
  v_due integer;
  v_items integer;
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);

  select count(*) into v_items from public.error_item where student_id = p_student and withdrawn_at is null;
  if v_items = 0 then
    return jsonb_build_object('state',
      case when exists (select 1 from public.attempt_analytics where student_id = p_student) then 'no_lost_marks' else 'no_scans' end);
  end if;

  -- Due re-attempts come first: spacing only works if the review happens.
  v_ids := private.items_for_focus(p_student, 'due', null, null);
  if cardinality(v_ids) >= 3 then
    return jsonb_build_object(
      'state', 'ready', 'kind', 'due', 'key', null, 'label', null, 'subject', null,
      'item_ids', to_jsonb(v_ids),
      'marks_recoverable', (select sum(marks_lost) from public.error_item where id = any (v_ids)),
      'minutes', (select sum(private.item_minutes(marks_available)) from public.error_item where id = any (v_ids)),
      'reason', cardinality(v_ids) || ' re-attempts are due');
  end if;

  select * into v_area from public.focus_areas(p_student, null, 8) f
   order by (f.kind = 'subject'), f.score desc limit 1;
  if not found then
    select count(*) into v_due from public.error_item
     where student_id = p_student and withdrawn_at is null and status <> 'fixed';
    return jsonb_build_object('state', case when v_due = 0 then 'caught_up' else 'nothing_due' end,
      'next_review_at', (select min(next_review_at) from public.error_item
                          where student_id = p_student and withdrawn_at is null));
  end if;

  v_ids := private.items_for_focus(p_student, v_area.kind, v_area.key, v_area.subject);
  return jsonb_build_object(
    'state', 'ready', 'kind', v_area.kind, 'key', v_area.key, 'label', v_area.label,
    'subject', v_area.subject, 'item_ids', to_jsonb(v_ids),
    'marks_recoverable', (select sum(marks_lost) from public.error_item where id = any (v_ids)),
    'area_marks_recoverable', v_area.marks_recoverable,
    'papers_seen', v_area.papers_seen,
    'minutes', (select sum(private.item_minutes(marks_available)) from public.error_item where id = any (v_ids)),
    'reason', v_area.reason);
end;
$$;
revoke all on function public.next_best_action(uuid) from public, anon;
grant execute on function public.next_best_action(uuid) to authenticated;

-- ── AXO-256/257: the practice loop ─────────────────────────────────────────
create table public.practice_session (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.student (id) on delete cascade,
  focus_kind      text not null check (focus_kind in ('due', 'topic', 'command_word', 'ao', 'mistake_type', 'subject', 'item')),
  focus_key       text,
  focus_subject   text,
  item_ids        uuid[] not null check (cardinality(item_ids) between 1 and 6),
  budget_minutes  smallint not null default 15 check (budget_minutes between 5 and 60),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  -- The student's own calendar day the session finished on (their timezone),
  -- which is what the streak counts.
  local_date      date,
  completed_items integer not null default 0 check (completed_items >= 0)
);
create index practice_session_student_idx on public.practice_session (student_id, finished_at);

create table public.reattempt (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.practice_session (id) on delete cascade,
  error_item_id      uuid not null references public.error_item (id) on delete cascade,
  student_id         uuid not null references public.student (id) on delete cascade,
  -- The student's own answer from memory, and their own check of it against
  -- the explanation. Not a mark: hard rule 1 keeps marks to the teacher.
  answer_text        text check (length(answer_text) <= 8000),
  result             text not null check (result in ('got_it', 'partly', 'not_yet')),
  mistake_type       text check (mistake_type in ('careless', 'technique', 'misconception', 'knowledge_gap')),
  remedy             text not null check (remedy in ('retrieval', 'explain_then_retry', 'rewrite', 'final_check')),
  remedy_text        text check (length(remedy_text) <= 8000),
  final_check        jsonb check (final_check is null or jsonb_typeof(final_check) = 'object'),
  started_at         timestamptz,
  revealed_at        timestamptz,
  interval_days      smallint not null,
  status_after       text not null check (status_after in ('open', 'retried', 'fixed')),
  created_at         timestamptz not null default now(),
  unique (session_id, error_item_id)
);
create index reattempt_item_idx on public.reattempt (error_item_id, created_at);
create index reattempt_student_idx on public.reattempt (student_id, created_at);

comment on table public.reattempt is
  'AXO-256/257. One closed-book re-attempt: the student''s answer, their own check against the explanation, the remedy that followed, and the schedule it produced. Outcomes are kept per mistake type and remedy so the inferred remedies can be judged on data.';

alter table public.practice_session enable row level security;
alter table public.reattempt enable row level security;
create policy practice_session_select on public.practice_session
  for select to authenticated using (private.student_scope_allows(student_id));
create policy reattempt_select on public.reattempt
  for select to authenticated using (private.student_scope_allows(student_id));
revoke all on public.practice_session, public.reattempt from anon, authenticated;
grant select on public.practice_session, public.reattempt to authenticated;

create or replace function private.remedy_for(p_mistake_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_mistake_type
           when 'misconception' then 'explain_then_retry'
           when 'technique' then 'rewrite'
           when 'careless' then 'final_check'
           else 'retrieval' end;
$$;

create or replace function public.start_practice_session(
  p_student uuid, p_kind text, p_key text default null, p_subject text default null, p_item_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);
  if p_kind not in ('due', 'topic', 'command_word', 'ao', 'mistake_type', 'subject', 'item') then
    raise exception 'unknown focus' using errcode = '22023';
  end if;
  if p_item_ids is not null and cardinality(p_item_ids) > 0 then
    -- Items handed back from next_best_action. Every one must be the
    -- student's own and still live.
    if exists (select 1 from unnest(p_item_ids) u(id)
                where not exists (select 1 from public.error_item e
                                   where e.id = u.id and e.student_id = p_student and e.withdrawn_at is null)) then
      raise exception 'item not available' using errcode = '42501';
    end if;
    v_ids := p_item_ids[1:6];
  else
    v_ids := private.items_for_focus(p_student, p_kind, p_key, p_subject);
  end if;
  if v_ids is null or cardinality(v_ids) = 0 then
    return jsonb_build_object('state', 'empty');
  end if;
  insert into public.practice_session (student_id, focus_kind, focus_key, focus_subject, item_ids)
  values (p_student, p_kind, p_key, p_subject, v_ids)
  returning id into v_id;
  return jsonb_build_object('state', 'started', 'session_id', v_id, 'item_ids', to_jsonb(v_ids),
    'minutes', (select sum(private.item_minutes(marks_available)) from public.error_item where id = any (v_ids)));
end;
$$;
revoke all on function public.start_practice_session(uuid, text, text, text, uuid[]) from public, anon;
grant execute on function public.start_practice_session(uuid, text, text, text, uuid[]) to authenticated;

-- Everything a student needs to re-attempt one item, question first. The
-- explanation and scheme come from reattempt_reveal, after the attempt.
create or replace function public.practice_item(p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.error_item;
  v_flag boolean := private.flag('mistake_type_ui');
begin
  select * into e from public.error_item where id = p_item;
  if e.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.require_scope(e.student_id);
  return jsonb_build_object(
    'id', e.id, 'paper_id', e.paper_id, 'attempt_id', e.attempt_id,
    'question_label', e.question_label, 'subject', e.subject,
    'question_text', (select a.question_text from public.attempt_analytics a where a.id = e.attempt_id),
    'marks_available', e.marks_available, 'marks_lost', e.marks_lost,
    'command_word', e.command_word,
    'remedy', private.remedy_for(e.mistake_type),
    -- The label itself waits for the classifier's bar (AXO-249/253).
    'mistake_type', case when v_flag then e.mistake_type end,
    'status', e.status, 'attempts', e.attempts);
end;
$$;
revoke all on function public.practice_item(uuid) from public, anon;
grant execute on function public.practice_item(uuid) to authenticated;

-- AXO-256 reveal. Owner decision (13 Oct 2026): "explanation with scheme".
-- Always: the teacher's marks and remark, Axon's explanation, its fix line
-- and model answer. Scheme text only when the scheme on file came from a
-- source whose policy permits reproduction (scheme_source_policy), cited by
-- source and version. Cambridge and Pearson schemes are never ingested as
-- reproducible (hard rule 2; the 6 Oct scheme check keeps them model-only),
-- so for those the scheme stays out and the reason says so.
create or replace function public.reattempt_reveal(p_item uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.error_item;
  a record;
  m record;
  s record;
begin
  select * into e from public.error_item where id = p_item;
  if e.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.require_scope(e.student_id);

  select x.marks_awarded, x.max_marks, x.teacher_remark, x.student_answer, x.marks_source,
         x.canonical_question_id
    into a from public.attempt_analytics x where x.id = e.attempt_id;
  -- The worked answer shows only where QuestionDetail would show it: grounded
  -- explanation, with its source named.
  select x.ai_explanation, x.do_this_next, x.command_word,
         case when r.grounding_status = 'complete' and r.model_answer_source is not null then r.model_answer end as model_answer,
         case when r.grounding_status = 'complete' and r.model_answer_source is not null then r.model_answer_source end as model_answer_source,
         r.command_word_note
    into m
    from public.mark_loss_analytics x
    join public.mark_loss_event r on r.id = x.id
   where x.id = e.mark_loss_event_id;

  select cq.marking_scheme, cq.scheme_source, cq.scheme_version
    into s
    from public.canonical_question cq
    join public.scheme_document sd on sd.id = cq.scheme_document_id and sd.revoked_at is null
    join public.scheme_source_policy sp on sp.id = sd.policy_id and sp.active and sp.reproduction_permitted
   where cq.id = a.canonical_question_id
     and cq.marking_scheme is not null and cq.scheme_source is not null and cq.scheme_version is not null;

  return jsonb_build_object(
    'marks_awarded', a.marks_awarded, 'max_marks', a.max_marks, 'marks_source', a.marks_source,
    'teacher_remark', a.teacher_remark, 'original_answer', a.student_answer,
    'explanation', m.ai_explanation, 'do_this_next', m.do_this_next,
    'model_answer', m.model_answer, 'model_answer_source', m.model_answer_source,
    'command_word', coalesce(m.command_word, e.command_word),
    'command_word_note', m.command_word_note,
    'scheme', case when s.marking_scheme is not null then jsonb_build_object(
                'text', s.marking_scheme, 'source', s.scheme_source, 'version', s.scheme_version) end,
    'scheme_withheld_reason', case
      when s.marking_scheme is not null then null
      when a.canonical_question_id is null then 'no_scheme'
      else 'not_permitted' end);
end;
$$;
revoke all on function public.reattempt_reveal(uuid) from public, anon;
grant execute on function public.reattempt_reveal(uuid) to authenticated;

-- ── AXO-252: the schedule after an attempt ─────────────────────────────────
-- Ladder of gaps: 1, 3, 7, 16, 35 days. Got it moves one step out; partly
-- holds the step; not yet goes back to a day. Two passes on occasions at least
-- three days apart make the item fixed, reviewed again after 35 days; a miss
-- on that review reopens it. Inside 60 days of the subject's exam every gap is
-- capped at a third of the days left, so reviews still land before the exam.
create or replace function private.next_interval(
  p_step smallint, p_result text, p_exam_days integer)
returns table (step smallint, days integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ladder integer[] := array[1, 3, 7, 16, 35];
  v_step smallint;
  v_days integer;
begin
  v_step := case p_result
              when 'got_it' then least(p_step + 1, 4)
              when 'partly' then p_step
              else 0 end;
  v_days := v_ladder[v_step + 1];
  if p_exam_days is not null and p_exam_days >= 0 and p_exam_days <= 60 then
    v_days := least(v_days, greatest(1, p_exam_days / 3));
  end if;
  return query select v_step, v_days;
end;
$$;

create or replace function public.record_reattempt(
  p_session uuid, p_item uuid, p_result text,
  p_answer_text text default null, p_remedy_text text default null, p_final_check jsonb default null,
  p_started_at timestamptz default null, p_revealed_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ses public.practice_session;
  e public.error_item;
  v_next record;
  v_exam_days integer;
  v_passes integer;
  v_status text;
  v_review timestamptz;
begin
  select * into ses from public.practice_session where id = p_session for update;
  if ses.id is null then raise exception 'session not found' using errcode = 'P0002'; end if;
  perform private.require_scope(ses.student_id);
  if ses.finished_at is not null then raise exception 'session already finished' using errcode = '22023'; end if;
  if not (p_item = any (ses.item_ids)) then raise exception 'item not in this session' using errcode = '22023'; end if;
  if p_result not in ('got_it', 'partly', 'not_yet') then raise exception 'unknown result' using errcode = '22023'; end if;

  select * into e from public.error_item where id = p_item for update;
  v_exam_days := private.next_exam_date(e.student_id, e.syllabus_code, private.student_today(e.student_id))
                 - private.student_today(e.student_id);
  select * into v_next from private.next_interval(e.interval_step, p_result, v_exam_days);

  v_passes := case when p_result = 'got_it' then e.consecutive_passes + 1 else 0 end;
  if p_result = 'got_it' and v_passes >= 2 and e.last_pass_at is not null and e.last_pass_at <= now() - interval '3 days' then
    v_status := 'fixed';
    v_review := now() + interval '35 days';
  else
    v_status := 'retried';
    v_review := now() + make_interval(days => v_next.days);
  end if;

  insert into public.reattempt (session_id, error_item_id, student_id, answer_text, result, mistake_type, remedy,
                                remedy_text, final_check, started_at, revealed_at, interval_days, status_after)
  values (p_session, p_item, e.student_id, nullif(btrim(p_answer_text), ''), p_result, e.mistake_type,
          private.remedy_for(e.mistake_type), nullif(btrim(p_remedy_text), ''), p_final_check,
          p_started_at, p_revealed_at,
          case when v_status = 'fixed' then 35 else v_next.days end, v_status);

  update public.error_item
     set status = v_status,
         attempts = attempts + 1,
         consecutive_passes = v_passes,
         interval_step = case when v_status = 'fixed' then 4 else v_next.step end,
         last_attempt_at = now(),
         last_pass_at = case when p_result = 'got_it' then now() else last_pass_at end,
         next_review_at = v_review,
         updated_at = now()
   where id = p_item;

  update public.practice_session set completed_items = completed_items + 1 where id = p_session;

  return jsonb_build_object('status', v_status, 'next_review_at', v_review,
    'interval_days', case when v_status = 'fixed' then 35 else v_next.days end);
end;
$$;
revoke all on function public.record_reattempt(uuid, uuid, text, text, text, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.record_reattempt(uuid, uuid, text, text, text, jsonb, timestamptz, timestamptz) to authenticated;

-- ── AXO-258: if-then plan ──────────────────────────────────────────────────
create table public.practice_intention (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.student (id) on delete cascade,
  session_id   uuid references public.practice_session (id) on delete set null,
  planned_for  timestamptz not null,
  place        text check (length(btrim(place)) between 1 and 80),
  created_at   timestamptz not null default now()
);
create index practice_intention_student_idx on public.practice_intention (student_id, planned_for);
alter table public.practice_intention enable row level security;
create policy practice_intention_select on public.practice_intention
  for select to authenticated using (private.student_scope_allows(student_id));
revoke all on public.practice_intention from anon, authenticated;
grant select on public.practice_intention to authenticated;

create or replace function public.finish_practice_session(p_session uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ses public.practice_session;
  v_today date;
  v_first boolean;
  v_cohort text;
  v_prompt boolean := false;
begin
  select * into ses from public.practice_session where id = p_session for update;
  if ses.id is null then raise exception 'session not found' using errcode = 'P0002'; end if;
  perform private.require_scope(ses.student_id);
  v_today := private.student_today(ses.student_id);
  if ses.finished_at is null then
    update public.practice_session set finished_at = now(), local_date = v_today where id = p_session;
  end if;

  -- First completed session of the student's ISO week.
  v_first := ses.completed_items > 0 and not exists (
    select 1 from public.practice_session o
     where o.student_id = ses.student_id and o.id <> ses.id and o.completed_items > 0
       and o.local_date is not null and date_trunc('week', o.local_date) = date_trunc('week', v_today));

  if v_first and private.flag('if_then_prompt') then
    insert into public.student_practice_pref (student_id) values (ses.student_id) on conflict do nothing;
    -- The arm is fixed once, from the student id, so it never flips.
    update public.student_practice_pref
       set if_then_cohort = case when get_byte(sha256(convert_to(ses.student_id::text || ':if_then_v1', 'UTF8')), 0) % 2 = 0
                                 then 'prompt' else 'control' end,
           updated_at = now()
     where student_id = ses.student_id and if_then_cohort is null;
    select if_then_cohort into v_cohort from public.student_practice_pref where student_id = ses.student_id;
    v_prompt := v_cohort = 'prompt' and not exists (
      select 1 from public.practice_intention i
       where i.student_id = ses.student_id and i.created_at >= date_trunc('week', now()));
  end if;

  return jsonb_build_object('completed_items', ses.completed_items, 'local_date', v_today,
    'first_of_week', v_first, 'ask_if_then', v_prompt);
end;
$$;
revoke all on function public.finish_practice_session(uuid) from public, anon;
grant execute on function public.finish_practice_session(uuid) to authenticated;

create or replace function public.record_intention(p_student uuid, p_session uuid, p_planned_for timestamptz, p_place text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_scope(p_student);
  if p_planned_for <= now() or p_planned_for > now() + interval '14 days' then
    raise exception 'plan a time in the next two weeks' using errcode = '22023';
  end if;
  if p_session is not null and not exists (select 1 from public.practice_session where id = p_session and student_id = p_student) then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  insert into public.practice_intention (student_id, session_id, planned_for, place)
  values (p_student, p_session, p_planned_for, nullif(btrim(p_place), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_intention(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.record_intention(uuid, uuid, timestamptz, text) to authenticated;

-- The experiment's metric: completed sessions per student-week, per arm. For
-- the owner, through the service role.
create or replace function private.if_then_report()
returns table (cohort text, students integer, student_weeks integer, sessions integer, sessions_per_week numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with weeks as (
    select p.if_then_cohort as cohort, s.student_id, date_trunc('week', s.local_date) as wk, count(*) as n
      from public.practice_session s
      join public.student_practice_pref p on p.student_id = s.student_id
     where p.if_then_cohort is not null and s.completed_items > 0 and s.local_date is not null
     group by 1, 2, 3
  )
  select cohort, count(distinct student_id)::int, count(*)::int, sum(n)::int, round(avg(n), 2)
    from weeks group by cohort order by cohort;
$$;
revoke all on function private.if_then_report() from public, anon, authenticated;
grant execute on function private.if_then_report() to service_role;

-- ── AXO-259: error journal ─────────────────────────────────────────────────
create or replace function public.error_journal(p_student uuid)
returns table (
  id uuid, paper_id uuid, attempt_id uuid, question_label text, subject text, syllabus_code text,
  topic_id uuid, topic_label text, command_word text, ao text, mistake_type text,
  marks_lost numeric, marks_available numeric, original_answer text, explanation text,
  status text, attempts integer, next_review_at timestamptz, paper_date date, recurrence_count integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_types boolean := private.flag('mistake_type_ui');
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);
  return query
  select e.id, e.paper_id, e.attempt_id, e.question_label, e.subject, e.syllabus_code,
         e.topic_id, (select coalesce(st.code || ' ', '') || st.title from public.syllabus_topic st where st.id = e.topic_id),
         e.command_word, e.ao,
         case when v_types then e.mistake_type end,
         e.marks_lost, e.marks_available,
         (select a.student_answer from public.attempt_analytics a where a.id = e.attempt_id),
         (select m.ai_explanation from public.mark_loss_analytics m where m.id = e.mark_loss_event_id),
         e.status, e.attempts, e.next_review_at, e.paper_date, e.recurrence_count
    from public.error_item e
   where e.student_id = p_student and e.withdrawn_at is null
   order by e.paper_date desc, e.question_label;
end;
$$;
revoke all on function public.error_journal(uuid) from public, anon;
grant execute on function public.error_journal(uuid) to authenticated;

-- ── AXO-260: command word and AO scorecard ─────────────────────────────────
-- Marks gained against marks available, by command word and by AO, from every
-- eligible attempt (not only the ones that lost marks), weighted by the
-- paper's share of the qualification. `trend` is one point per paper, oldest
-- first. `untagged` collects questions with no command word or AO, so the
-- table never silently drops marks.
create or replace function public.scorecard(p_student uuid, p_subject text)
returns table (
  dimension text, key text, questions integer, papers integer,
  marks_gained numeric, marks_available numeric,
  weighted_gained numeric, weighted_available numeric, trend jsonb)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_scope(p_student);
  return query
  with t as (
    select x.*, private.component_weight_factor(x.provider_key, x.syllabus_code, x.paper_number, x.programme_key) as wf
      from private.attempt_tags(p_student) x
     where x.subject is not distinct from p_subject
  ),
  dims as (
    select 'command_word'::text as dimension, coalesce(t.command_word, 'untagged') as key, t.* from t
    union all
    select 'ao', coalesce(t.ao, 'untagged'), t.* from t
  ),
  per_paper as (
    select d.dimension, d.key, d.paper_id, min(d.paper_date) as paper_date,
           sum(d.marks_awarded) as g, sum(d.max_marks) as av
      from dims d group by 1, 2, 3
  )
  select d.dimension, d.key, count(*)::int, count(distinct d.paper_id)::int,
         sum(d.marks_awarded), sum(d.max_marks),
         round(sum(d.marks_awarded * d.wf), 2), round(sum(d.max_marks * d.wf), 2),
         (select jsonb_agg(jsonb_build_object('paper_id', pp.paper_id, 'date', pp.paper_date, 'gained', pp.g, 'available', pp.av)
                           order by pp.paper_date, pp.paper_id)
            from per_paper pp where pp.dimension = d.dimension and pp.key = d.key)
    from dims d
   group by d.dimension, d.key
   order by d.dimension, sum(d.max_marks - d.marks_awarded) desc, d.key;
end;
$$;
revoke all on function public.scorecard(uuid, text) from public, anon;
grant execute on function public.scorecard(uuid, text) to authenticated;

-- ── AXO-261: topic readiness ───────────────────────────────────────────────
-- A ladder per syllabus point, earned and allowed to fade:
--   attempted   a question on the topic was answered (any marks)
--   familiar    one re-attempt passed, or full marks on the topic in a paper
--   proficient  nothing open on it, and two passes on different days or full
--               marks in two papers
--   mastered    proficient, with an item fixed (two spaced passes) or full
--               marks in three papers
-- Every 60 days without positive evidence drops it a rung (not below
-- attempted). A topic with no evidence is 'no_data', never zero.
create or replace function public.topic_readiness(p_student uuid, p_document uuid)
returns table (
  topic_id uuid, parent_id uuid, code text, title text, depth smallint, sort_order integer,
  level text, questions integer, papers integer, open_items integer,
  marks_recoverable numeric, last_evidence_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);
  return query
  with te as (
    select t.topic_id, count(*)::int as q, count(distinct t.paper_id)::int as papers,
           count(distinct t.paper_id) filter (where t.marks_awarded >= t.max_marks)::int as full_papers,
           max(coalesce(p.exam_date, p.date_taken, p.created_at::date)) filter (where t.marks_awarded >= t.max_marks) as last_full
      from public.topic_evidence t
      join public.paper p on p.id = t.paper_id
     where t.student_id = p_student and t.document_id = p_document
     group by t.topic_id
  ),
  it as (
    select e.topic_id,
           count(*) filter (where e.status <> 'fixed')::int as open_n,
           count(*) filter (where e.status = 'fixed')::int as fixed_n,
           coalesce(sum(e.marks_lost) filter (where e.status <> 'fixed'), 0) as rec
      from public.error_item e
     where e.student_id = p_student and e.withdrawn_at is null and e.topic_id is not null
     group by e.topic_id
  ),
  ps as (
    select e.topic_id,
           count(distinct (r.created_at at time zone 'UTC')::date)::int as pass_days,
           max(r.created_at) as last_pass
      from public.reattempt r join public.error_item e on e.id = r.error_item_id
     where r.student_id = p_student and r.result = 'got_it' and e.topic_id is not null
     group by e.topic_id
  ),
  levels as (
    select st.id, st.parent_id, st.code, st.title, st.depth, st.sort_order,
           te.q, te.papers, coalesce(it.open_n, 0) as open_n, coalesce(it.rec, 0) as rec,
           greatest(ps.last_pass, te.last_full::timestamptz) as last_pos,
           case
             when te.topic_id is null and it.topic_id is null then 0
             when coalesce(it.open_n, 0) = 0
                  and (coalesce(it.fixed_n, 0) >= 1 or coalesce(te.full_papers, 0) >= 3)
                  and (coalesce(ps.pass_days, 0) >= 2 or coalesce(te.full_papers, 0) >= 3) then 4
             when coalesce(it.open_n, 0) = 0
                  and (coalesce(ps.pass_days, 0) >= 2 or coalesce(te.full_papers, 0) >= 2) then 3
             when coalesce(ps.pass_days, 0) >= 1 or coalesce(te.full_papers, 0) >= 1 then 2
             else 1 end as base
      from public.syllabus_topic st
      left join te on te.topic_id = st.id
      left join it on it.topic_id = st.id
      left join ps on ps.topic_id = st.id
     where st.document_id = p_document
  )
  select l.id, l.parent_id, l.code, l.title, l.depth, l.sort_order,
         case when l.base = 0 then 'no_data'
              else (array['attempted', 'familiar', 'proficient', 'mastered'])[
                     greatest(1, l.base - case when l.base >= 2 and l.last_pos is not null
                                               then floor(extract(epoch from (now() - l.last_pos)) / 86400 / 60)::int
                                               else 0 end)]
         end,
         coalesce(l.q, 0), coalesce(l.papers, 0), l.open_n, l.rec, l.last_pos
    from levels l
   order by l.sort_order, l.code;
end;
$$;
revoke all on function public.topic_readiness(uuid, uuid) from public, anon;
grant execute on function public.topic_readiness(uuid, uuid) to authenticated;

-- ── AXO-262: grade thresholds and the outlook range ────────────────────────
-- Thresholds change every series, so each set is one published table for one
-- syllabus option in one series, with its source. Sets load as draft and are
-- used only once a person marks them verified (the syllabus-document rule).
create table public.grade_threshold_set (
  id                 uuid primary key default gen_random_uuid(),
  provider_key       text not null check (provider_key in ('cambridge', 'cbse', 'ib')),
  syllabus_code      text not null check (syllabus_code ~ '^[0-9]{4}$'),
  series_key         text not null check (series_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  qualification      text not null check (qualification in ('igcse', 'as', 'a_level')),
  option_code        text not null check (length(btrim(option_code)) > 0),
  -- The papers in the option, the raw maximum of each, and the weighting
  -- factor Cambridge applies to each before summing.
  components         smallint[] not null check (cardinality(components) between 1 and 9),
  component_max      jsonb not null check (jsonb_typeof(component_max) = 'object'),
  component_weight   jsonb not null check (jsonb_typeof(component_weight) = 'object'),
  max_total          numeric not null check (max_total > 0),
  source_url         text not null check (source_url ~ '^https://'),
  source_sha256      text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  status             text not null default 'draft' check (status in ('draft', 'verified')),
  verified_by        text,
  verified_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (provider_key, syllabus_code, series_key, option_code),
  check (status = 'draft' or (verified_by is not null and verified_at is not null))
);

create table public.grade_threshold (
  set_id     uuid not null references public.grade_threshold_set (id) on delete cascade,
  grade      text not null check (length(btrim(grade)) between 1 and 3),
  min_total  numeric not null check (min_total >= 0),
  primary key (set_id, grade)
);

alter table public.grade_threshold_set enable row level security;
alter table public.grade_threshold enable row level security;
create policy grade_threshold_set_read on public.grade_threshold_set
  for select to authenticated using (status = 'verified');
create policy grade_threshold_read on public.grade_threshold
  for select to authenticated using (exists (select 1 from public.grade_threshold_set s where s.id = set_id and s.status = 'verified'));
revoke all on public.grade_threshold_set, public.grade_threshold from anon, authenticated;
grant select on public.grade_threshold_set, public.grade_threshold to authenticated;

-- The outlook is a prediction: off unless the student turned it on (opt-in,
-- never default). It answers with a range, the papers it rests on, and the
-- series whose thresholds it used. Fewer than three identified, complete
-- papers covering every paper of the option means no outlook at all.
create or replace function public.grade_outlook(p_student uuid, p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opt boolean;
  v_syllabus text;
  v_series text;
  v_papers smallint[];
  v_set public.grade_threshold_set;
  v_n integer;
  v_missing smallint[];
  v_lo numeric; v_mid numeric; v_hi numeric;
  v_target text;
  v_target_min numeric;
  v_components jsonb;
  v_grade_lo text; v_grade_mid text; v_grade_hi text;
  v_scale text[];
  v_stretch text;
begin
  perform private.require_scope(p_student);
  select outlook_opt_in into v_opt from public.student_practice_pref where student_id = p_student;
  if not coalesce(v_opt, false) then return jsonb_build_object('state', 'off'); end if;

  select ss.syllabus_code into v_syllabus from public.student_subject ss
   where ss.student_id = p_student and ss.subject = p_subject;
  if v_syllabus is null then return jsonb_build_object('state', 'unsupported', 'why', 'no_syllabus_code'); end if;
  select series_key into v_series from public.student_exam_plan where student_id = p_student;
  select papers into v_papers from public.student_exam_papers where student_id = p_student and syllabus_code = v_syllabus;

  -- The most recent verified series in the same month as the student's own
  -- series (June thresholds for a June candidate), else the most recent.
  select * into v_set from public.grade_threshold_set s
   where s.syllabus_code = v_syllabus and s.status = 'verified'
     and (v_papers is null or s.components @> v_papers)
   order by (v_series is not null and right(s.series_key, 2) = right(v_series, 2)) desc,
            s.series_key desc,
            (v_papers is not null and s.components = v_papers) desc
   limit 1;
  if v_set.id is null then return jsonb_build_object('state', 'unsupported', 'why', 'no_verified_thresholds'); end if;

  with per_paper as (
    select t.paper_id, t.paper_number,
           sum(t.marks_awarded) / nullif(sum(t.max_marks), 0) as share
      from private.attempt_tags(p_student) t
     where t.syllabus_code = v_syllabus and t.paper_number = any (v_set.components) and not t.total_partial
     group by t.paper_id, t.paper_number
  ),
  per_component as (
    select c.paper,
           count(pp.paper_id)::int as n,
           min(pp.share) as lo, avg(pp.share) as mid, max(pp.share) as hi
      from unnest(v_set.components) c(paper)
      left join per_paper pp on pp.paper_number = c.paper
     group by c.paper
  )
  select (select count(*)::int from per_paper),
         array_agg(pc.paper) filter (where pc.n = 0),
         -- One paper on a component is too little to know its spread; widen it.
         sum(greatest(0, case when pc.n = 1 then pc.mid - 0.10 else pc.lo end)
             * (v_set.component_max ->> pc.paper::text)::numeric * (v_set.component_weight ->> pc.paper::text)::numeric),
         sum(pc.mid * (v_set.component_max ->> pc.paper::text)::numeric * (v_set.component_weight ->> pc.paper::text)::numeric),
         sum(least(1, case when pc.n = 1 then pc.mid + 0.10 else pc.hi end)
             * (v_set.component_max ->> pc.paper::text)::numeric * (v_set.component_weight ->> pc.paper::text)::numeric),
         jsonb_agg(jsonb_build_object('paper', pc.paper, 'papers', pc.n) order by pc.paper)
    into v_n, v_missing, v_lo, v_mid, v_hi, v_components
    from per_component pc;

  if v_n < 3 or v_missing is not null then
    return jsonb_build_object('state', 'not_enough', 'papers', v_n, 'needed', 3,
      'missing_papers', to_jsonb(coalesce(v_missing, '{}'::smallint[])), 'components', v_components);
  end if;

  select g.grade into v_grade_lo from public.grade_threshold g where g.set_id = v_set.id and g.min_total <= v_lo order by g.min_total desc limit 1;
  select g.grade into v_grade_mid from public.grade_threshold g where g.set_id = v_set.id and g.min_total <= v_mid order by g.min_total desc limit 1;
  select g.grade into v_grade_hi from public.grade_threshold g where g.set_id = v_set.id and g.min_total <= v_hi order by g.min_total desc limit 1;
  select grade into v_target from public.student_target_grade where student_id = p_student and subject = p_subject;
  select g.min_total into v_target_min from public.grade_threshold g where g.set_id = v_set.id and g.grade = v_target;
  select private.grade_scale(cp.key) into v_scale
    from public.student s left join public.curriculum_programme cp on cp.id = s.programme_id where s.id = p_student;
  if v_grade_mid is not null and v_scale is not null and array_position(v_scale, v_grade_mid) > 1 then
    v_stretch := v_scale[array_position(v_scale, v_grade_mid) - 1];
  end if;

  return jsonb_build_object(
    'state', 'ready',
    'syllabus_code', v_syllabus, 'series_key', v_set.series_key, 'option_code', v_set.option_code,
    'source_url', v_set.source_url, 'papers', v_n, 'components', v_components,
    'low_grade', coalesce(v_grade_lo, 'below lowest grade'), 'mid_grade', v_grade_mid,
    'high_grade', coalesce(v_grade_hi, 'below lowest grade'),
    'low_total', round(v_lo), 'high_total', round(v_hi), 'mid_total', round(v_mid), 'max_total', v_set.max_total,
    'target', v_target,
    'marks_to_target', case when v_target_min is not null and v_target_min > v_mid then ceil(v_target_min - v_mid) end,
    'suggested', v_grade_mid, 'stretch', v_stretch);
end;
$$;
revoke all on function public.grade_outlook(uuid, text) from public, anon;
grant execute on function public.grade_outlook(uuid, text) to authenticated;

-- ── AXO-254: the progress strip ────────────────────────────────────────────
-- Marks recovered: marks on items the student has fixed through spaced
-- re-attempts, by the week they were fixed (the student's own week). These
-- are practice marks, not exam marks, and the client says so. Topics: syllabus
-- points where a re-attempt passed in the last 30 days. The streak is computed
-- on the device from practice_session.local_date (src/ui/data/streak.ts).
create or replace function public.progress_summary(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  perform private.require_scope(p_student);
  v_today := private.student_today(p_student);
  return jsonb_build_object(
    'weeks', (
      select jsonb_agg(jsonb_build_object('week', w.wk, 'marks', coalesce(r.marks, 0)) order by w.wk)
        from generate_series(date_trunc('week', v_today) - interval '7 weeks', date_trunc('week', v_today), interval '1 week') w(wk)
        left join (
          select date_trunc('week', (x.created_at at time zone coalesce(p.timezone, 'UTC'))::date) as wk, sum(e.marks_lost) as marks
            from public.reattempt x
            join public.error_item e on e.id = x.error_item_id
            left join public.student_practice_pref p on p.student_id = x.student_id
           where x.student_id = p_student and x.status_after = 'fixed'
           group by 1
        ) r on r.wk = w.wk),
    'marks_recovered_total', (
      select coalesce(sum(e.marks_lost), 0) from public.error_item e
       where e.student_id = p_student and e.status = 'fixed' and e.withdrawn_at is null),
    'topics_passed_30d', (
      select count(distinct e.topic_id)::int from public.reattempt x join public.error_item e on e.id = x.error_item_id
       where x.student_id = p_student and x.result = 'got_it' and e.topic_id is not null
         and x.created_at >= now() - interval '30 days'),
    'reattempts_this_week', (
      select count(*)::int from public.reattempt x
        join public.practice_session s on s.id = x.session_id
       where x.student_id = p_student and s.local_date >= date_trunc('week', v_today)::date),
    'session_dates', (
      select coalesce(jsonb_agg(distinct s.local_date order by s.local_date), '[]'::jsonb)
        from public.practice_session s
       where s.student_id = p_student and s.completed_items > 0 and s.local_date is not null
         and s.local_date >= v_today - 400),
    'today', v_today);
end;
$$;
revoke all on function public.progress_summary(uuid) from public, anon;
grant execute on function public.progress_summary(uuid) to authenticated;
