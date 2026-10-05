-- ══════════════════════════════════════════════════════════════════════════
-- Paper subject: automatic from triage, changeable by the student.
-- Topic tagging: a reconciliation queue the sweep drains. (2026-10-04)
-- ══════════════════════════════════════════════════════════════════════════
-- Owner decision (4 Oct 2026): when triage's suggested subject matches exactly
-- one of the student's own subjects, the paper gets that subject without a
-- tap; the student can change it. Until now the only path was an exact
-- assessment identity, which has never fired: all 45 production papers had no
-- subject, so per-subject insights and the syllabus heatmap had nothing to key on.
--
-- Three sources, in order of authority:
--   assessment_identity / verified   exact official assessment (unchanged)
--   student / student                the student chose it
--   triage / auto                    triage's high-confidence suggestion matched
--                                    exactly one of the student's subjects
-- An assessment identity still overrides everything. A student's choice is
-- never overwritten by triage.

-- ── 1. The consistency rule admits the two new sources ──────────────────
alter table public.paper drop constraint paper_verified_subject_consistent;
alter table public.paper add constraint paper_verified_subject_consistent check (
  (subject_offering_id is null and subject_display_snapshot is null and subject_external_code_snapshot is null
    and subject_identity_source is null and subject_identity_confidence is null and subject_verified_at is null)
  or (subject_offering_id is not null and subject_display_snapshot is not null and subject_verified_at is not null
    and (subject_identity_source, subject_identity_confidence) in
        (('assessment_identity', 'verified'), ('student', 'student'), ('triage', 'auto')))
);

-- ── 2. The trigger lets the two server functions below write ─────────────
-- They mark their write with a transaction-local setting. PostgREST exposes no
-- way to set it, and both functions validate everything they write.
create or replace function private.sync_paper_verified_subject()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_subject_offering uuid;
  v_display_name text;
  v_external_code text;
  v_mode text := coalesce(current_setting('axon.subject_write', true), '');
begin
  -- The two sanctioned subject writers (auto_assign_paper_subject and
  -- set_paper_subject). They never change assessment_identity_id.
  if tg_op = 'UPDATE' and v_mode in ('auto', 'student')
     and new.assessment_identity_id is not distinct from old.assessment_identity_id then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.subject_offering_id is not null
       or new.subject_display_snapshot is not null
       or new.subject_external_code_snapshot is not null
       or new.subject_identity_source is not null
       or new.subject_identity_confidence is not null
       or new.subject_verified_at is not null then
      raise exception 'verified subject snapshot is derived from assessment identity'
        using errcode = '22023', hint = 'verified_subject_server_authored';
    end if;
  elsif new.subject_offering_id is distinct from old.subject_offering_id
     or new.subject_display_snapshot is distinct from old.subject_display_snapshot
     or new.subject_external_code_snapshot is distinct from old.subject_external_code_snapshot
     or new.subject_identity_source is distinct from old.subject_identity_source
     or new.subject_identity_confidence is distinct from old.subject_identity_confidence
     or new.subject_verified_at is distinct from old.subject_verified_at then
    if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
      raise exception 'verified subject snapshot is server-authored'
        using errcode = '42501', hint = 'verified_subject_server_authored';
    end if;
    raise exception 'verified subject snapshot is derived from assessment identity'
      using errcode = '22023', hint = 'verified_subject_server_authored';
  end if;

  if coalesce(auth.jwt() ->> 'role', '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.assessment_identity_id is not null then
      raise exception 'assessment identity is server-authored'
        using errcode = '42501', hint = 'assessment_identity_server_authored';
    elsif tg_op = 'UPDATE'
      and new.assessment_identity_id is distinct from old.assessment_identity_id then
      raise exception 'assessment identity is server-authored'
        using errcode = '42501', hint = 'assessment_identity_server_authored';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.assessment_identity_id is not distinct from old.assessment_identity_id
     and (
       old.subject_offering_id is not null
       or old.subject_display_snapshot is not null
       or old.subject_identity_source is not null
       or old.subject_identity_confidence is not null
       or old.subject_verified_at is not null
     ) then
    return new;
  end if;

  -- No identity: keep whatever the student or triage set.
  if new.assessment_identity_id is null then
    return new;
  end if;

  select ai.subject_offering_id, so.display_name, so.external_code
    into v_subject_offering, v_display_name, v_external_code
    from public.assessment_identity ai
    left join public.subject_offering so on so.id = ai.subject_offering_id
   where ai.id = new.assessment_identity_id;

  if not found then
    raise exception 'unknown assessment identity'
      using errcode = '23503';
  end if;

  -- An identity without a subject keeps the student's or triage's subject
  -- rather than erasing it.
  if v_subject_offering is null then
    return new;
  end if;

  new.subject_offering_id := v_subject_offering;
  new.subject_display_snapshot := v_display_name;
  new.subject_external_code_snapshot := v_external_code;
  new.subject_identity_source := 'assessment_identity';
  new.subject_identity_confidence := 'verified';
  new.subject_verified_at := now();
  return new;
end;
$function$;

-- ── 3. Automatic assignment from triage ──────────────────────────────────
create or replace function private.auto_assign_paper_subject(p_paper_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_paper public.paper%rowtype;
  v_suggestion text;
  v_confidence text;
  v_norm text;
  v_matches uuid[];
  v_display text;
  v_code text;
begin
  select * into v_paper from public.paper where id = p_paper_id;
  if not found or v_paper.subject_offering_id is not null or v_paper.assessment_identity_id is not null then
    return false;
  end if;

  select nullif(btrim(r.tier_routing #>> '{triage,subject}'), ''), r.tier_routing #>> '{triage,confidence}'
    into v_suggestion, v_confidence
    from public.extraction_run r
   where r.paper_id = p_paper_id and nullif(btrim(r.tier_routing #>> '{triage,subject}'), '') is not null
   order by r.started_at desc nulls last
   limit 1;
  -- A low-confidence guess is shown as a suggestion only; it is not assigned.
  if v_suggestion is null or v_confidence is distinct from 'high' then
    return false;
  end if;

  v_norm := lower(regexp_replace(btrim(v_suggestion), '\s+', ' ', 'g'));
  select array_agg(distinct ss.subject_offering_id)
    into v_matches
    from public.student_subject ss
   where ss.student_id = v_paper.student_id
     and ss.subject_offering_id is not null
     and (
       v_norm = lower(regexp_replace(btrim(coalesce(ss.display_name_snapshot, ss.subject)), '\s+', ' ', 'g'))
       or v_norm = lower(regexp_replace(btrim(ss.subject), '\s+', ' ', 'g'))
       or (ss.external_code_snapshot is not null and v_norm ~ ('(^|[^0-9])' || ss.external_code_snapshot || '([^0-9]|$)'))
     );
  -- Exactly one of the student's own subjects, or nothing.
  if v_matches is null or array_length(v_matches, 1) <> 1 then
    return false;
  end if;

  select coalesce(so.display_name, ss.display_name_snapshot, ss.subject), coalesce(so.external_code, ss.external_code_snapshot)
    into v_display, v_code
    from public.student_subject ss
    left join public.subject_offering so on so.id = ss.subject_offering_id
   where ss.student_id = v_paper.student_id and ss.subject_offering_id = v_matches[1]
   limit 1;

  perform set_config('axon.subject_write', 'auto', true);
  update public.paper
     set subject_offering_id = v_matches[1],
         subject_display_snapshot = v_display,
         subject_external_code_snapshot = v_code,
         subject_identity_source = 'triage',
         subject_identity_confidence = 'auto',
         subject_verified_at = now()
   where id = p_paper_id and subject_offering_id is null;
  perform set_config('axon.subject_write', '', true);
  return found;
end;
$function$;

revoke all on function private.auto_assign_paper_subject(uuid) from public, anon, authenticated;

create or replace function private.on_run_triage_subject()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Never let subject assignment fail a pipeline write.
  begin
    perform private.auto_assign_paper_subject(new.paper_id);
  exception when others then
    raise warning 'auto subject assignment skipped for paper %: %', new.paper_id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function private.on_run_triage_subject() from public, anon, authenticated;

create trigger extraction_run_auto_subject
  after insert or update of tier_routing on public.extraction_run
  for each row
  when (new.tier_routing is not null)
  execute function private.on_run_triage_subject();

-- ── 4. The student changes (or clears) a paper's subject ─────────────────
create or replace function public.set_paper_subject(p_paper_id uuid, p_subject_offering_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_paper public.paper%rowtype;
  v_display text;
  v_code text;
begin
  select * into v_paper from public.paper where id = p_paper_id;
  if not found or not private.student_scope_allows(v_paper.student_id) then
    raise exception 'paper not found' using errcode = '42501';
  end if;
  if v_paper.subject_identity_source = 'assessment_identity' then
    raise exception 'this paper''s subject comes from its official assessment'
      using errcode = '22023', hint = 'subject_from_assessment_identity';
  end if;

  perform set_config('axon.subject_write', 'student', true);
  if p_subject_offering_id is null then
    update public.paper
       set subject_offering_id = null, subject_display_snapshot = null, subject_external_code_snapshot = null,
           subject_identity_source = null, subject_identity_confidence = null, subject_verified_at = null
     where id = p_paper_id;
  else
    select coalesce(so.display_name, ss.display_name_snapshot, ss.subject), coalesce(so.external_code, ss.external_code_snapshot)
      into v_display, v_code
      from public.student_subject ss
      left join public.subject_offering so on so.id = ss.subject_offering_id
     where ss.student_id = v_paper.student_id and ss.subject_offering_id = p_subject_offering_id
     limit 1;
    if not found then
      raise exception 'that subject is not one of this student''s subjects'
        using errcode = '22023', hint = 'subject_not_enrolled';
    end if;
    update public.paper
       set subject_offering_id = p_subject_offering_id, subject_display_snapshot = v_display,
           subject_external_code_snapshot = v_code, subject_identity_source = 'student',
           subject_identity_confidence = 'student', subject_verified_at = now()
     where id = p_paper_id;
  end if;
  perform set_config('axon.subject_write', '', true);
end;
$function$;

revoke all on function public.set_paper_subject(uuid, uuid) from public, anon;
grant execute on function public.set_paper_subject(uuid, uuid) to authenticated;
comment on function public.set_paper_subject(uuid, uuid) is
  'The student sets or clears a paper''s subject from their own subjects. Never overrides an official assessment identity.';

-- ── 5. Topic tagging queue ───────────────────────────────────────────────
create table private.topic_tag_job (
  region_id   uuid primary key references public.question_region (id) on delete cascade,
  document_id uuid not null references public.syllabus_document (id) on delete cascade,
  status      text not null check (status in ('queued', 'done', 'failed', 'no_match')),
  attempts    smallint not null default 0,
  last_error  text,
  queued_at   timestamptz not null default now(),
  finished_at timestamptz
);
create index topic_tag_job_document_idx on private.topic_tag_job (document_id);
alter table private.topic_tag_job enable row level security;
comment on table private.topic_tag_job is
  'Service-only state for the topic_tag stage: which syllabus each committed question was tagged against, and whether it worked.';

-- The syllabus a paper's questions are tagged against: the edition covering
-- the paper's year, else the newest. Draft documents are tagged too, so the
-- heatmap is ready the moment a person verifies the document.
create or replace function private.syllabus_for_paper(p_paper_id uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select d.id
    from public.paper p
    join public.subject_offering_syllabus sos on sos.subject_offering_id = p.subject_offering_id
    join public.syllabus_document d on d.id = sos.document_id and d.status <> 'retired'
   where p.id = p_paper_id
   order by (extract(year from p.date_taken)::int between coalesce(d.valid_from_year, 0) and coalesce(d.valid_to_year, 9999)) desc,
            d.valid_to_year desc nulls last,
            d.fetched_at desc
   limit 1;
$function$;
revoke all on function private.syllabus_for_paper(uuid) from public, anon, authenticated;

create or replace function public.claim_topic_tag_work(p_limit integer default 25)
returns table (region_id uuid, document_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
#variable_conflict use_column
begin
  return query
  with candidates as (
    select q.id as region_id, private.syllabus_for_paper(q.paper_id) as document_id, j.status, j.attempts, j.document_id as job_document, j.queued_at, j.finished_at
      from public.question_region q
      join public.paper p on p.id = q.paper_id and p.subject_offering_id is not null
      left join private.topic_tag_job j on j.region_id = q.id
     where q.committed_attempt_id is not null
       and nullif(btrim(coalesce(q.question_text, '')), '') is not null
  ), due as (
    select c.region_id, c.document_id
      from candidates c
     where c.document_id is not null
       and (
         c.status is null
         or c.job_document is distinct from c.document_id
         or (c.status = 'failed' and c.attempts < 3 and c.finished_at < now() - interval '30 minutes')
         -- A message lost after claiming is retried after an hour.
         or (c.status = 'queued' and c.queued_at < now() - interval '1 hour' and c.attempts < 3)
       )
     limit greatest(1, least(p_limit, 100))
  ), claimed as (
    insert into private.topic_tag_job as j (region_id, document_id, status, attempts, queued_at, finished_at, last_error)
    select d.region_id, d.document_id, 'queued', 1, now(), null, null from due d
    on conflict on constraint topic_tag_job_pkey do update
       set document_id = excluded.document_id,
           status = 'queued',
           attempts = case when j.document_id = excluded.document_id then j.attempts + 1 else 1 end,
           queued_at = now(), finished_at = null, last_error = null
    returning j.region_id, j.document_id
  )
  select claimed.region_id, claimed.document_id from claimed;
end;
$function$;

revoke all on function public.claim_topic_tag_work(integer) from public, anon, authenticated;
grant execute on function public.claim_topic_tag_work(integer) to service_role;

-- Writes one question's tags. Only topics from the claimed document are
-- accepted, so a model cannot attach a question to another syllabus.
create or replace function public.finish_topic_tags(
  p_region_id uuid, p_document_id uuid, p_tags jsonb, p_model text, p_prompt text, p_error text default null
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_student uuid;
  v_written integer := 0;
begin
  if not exists (select 1 from private.topic_tag_job where region_id = p_region_id and document_id = p_document_id) then
    return 0; -- superseded: the paper's subject or syllabus changed after the claim
  end if;
  if p_error is not null then
    update private.topic_tag_job set status = 'failed', last_error = left(p_error, 500), finished_at = now()
     where region_id = p_region_id;
    return 0;
  end if;

  select student_id into v_student from public.question_region where id = p_region_id;
  -- The model's earlier tags are replaced; a tag the student rejected stays rejected.
  delete from public.region_topic
   where region_id = p_region_id and source = 'model' and student_rejected_at is null;

  insert into public.region_topic (region_id, topic_id, student_id, confidence, is_primary, source, model_version, prompt_version)
  select p_region_id, t.id, v_student,
         case when tag ->> 'confidence' = 'likely' then 'likely'::public.confidence else 'unsure'::public.confidence end,
         coalesce((tag ->> 'is_primary')::boolean, false), 'model', p_model, p_prompt
    from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) tag
    join public.syllabus_topic t on t.id = (tag ->> 'topic_id')::uuid and t.document_id = p_document_id
  on conflict (region_id, topic_id) do nothing;
  get diagnostics v_written = row_count;

  update private.topic_tag_job
     set status = case when v_written > 0 then 'done' else 'no_match' end, finished_at = now(), last_error = null
   where region_id = p_region_id;
  return v_written;
end;
$function$;

revoke all on function public.finish_topic_tags(uuid, uuid, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.finish_topic_tags(uuid, uuid, jsonb, text, text, text) to service_role;

-- A changed subject retags the paper: drop the model's tags and the job rows,
-- and the sweep picks the questions up again against the new syllabus.
create or replace function private.on_paper_subject_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  delete from public.region_topic rt using public.question_region q
   where q.paper_id = new.id and rt.region_id = q.id and rt.source = 'model';
  delete from private.topic_tag_job j using public.question_region q
   where q.paper_id = new.id and j.region_id = q.id;
  return null;
end;
$function$;

revoke all on function private.on_paper_subject_change() from public, anon, authenticated;

create trigger paper_subject_retag
  after update of subject_offering_id on public.paper
  for each row
  when (new.subject_offering_id is distinct from old.subject_offering_id)
  execute function private.on_paper_subject_change();

-- ── 6. Backfill: existing papers get the same automatic assignment ────────
select private.auto_assign_paper_subject(id) from public.paper where subject_offering_id is null;
