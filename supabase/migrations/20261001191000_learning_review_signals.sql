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
