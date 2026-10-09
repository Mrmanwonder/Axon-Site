-- ══════════════════════════════════════════════════════════════════════════
-- Syllabus topics and the per-subject topic heatmap (2026-10-04)
-- ══════════════════════════════════════════════════════════════════════════
-- Every board publishes its syllabus. This stores each one as a versioned
-- topic tree, tags every confirmed question to topics from that closed list,
-- and exposes the evidence through a security_invoker view so the heatmap
-- reads only what hard rule 3 allows.
--
-- Owner decision (4 Oct 2026): store the full learning-objective text, not
-- titles only, so help can cite the exact objective. The text lives in the
-- database only: Axon-Site is a public repository, so it holds the parser
-- (scripts/syllabus/) and a manifest of source URLs and SHA-256 checksums
-- (curriculum/syllabi/sources.json) from which the rows are reproducible. Provenance is kept on the
-- document (source URL, checksum, version, fetch time) and a document is shown
-- to students only once it is `verified` — a parsed syllabus is a claim about
-- what a board requires, and it is checked by a person before it is used.
--
-- What a tag is: the backend's topic_tag stage reads one confirmed question
-- and picks topic ids from the subject's verified list. It cannot invent a
-- topic (the id must exist, enforced by the foreign key) and it never touches
-- marks. A student can reject a tag; a rejected tag leaves the heatmap.

create table public.syllabus_document (
  id               uuid primary key default gen_random_uuid(),
  provider_key     text not null check (provider_key in ('cambridge', 'cbse', 'ib')),
  syllabus_code    text not null check (length(btrim(syllabus_code)) > 0),
  title            text not null check (length(btrim(title)) > 0),
  version_label    text not null check (length(btrim(version_label)) > 0),
  valid_from_year  smallint,
  valid_to_year    smallint,
  source_url       text not null check (source_url ~ '^https://'),
  source_sha256    text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  fetched_at       timestamptz not null,
  status           text not null default 'draft' check (status in ('draft', 'verified', 'retired')),
  verified_at      timestamptz,
  verified_by      text,
  extraction_notes text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider_key, syllabus_code, version_label),
  check (valid_to_year is null or valid_from_year is null or valid_to_year >= valid_from_year),
  check (status <> 'verified' or verified_at is not null)
);

comment on table public.syllabus_document is
  'One published syllabus version, as fetched from the board. Students see a document only once it is verified by a person. Provenance (source_url, source_sha256, fetched_at) is mandatory.';

create table public.syllabus_topic (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references public.syllabus_document (id) on delete cascade,
  parent_id           uuid references public.syllabus_topic (id) on delete cascade,
  code                text not null check (length(btrim(code)) > 0),
  kind                text not null check (kind in ('unit', 'topic', 'objective')),
  title               text not null check (length(btrim(title)) > 0),
  -- Verbatim learning-objective text from the published syllabus, and the
  -- board's own notes or examples beside it. The ingest refuses any objective
  -- whose words it cannot find, in order, in the source document.
  objective_text      text,
  notes_text          text,
  -- A sub-heading inside a topic ("Sound" under 1.2 Multimedia).
  group_title         text,
  -- Cambridge AS/A Level syllabi mark content as AS or A Level only.
  qualification_scope text check (qualification_scope in ('AS', 'A', 'IGCSE_CORE', 'IGCSE_EXTENDED', 'SL', 'HL')),
  sort_order          integer not null,
  depth               smallint not null check (depth between 0 and 4),
  source_page         smallint,
  created_at          timestamptz not null default now(),
  unique (document_id, kind, code)
);

create index syllabus_topic_document_idx on public.syllabus_topic (document_id, sort_order);
create index syllabus_topic_parent_idx on public.syllabus_topic (parent_id);

comment on table public.syllabus_topic is
  'The topic tree of one syllabus document: units, topics and verbatim learning objectives.';

-- Which syllabus a subject offering is taught from. Several offerings (AS and
-- A Level of 9709, say) share one document.
create table public.subject_offering_syllabus (
  subject_offering_id uuid not null references public.subject_offering (id) on delete cascade,
  document_id         uuid not null references public.syllabus_document (id) on delete cascade,
  primary key (subject_offering_id, document_id)
);
create index subject_offering_syllabus_document_idx on public.subject_offering_syllabus (document_id);

-- Topic tags on a question region. The region, not the attempt, is tagged:
-- tagging runs once the student confirms the reading, which can be before the
-- commit that creates the attempt. The view joins through committed_attempt_id.
create table public.region_topic (
  region_id           uuid not null references public.question_region (id) on delete cascade,
  topic_id            uuid not null references public.syllabus_topic (id) on delete cascade,
  student_id          uuid not null references public.student (id) on delete cascade,
  confidence          public.confidence not null,
  is_primary          boolean not null default false,
  source              text not null default 'model' check (source in ('model', 'student')),
  model_version       text,
  prompt_version      text,
  student_rejected_at timestamptz,
  created_at          timestamptz not null default now(),
  primary key (region_id, topic_id)
);
create index region_topic_student_idx on public.region_topic (student_id);
create index region_topic_topic_idx on public.region_topic (topic_id);

comment on table public.region_topic is
  'Syllabus topics a confirmed question assesses, picked by the topic_tag stage from the closed topic list. Never a mark. A student-rejected tag leaves analytics.';

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.syllabus_document enable row level security;
alter table public.syllabus_topic enable row level security;
alter table public.subject_offering_syllabus enable row level security;
alter table public.region_topic enable row level security;

create policy syllabus_document_read_verified on public.syllabus_document
  for select to authenticated using (status = 'verified');
create policy syllabus_topic_read_verified on public.syllabus_topic
  for select to authenticated using (
    exists (select 1 from public.syllabus_document d where d.id = syllabus_topic.document_id and d.status = 'verified'));
create policy subject_offering_syllabus_read on public.subject_offering_syllabus
  for select to authenticated using (true);

create policy region_topic_select_scope on public.region_topic
  for select to authenticated using (private.student_scope_allows(student_id));
-- The only client write is rejecting (or restoring) a tag; the column grant
-- below keeps every other column server-written.
create policy region_topic_update_scope on public.region_topic
  for update to authenticated using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

revoke all on public.region_topic from anon, authenticated;
grant select on public.region_topic to authenticated;
grant update (student_rejected_at) on public.region_topic to authenticated;
revoke all on public.syllabus_document, public.syllabus_topic, public.subject_offering_syllabus from anon;
grant select on public.syllabus_document, public.syllabus_topic, public.subject_offering_syllabus to authenticated;

-- ── The evidence the heatmap reads ───────────────────────────────────────
-- One row per eligible attempt × accepted topic tag. Eligibility is the
-- attempt_analytics boundary (hard rule 3) plus: the tag is not unsure, not
-- rejected, and its document is verified.
create view public.topic_evidence with (security_invoker = true) as
select
  a.id            as attempt_id,
  a.student_id,
  a.paper_id,
  rt.topic_id,
  t.document_id,
  rt.is_primary,
  rt.confidence,
  a.max_marks,
  a.marks_awarded,
  (select count(*) from public.region_topic r2
    where r2.region_id = q.id and r2.student_rejected_at is null and r2.confidence <> 'unsure') as topics_on_question
from public.attempt_analytics a
join public.question_region q on q.committed_attempt_id = a.id
join public.region_topic rt on rt.region_id = q.id
join public.syllabus_topic t on t.id = rt.topic_id
join public.syllabus_document d on d.id = t.document_id
where rt.student_rejected_at is null
  and rt.confidence <> 'unsure'
  and d.status = 'verified';

comment on view public.topic_evidence is
  'Eligible attempts joined to accepted syllabus topic tags, for the per-subject topic heatmap. Reads through attempt_analytics, so unsure readings never count.';

grant select on public.topic_evidence to authenticated;

-- ── The tagging route ────────────────────────────────────────────────────
-- topic_tag joins the stage lists on model_route and model_call.
alter table public.model_route drop constraint model_route_stage_check;
alter table public.model_route add constraint model_route_stage_check
  check (stage = any (array['triage','structure','content','adjudicate','explain','tutor','topic_tag']));
alter table public.model_call drop constraint model_call_stage_check;
alter table public.model_call add constraint model_call_stage_check
  check (stage = any (array['triage','structure','content','adjudicate','explain','tutor','topic_tag']));

-- Model IDs live here, never in code. Text only; the stage sees one question's
-- text and the subject's topic list, never the student's identity.
insert into public.model_route
  (stage, primary_model, provider, fallbacks, temperature, max_tokens, prompt_version, thinking_level, allow_training, enabled, notes)
values
  ('topic_tag', 'gemini-3.8-flash', 'ai_studio', '{}'::text[], 0, 2048, 'topic_tag.v1', 'medium', false, true,
   'Picks syllabus topic ids for one confirmed question from a closed list. Never sees or writes marks.')
on conflict (stage) do nothing;

-- Replay-order recovery (AXO-221): this unchanged topic-tagging block was
-- originally recorded in 20261004110000_paper_subject_auto_and_topic_tagging.
-- Production had its syllabus prerequisites before that recording. A fresh
-- replay needs the block here, after syllabus_document/region_topic exist.
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
