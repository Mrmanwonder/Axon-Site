-- ============================================================================
-- AXO-121 · the learning loop: student reviews become consent-gated,
-- pseudonymous, minimised evaluation signal
-- ============================================================================
-- Decided 2026-10-01: the learning store lives in Supabase, schema `learning`,
-- fed by triggers so no client path can skip it. Contract ported from the
-- intelligence Worker's D1 ledger, not its code.
--
-- What is recorded
--   * A student review of a region: the frontend sets student_confirmed_at
--     on every correction and confirmation (src/scan/review.js). Each reviewed
--     field that changed in that same update is one `field_corrected` event; a
--     review that changed nothing is one `region_confirmed` event (the
--     negatives calibration needs). Pipeline writes never set
--     student_confirmed_at, so they are never mistaken for corrections.
--   * "Not why I lost it" / "this helped" on a mark-loss explanation.
--
-- What is not
--   * Free text. question_text, student_answer and teacher_remark changes
--     are recorded as lengths only. Marks and labels are short structured
--     values and are kept, because the eval needs them.
--   * Identity. Events carry an HMAC pseudonym of the student; the key is
--     generated inside Vault when this migration runs and never appears in Git.
--
-- Consent: an event is always written (operational record). Queue items, the
-- only thing that can reach benchmarks or prompts, exist only while
-- `improve_extraction` is granted, and are REJECTED the moment it is withdrawn.
--
-- Deletion: every event hangs off its region or mark-loss event with
-- ON DELETE CASCADE, so paper deletion and account erasure purge it.
--
-- Never automatic training, never a write back to question_region: a student's
-- correction of a transcription is a fact about the transcription, and nothing
-- here can change a teacher's mark.
-- ============================================================================

create schema if not exists learning;
revoke all on schema learning from public, anon, authenticated;
grant usage on schema learning to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'learning_pseudonym_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                                'learning_pseudonym_key',
                                'AXO-121: HMAC key for learning.correction_event.student_key');
  end if;
end $$;

create table learning.correction_event (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  kind                text not null check (kind in ('field_corrected', 'region_confirmed', 'explanation_confirmed', 'explanation_rejected')),
  field               text check (field in ('question_label', 'question_text', 'student_answer', 'marks_awarded', 'marks_available', 'teacher_remark', 'cause')),
  region_id           uuid references public.question_region(id) on delete cascade,
  mark_loss_event_id  uuid references public.mark_loss_event(id) on delete cascade,
  run_id              uuid,
  student_key         text not null,
  predicted           jsonb,
  accepted            jsonb,
  confidence_before   text,
  model_id            text,
  prompt_version      text,
  constraint correction_event_has_subject check (region_id is not null or mark_loss_event_id is not null),
  -- Free-text fields carry {"length": n} and nothing else.
  constraint text_fields_carry_lengths_only check (
    field not in ('question_text', 'student_answer', 'teacher_remark')
    or ((predicted is null or (jsonb_typeof(predicted) = 'object' and predicted ? 'length' and predicted - 'length' = '{}'::jsonb))
    and (accepted  is null or (jsonb_typeof(accepted)  = 'object' and accepted  ? 'length' and accepted  - 'length' = '{}'::jsonb)))
  )
);
create index correction_event_region_idx on learning.correction_event (region_id);
create index correction_event_mle_idx on learning.correction_event (mark_loss_event_id);

comment on table learning.correction_event is
  'AXO-121. Immutable record of a student review. Pseudonymous; free-text fields as lengths only; purged with its region / mark-loss event.';

create table learning.queue_item (
  id                  bigint generated always as identity primary key,
  correction_event_id bigint not null references learning.correction_event(id) on delete cascade,
  target              text not null check (target in ('BENCHMARK_EXPANSION', 'CONFIDENCE_RECALIBRATION', 'PROMPT_REGRESSION', 'ERROR_CLUSTERING')),
  state               text not null default 'QUEUED' check (state in ('QUEUED', 'LABELLED', 'READY', 'REJECTED')),
  consent_seq         bigint,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (correction_event_id, target)
);

comment on table learning.queue_item is
  'AXO-121. Consent-gated routing of a correction event to an evaluation use. Created only under a current improve_extraction grant; REJECTED on withdrawal. Human review moves QUEUED -> LABELLED -> READY.';

revoke all on all tables in schema learning from public, anon, authenticated;
grant select, insert, update on learning.correction_event, learning.queue_item to service_role;

-- ── helpers ────────────────────────────────────────────────────────────────

create or replace function learning.student_key(p_student uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select encode(extensions.hmac(p_student::text,
                (select decrypted_secret from vault.decrypted_secrets where name = 'learning_pseudonym_key'),
                'sha256'), 'hex');
$$;

create or replace function learning.text_length(p text)
returns jsonb language sql immutable set search_path to '' as
$$ select case when p is null then null else jsonb_build_object('length', char_length(p)) end $$;

/** Queue an event for evaluation use, only under a current grant. */
create or replace function learning.route(p_event bigint, p_student uuid, p_targets text[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_guardian uuid;
  v_seq bigint;
begin
  select s.guardian_id into v_guardian from public.student s where s.id = p_student;
  if v_guardian is null or not private.consent_is_granted(v_guardian, p_student, 'improve_extraction') then
    return;
  end if;
  select max(ce.seq) into v_seq from public.consent_event ce
   where ce.guardian_id = v_guardian and ce.purpose = 'improve_extraction'
     and (ce.student_id = p_student or ce.student_id is null);
  insert into learning.queue_item (correction_event_id, target, consent_seq)
  select p_event, t, v_seq from unnest(p_targets) t
  on conflict do nothing;
end; $$;

-- ── region reviews ─────────────────────────────────────────────────────────

create or replace function learning.on_region_review()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_key     text := learning.student_key(new.student_id);
  v_model   text;
  v_prompt  text;
  v_event   bigint;
  v_changed integer := 0;
  f         record;
begin
  select mc.model_id, mc.prompt_version into v_model, v_prompt
    from public.model_call mc
   where mc.region_id = new.id and mc.ok and mc.stage = 'content'
   order by mc.created_at desc limit 1;

  for f in
    select * from (values
      ('question_label',  to_jsonb(old.question_label),        to_jsonb(new.question_label),        old.question_label  is distinct from new.question_label),
      ('marks_awarded',   to_jsonb(old.marks_awarded),         to_jsonb(new.marks_awarded),         old.marks_awarded   is distinct from new.marks_awarded),
      ('marks_available', to_jsonb(old.marks_available),       to_jsonb(new.marks_available),       old.marks_available is distinct from new.marks_available),
      ('question_text',   learning.text_length(old.question_text),  learning.text_length(new.question_text),  old.question_text  is distinct from new.question_text),
      ('student_answer',  learning.text_length(old.student_answer), learning.text_length(new.student_answer), old.student_answer is distinct from new.student_answer),
      ('teacher_remark',  learning.text_length(old.teacher_remark), learning.text_length(new.teacher_remark), old.teacher_remark is distinct from new.teacher_remark)
    ) as t(field, predicted, accepted, changed)
    where changed
  loop
    insert into learning.correction_event (kind, field, region_id, run_id, student_key, predicted, accepted, confidence_before, model_id, prompt_version)
    values ('field_corrected', f.field, new.id, new.run_id, v_key, f.predicted, f.accepted, old.confidence_tier::text, v_model, v_prompt)
    returning id into v_event;
    perform learning.route(v_event, new.student_id,
      array['BENCHMARK_EXPANSION', 'CONFIDENCE_RECALIBRATION', 'PROMPT_REGRESSION', 'ERROR_CLUSTERING']);
    v_changed := v_changed + 1;
  end loop;

  if v_changed = 0 then
    insert into learning.correction_event (kind, region_id, run_id, student_key, confidence_before, model_id, prompt_version)
    values ('region_confirmed', new.id, new.run_id, v_key, old.confidence_tier::text, v_model, v_prompt)
    returning id into v_event;
    perform learning.route(v_event, new.student_id, array['CONFIDENCE_RECALIBRATION']);
  end if;
  return null;
end; $$;

create trigger learning_region_review
  after update of student_confirmed_at on public.question_region
  for each row
  when (new.student_confirmed_at is not null and new.student_confirmed_at is distinct from old.student_confirmed_at)
  execute function learning.on_region_review();

-- ── explanation feedback ───────────────────────────────────────────────────

create or replace function learning.on_explanation_feedback()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_kind   text;
  v_region uuid;
  v_run    uuid;
  v_prompt text;
  v_model  text;
  v_event  bigint;
begin
  v_kind := case
    when new.student_rejected_at is not null and old.student_rejected_at is null then 'explanation_rejected'
    when new.student_confirmed_at is not null and old.student_confirmed_at is null then 'explanation_confirmed'
  end;
  if v_kind is null then return null; end if;

  select qr.id, qr.run_id into v_region, v_run
    from public.question_region qr where qr.committed_attempt_id = new.attempt_id limit 1;
  if v_region is not null then
    select re.prompt_version, re.model_version into v_prompt, v_model
      from public.region_explanation re where re.region_id = v_region order by re.generated_at desc limit 1;
  end if;

  insert into learning.correction_event (kind, field, region_id, mark_loss_event_id, run_id, student_key, predicted, accepted, confidence_before, model_id, prompt_version)
  values (v_kind, 'cause', v_region, new.id, v_run, learning.student_key(new.student_id),
          to_jsonb(new.cause::text), to_jsonb(v_kind = 'explanation_confirmed'), new.confidence::text, v_model, v_prompt)
  returning id into v_event;
  perform learning.route(v_event, new.student_id, array['PROMPT_REGRESSION', 'ERROR_CLUSTERING']);
  return null;
end; $$;

create trigger learning_explanation_feedback
  after update of student_confirmed_at, student_rejected_at on public.mark_loss_event
  for each row execute function learning.on_explanation_feedback();

-- In Review (before commit) "Not why I lost it" clears region_explanation.cause
-- (src/scan/review.js rejectCause). That is the common path, so it is recorded too.
create or replace function learning.on_review_cause_rejected()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_event bigint;
begin
  insert into learning.correction_event (kind, field, region_id, run_id, student_key, predicted, accepted, model_id, prompt_version)
  values ('explanation_rejected', 'cause', new.region_id, new.run_id, learning.student_key(new.student_id),
          to_jsonb(old.cause::text), to_jsonb(false), new.model_version, new.prompt_version)
  returning id into v_event;
  perform learning.route(v_event, new.student_id, array['PROMPT_REGRESSION', 'ERROR_CLUSTERING']);
  return null;
end; $$;

create trigger learning_review_cause_rejected
  after update of cause on public.region_explanation
  for each row
  when (old.cause is not null and new.cause is null)
  execute function learning.on_review_cause_rejected();

-- ── consent withdrawal ─────────────────────────────────────────────────────

create or replace function learning.on_consent_withdrawn()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update learning.queue_item qi
     set state = 'REJECTED', updated_at = now()
   where qi.state <> 'REJECTED'
     and qi.correction_event_id in (
       select e.id
         from learning.correction_event e
         left join public.question_region qr on qr.id = e.region_id
         left join public.mark_loss_event mle on mle.id = e.mark_loss_event_id
         join public.student s on s.id = coalesce(qr.student_id, mle.student_id)
        where s.guardian_id = new.guardian_id
          and (new.student_id is null or s.id = new.student_id));
  return null;
end; $$;

create trigger learning_consent_withdrawn
  after insert on public.consent_event
  for each row
  when (new.purpose = 'improve_extraction' and not new.granted)
  execute function learning.on_consent_withdrawn();

revoke all on all functions in schema learning from public, anon, authenticated;

-- ── aggregates: counts only, no values, no pseudonyms ──────────────────────

create view learning.correction_rate as
select date_trunc('week', created_at)::date as week, kind, field, model_id, prompt_version, confidence_before,
       count(*) as events
  from learning.correction_event
 group by 1, 2, 3, 4, 5, 6;

create view learning.calibration as
select confidence_before,
       count(*) filter (where kind = 'field_corrected')  as corrected_fields,
       count(distinct region_id) filter (where kind = 'field_corrected') as corrected_regions,
       count(*) filter (where kind = 'region_confirmed') as confirmed_regions
  from learning.correction_event
 where region_id is not null and kind in ('field_corrected', 'region_confirmed')
 group by 1;

revoke all on learning.correction_rate, learning.calibration from public, anon, authenticated;
grant select on learning.correction_rate, learning.calibration to service_role;
