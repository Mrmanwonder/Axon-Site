-- Learning signals: what students tell us about an explanation, kept apart from academic data.
--
-- Decisions (from the Axon completion brief, not reopened here):
--   · The store lives in Supabase, schema `learning`, not D1.
--   · No raw student text, ever. A signal records THAT a correction or a verdict happened and
--     which stage / cause / prompt version it was about. Never the answer, the remark, the
--     question or the explanation. There is deliberately no free-text column to put it in.
--   · Nothing is written without live consent for `improve_extraction`. Consent withdrawn means
--     signals stop and the student's existing signals are purged.
--   · No automatic model training. Aggregates are read by people and by the eval gate.
--   · Deleting a student, paper or question purges its signals (foreign keys + trigger).
--   · Clients never read this schema. Writes go through `public.record_explanation_feedback`.

create schema if not exists learning;
revoke all on schema learning from public, anon, authenticated;
grant usage on schema learning to service_role;

create table learning.signal (
  id             bigint generated always as identity primary key,
  student_id     uuid not null references public.student (id) on delete cascade,
  attempt_id     uuid not null references public.student_attempt (id) on delete cascade,
  kind           text not null check (kind in
                   ('explanation_helped', 'explanation_wrong', 'cause_confirmed', 'cause_rejected')),
  stage          text not null default 'explain' check (stage in ('explain')),
  cause          public.loss_cause,
  prompt_version text check (prompt_version is null or prompt_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  created_at     timestamptz not null default now(),
  aggregated_at  timestamptz
);

comment on table learning.signal is
  'One student verdict about one explanation or cause tag. No raw text by construction: every column is an enum, an id, or a version string. aggregated_at is NULL until learning.aggregate() has counted the row, which makes this table its own queue.';

create index learning_signal_unaggregated on learning.signal (id) where aggregated_at is null;
create index learning_signal_attempt on learning.signal (attempt_id);

-- At most one explanation verdict per attempt: the latest one wins.
create unique index learning_signal_one_verdict on learning.signal (attempt_id)
  where kind in ('explanation_helped', 'explanation_wrong');

create table learning.signal_daily (
  day            date not null,
  stage          text not null,
  kind           text not null,
  cause          text not null default 'none',
  prompt_version text not null default 'none',
  n              integer not null check (n > 0),
  primary key (day, stage, kind, cause, prompt_version)
);

comment on table learning.signal_daily is
  'Counts only. Rows of fewer than 5 are not published by learning.signal_counts(), so a small group cannot point at one student.';

alter table learning.signal enable row level security;
alter table learning.signal_daily enable row level security;
revoke all on all tables in schema learning from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema learning to service_role;

-- ── consent ────────────────────────────────────────────────────────────────

create or replace function learning.consented(p_student uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select private.consent_is_granted(s.guardian_id, s.id, 'improve_extraction')
    from public.student s where s.id = p_student and s.deleted_at is null
$$;

revoke all on function learning.consented(uuid) from public, anon, authenticated;
grant execute on function learning.consented(uuid) to service_role;

-- ── recording ──────────────────────────────────────────────────────────────

-- The student's "this helped" / "this was wrong" control. Student Mode scope decides who may
-- call it; consent decides whether anything is stored. A student who has not consented still
-- gets a normal response, and nothing is kept.
create or replace function public.record_explanation_feedback(p_attempt_id uuid, p_helped boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, learning, pg_temp
as $$
declare
  v_student uuid;
  v_cause   public.loss_cause;
  v_kept    boolean := false;
begin
  select a.student_id into v_student from public.student_attempt a where a.id = p_attempt_id;
  if v_student is null or not private.student_scope_allows(v_student) then
    raise exception 'that question is not available' using errcode = '42501';
  end if;

  if learning.consented(v_student) then
    select m.cause into v_cause
      from public.mark_loss_event m
     where m.attempt_id = p_attempt_id and m.student_rejected_at is null
     order by m.id limit 1;

    insert into learning.signal (student_id, attempt_id, kind, cause)
    values (v_student, p_attempt_id,
            case when p_helped then 'explanation_helped' else 'explanation_wrong' end, v_cause)
    on conflict (attempt_id) where kind in ('explanation_helped', 'explanation_wrong')
    do update set kind = excluded.kind, cause = excluded.cause,
                  created_at = now(), aggregated_at = null;
    v_kept := true;
  end if;

  return jsonb_build_object('recorded', v_kept);
end; $$;

revoke all on function public.record_explanation_feedback(uuid, boolean) from public, anon;
grant execute on function public.record_explanation_feedback(uuid, boolean) to authenticated;

comment on function public.record_explanation_feedback(uuid, boolean) is
  'The helped / was-wrong control. Scope-checked; stores a signal only with live improve_extraction consent. Never stores text.';

-- A cause the student confirms or rejects is a signal too ("Not why I lost it" is the strongest
-- one we get). Recorded from the existing columns, so no client change is needed.
create or replace function learning.record_cause_verdict()
returns trigger
language plpgsql security definer
set search_path = public, learning, pg_temp
as $$
declare v_kind text;
begin
  if new.student_rejected_at is not null and old.student_rejected_at is null then
    v_kind := 'cause_rejected';
  elsif new.student_confirmed_at is not null and old.student_confirmed_at is null then
    v_kind := 'cause_confirmed';
  else
    return new;
  end if;

  if learning.consented(new.student_id) then
    insert into learning.signal (student_id, attempt_id, kind, cause)
    values (new.student_id, new.attempt_id, v_kind, new.cause);
  end if;
  return new;
end; $$;

revoke all on function learning.record_cause_verdict() from public, anon, authenticated;

create trigger mark_loss_event_cause_verdict
  after update of student_confirmed_at, student_rejected_at on public.mark_loss_event
  for each row execute function learning.record_cause_verdict();

-- ── aggregation (the queue consumer) ───────────────────────────────────────

create or replace function learning.aggregate()
returns integer
language plpgsql security definer
set search_path = learning, pg_temp
as $$
declare v_rows integer;
begin
  with batch as (
    select id, created_at::date as day, stage, kind,
           coalesce(cause::text, 'none') as cause, coalesce(prompt_version, 'none') as prompt_version
      from learning.signal where aggregated_at is null
     order by id limit 5000 for update skip locked
  ), counted as (
    select day, stage, kind, cause, prompt_version, count(*)::int as n from batch
     group by 1, 2, 3, 4, 5
  ), upserted as (
    insert into learning.signal_daily (day, stage, kind, cause, prompt_version, n)
    select * from counted
    on conflict (day, stage, kind, cause, prompt_version)
    do update set n = learning.signal_daily.n + excluded.n
    returning 1
  )
  update learning.signal s set aggregated_at = now()
    from batch b where s.id = b.id;
  get diagnostics v_rows = row_count;
  return v_rows;
end; $$;

revoke all on function learning.aggregate() from public, anon, authenticated;
grant execute on function learning.aggregate() to service_role;

-- What people and the eval gate may read: counts, with small groups suppressed.
create or replace function learning.signal_counts(p_since date default current_date - 30)
returns table (stage text, kind text, cause text, prompt_version text, n bigint)
language sql stable security definer
set search_path = learning, pg_temp
as $$
  select d.stage, d.kind, d.cause, d.prompt_version, sum(d.n)::bigint
    from learning.signal_daily d
   where d.day >= p_since
   group by 1, 2, 3, 4
  having sum(d.n) >= 5
$$;

revoke all on function learning.signal_counts(date) from public, anon, authenticated;
grant execute on function learning.signal_counts(date) to service_role;

-- ── purge ──────────────────────────────────────────────────────────────────

-- Rows already folded into signal_daily are counts of a group, not of a person, and carry no
-- student id; what must go is anything still tied to the student.
create or replace function learning.purge_student(p_student uuid)
returns integer
language plpgsql security definer
set search_path = learning, pg_temp
as $$
declare v_rows integer;
begin
  delete from learning.signal where student_id = p_student;
  get diagnostics v_rows = row_count;
  return v_rows;
end; $$;

revoke all on function learning.purge_student(uuid) from public, anon, authenticated;
grant execute on function learning.purge_student(uuid) to service_role;

-- Soft-deleted students never reach the foreign-key cascade, so the purge is explicit.
create or replace function learning.purge_on_student_delete()
returns trigger
language plpgsql security definer
set search_path = learning, pg_temp
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    perform learning.purge_student(new.id);
  end if;
  return new;
end; $$;

revoke all on function learning.purge_on_student_delete() from public, anon, authenticated;

create trigger student_learning_purge
  after update of deleted_at on public.student
  for each row execute function learning.purge_on_student_delete();

-- Withdrawing consent stops collection (learning.consented() reads the live record) and removes
-- what was collected.
create or replace function learning.purge_on_consent_withdrawn()
returns trigger
language plpgsql security definer
set search_path = public, learning, pg_temp
as $$
declare v_student uuid;
begin
  if new.purpose = 'improve_extraction' and new.granted = false then
    if new.student_id is not null then
      perform learning.purge_student(new.student_id);
    else
      for v_student in select id from public.student where guardian_id = new.guardian_id loop
        perform learning.purge_student(v_student);
      end loop;
    end if;
  end if;
  return new;
end; $$;

revoke all on function learning.purge_on_consent_withdrawn() from public, anon, authenticated;

create trigger consent_event_learning_purge
  after insert on public.consent_event
  for each row execute function learning.purge_on_consent_withdrawn();

-- Drain the queue every five minutes (pg_cron, same pattern as the stuck-run sweep).
do $cron$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule('axon-learning-aggregate') where exists (
      select 1 from cron.job where jobname = 'axon-learning-aggregate');
    perform cron.schedule('axon-learning-aggregate', '*/5 * * * *', 'select learning.aggregate();');
  end if;
end $cron$;

-- ============================================================================
-- Consolidated historical continuation: review-stage signals
-- The standalone learning_schema effect existed live without a ledger row.
-- Keeping its DDL in this already-ledgered migration preserves fresh-reset
-- behavior while preventing Supabase Preview from replaying a baseline file.
-- ============================================================================

-- ============================================================================
-- AXO-121 · Review-stage signals on top of learning.signal (#169)
-- ============================================================================
-- 20261001190000_learning_schema records verdicts on committed explanations.
-- Two signals happen earlier, in Review, and never reach it:
--
--   1. Extraction corrections. The student fixes a mark or an answer the
--      reader got wrong (src/scan/review.js correctMark / correctAnswer), or
--      confirms a question was read right (confirmQuestion). These are the
--      10 corrections already in production, and the first thing AXO-121 asks
--      for. They live on question_region, before any student_attempt exists.
--   2. "Not why I lost it" in Review (rejectCause) clears
--      region_explanation.cause. The #169 trigger watches mark_loss_event,
--      which a Review-stage rejection never touches.
--
-- Same doctrine as #169: consent read live at write time, no text (a field
-- name, a confidence tier and a prompt version, never the value), purged on
-- withdrawal and deletion through the existing purge functions, aggregated
-- into counts. The only additions to the shape are a `field` dimension on the
-- aggregate, which "correction rate per field" needs, and region_id, because
-- Review happens before an attempt exists.
--
-- Nothing here writes to public.*: a student's correction of a transcription
-- is recorded as a fact about the transcription and changes nothing else.
-- ============================================================================

-- Enums, not text: #169's "no free-text column" guard stays true by construction.
create type learning.extract_field as enum
  ('question_label', 'question_text', 'student_answer', 'marks_awarded', 'marks_available', 'teacher_remark');
grant usage on type learning.extract_field to service_role;

alter table learning.signal alter column attempt_id drop not null;
alter table learning.signal
  add column region_id uuid references public.question_region (id) on delete cascade,
  add column field learning.extract_field,
  add column confidence_before public.confidence_tier,
  add constraint signal_has_subject check (attempt_id is not null or region_id is not null);

alter table learning.signal
  drop constraint signal_kind_check,
  add constraint signal_kind_check check (kind in
    ('explanation_helped', 'explanation_wrong', 'cause_confirmed', 'cause_rejected',
     'field_corrected', 'region_confirmed'));
alter table learning.signal
  drop constraint signal_stage_check,
  add constraint signal_stage_check check (stage in ('explain', 'extract'));

create index if not exists learning_signal_region on learning.signal (region_id);
-- learning.purge_student deletes by student_id; the advisor flagged the FK as unindexed (2026-10-02).
create index if not exists learning_signal_student on learning.signal (student_id);

alter table learning.signal_daily add column field text not null default 'none';
alter table learning.signal_daily
  drop constraint signal_daily_pkey,
  add primary key (day, stage, kind, cause, prompt_version, field);

create or replace function learning.aggregate()
returns integer
language plpgsql security definer
set search_path = learning, pg_temp
as $$
declare v_rows integer;
begin
  with batch as (
    select id, created_at::date as day, stage, kind,
           coalesce(cause::text, 'none') as cause, coalesce(prompt_version, 'none') as prompt_version,
           coalesce(field::text, 'none') as field
      from learning.signal where aggregated_at is null
     order by id limit 5000 for update skip locked
  ), counted as (
    select day, stage, kind, cause, prompt_version, field, count(*)::int as n from batch
     group by 1, 2, 3, 4, 5, 6
  ), upserted as (
    insert into learning.signal_daily (day, stage, kind, cause, prompt_version, field, n)
    select * from counted
    on conflict (day, stage, kind, cause, prompt_version, field)
    do update set n = learning.signal_daily.n + excluded.n
    returning 1
  )
  update learning.signal s set aggregated_at = now()
    from batch b where s.id = b.id;
  get diagnostics v_rows = row_count;
  return v_rows;
end; $$;

drop function if exists learning.signal_counts(date);
create function learning.signal_counts(p_since date default current_date - 30)
returns table (stage text, kind text, cause text, prompt_version text, field text, n bigint)
language sql stable security definer
set search_path = learning, pg_temp
as $$
  select d.stage, d.kind, d.cause, d.prompt_version, d.field, sum(d.n)::bigint
    from learning.signal_daily d
   where d.day >= p_since
   group by 1, 2, 3, 4, 5
  having sum(d.n) >= 5
$$;
revoke all on function learning.signal_counts(date) from public, anon, authenticated;
grant execute on function learning.signal_counts(date) to service_role;

-- ── 1 · extraction corrections in Review ───────────────────────────────────
-- Fires only on an explicit student review: the client sets a new
-- student_confirmed_at on every correct* and confirm* call, and the pipeline
-- never does, so a model re-read is never mistaken for a correction.
create or replace function learning.record_region_review()
returns trigger
language plpgsql security definer
set search_path = public, learning, pg_temp
as $$
declare
  v_prompt text;
  v_count  integer := 0;
  f        text;
begin
  if not learning.consented(new.student_id) then
    return null;
  end if;

  select mc.prompt_version into v_prompt
    from public.model_call mc
   where mc.region_id = new.id and mc.ok and mc.stage = 'content'
   order by mc.created_at desc limit 1;

  foreach f in array array[
    case when old.question_label  is distinct from new.question_label  then 'question_label'  end,
    case when old.question_text   is distinct from new.question_text   then 'question_text'   end,
    case when old.student_answer  is distinct from new.student_answer  then 'student_answer'  end,
    case when old.marks_awarded   is distinct from new.marks_awarded   then 'marks_awarded'   end,
    case when old.marks_available is distinct from new.marks_available then 'marks_available' end,
    case when old.teacher_remark  is distinct from new.teacher_remark  then 'teacher_remark'  end]
  loop
    continue when f is null;
    insert into learning.signal (student_id, region_id, kind, stage, field, confidence_before, prompt_version)
    values (new.student_id, new.id, 'field_corrected', 'extract', f::learning.extract_field, old.confidence_tier, v_prompt);
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    insert into learning.signal (student_id, region_id, kind, stage, confidence_before, prompt_version)
    values (new.student_id, new.id, 'region_confirmed', 'extract', old.confidence_tier, v_prompt);
  end if;
  return null;
end; $$;
revoke all on function learning.record_region_review() from public, anon, authenticated;

create trigger question_region_learning_review
  after update of student_confirmed_at on public.question_region
  for each row
  when (new.student_confirmed_at is not null and new.student_confirmed_at is distinct from old.student_confirmed_at)
  execute function learning.record_region_review();

-- ── 2 · "Not why I lost it" in Review ──────────────────────────────────────
create or replace function learning.record_review_cause_rejected()
returns trigger
language plpgsql security definer
set search_path = public, learning, pg_temp
as $$
begin
  if learning.consented(new.student_id) then
    insert into learning.signal (student_id, region_id, kind, stage, cause, prompt_version)
    values (new.student_id, new.region_id, 'cause_rejected', 'explain', old.cause,
            case when new.prompt_version ~ '^[A-Za-z0-9._-]{1,40}$' then new.prompt_version end);
  end if;
  return null;
end; $$;
revoke all on function learning.record_review_cause_rejected() from public, anon, authenticated;

create trigger region_explanation_learning_cause_rejected
  after update of cause on public.region_explanation
  for each row
  when (old.cause is not null and new.cause is null)
  execute function learning.record_review_cause_rejected();
