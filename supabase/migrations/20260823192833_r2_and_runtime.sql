-- ============================================================================
-- 0013 · R2 keys, the model ledger, and the queue runtime
-- ============================================================================
-- STORAGE_R2.md §9 and REVIEW_PIPELINE.md §4, layered onto the tables that
-- already exist rather than replacing them. The spec sketches `papers`, `pages`,
-- `questions`, `teacher_marks`, `explanations` — those are this schema's
-- `paper`, `paper_page`, `question_region`, `teacher_mark`, `region_explanation`
-- under different names, and renaming five tables to match a sketch would buy
-- nothing and break every query in `src/`. What the specs actually add is:
--
--   · object keys, because bytes moved from Supabase Storage to R2
--   · a cost ledger, because "is this viable" is a question we cannot answer
--     retroactively
--   · a routing table, because swapping a model must not need a redeploy
--   · queues and a tick, because an Edge Function has two seconds of CPU
--   · a deletion ledger, because a delete that silently fails and leaves a
--     minor's exam paper in a bucket is a compliance incident
--
-- The four hard rules are untouched. Nothing here gives the model a writable
-- mark column, invents a scheme, admits unsure data to analytics, or lets a
-- failure pass without a reason someone can read.
-- ============================================================================

-- ── paper_page · where the bytes are ───────────────────────────────────────
-- `storage_path` stays. It is not dead: rows ingested before R2 still point at
-- Supabase Storage, and a column that still describes live data is not legacy
-- just because new writes go elsewhere. New writes set r2_bucket + r2_key.

alter table public.paper_page
  add column if not exists r2_bucket          text,
  add column if not exists r2_key             text,
  add column if not exists mask_key           text,
  add column if not exists original_key       text,
  add column if not exists thumb_key          text,
  add column if not exists bytes              integer check (bytes is null or bytes > 0),
  add column if not exists sha256             text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists etag               text,
  add column if not exists preprocess_version text,
  add column if not exists structure_status   text  not null default 'pending';

comment on column public.paper_page.r2_key is
  'Key of the conditioned page in axon-derived. Carries a 16-byte nonce: presigned URLs go to third parties, so key structure must not be an enumeration surface if one leaks.';
comment on column public.paper_page.original_key is
  'The raw capture or source PDF page in axon-originals. Expires after 30 days by bucket lifecycle rule, so this may name an object that is gone — never a load-bearing read path.';
comment on column public.paper_page.mask_key is
  'The red-ink mask from IMAGE_PIPELINE stage 2, PNG and lossless. Sent alongside the page because lossy encoding costs a faint 1px tick most of its pixels, and a half-tick is partial credit.';
comment on column public.paper_page.sha256 is
  'Computed on device. Makes upload verification mean something beyond a size check, and lets the golden-set harness prove it ran on exactly the bytes a real device produced.';
comment on column public.paper_page.preprocess_version is
  'Which device pipeline produced these bytes. A scalar rather than a key inside conditioning_meta because every accuracy question is grouped by it, and the eval harness must never average two pipelines together.';

do $$ begin
  alter table public.paper_page
    add constraint r2_object_is_named_completely
    check ((r2_bucket is null) = (r2_key is null));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.paper_page
    add constraint r2_bucket_is_one_of_ours
    check (r2_bucket is null or r2_bucket in ('originals', 'derived'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.paper_page
    add constraint structure_status_is_known
    check (structure_status in ('pending', 'running', 'done', 'failed', 'unreadable'));
exception when duplicate_object then null; end $$;

-- An upload page needs bytes somewhere. The original constraint said "in
-- Supabase Storage"; it now says "in one of the two places we keep bytes",
-- which is the same rule surviving a move.
alter table public.paper_page drop constraint if exists upload_has_a_path;
do $$ begin
  alter table public.paper_page
    add constraint upload_has_bytes_somewhere
    check (source_kind <> 'upload' or storage_path is not null or r2_key is not null);
exception when duplicate_object then null; end $$;

-- ── question_region · the crops the review screen shows ────────────────────

alter table public.question_region
  add column if not exists crop_key       text,
  add column if not exists cropmask_key   text,
  add column if not exists extract_status text not null default 'pending';

do $$ begin
  alter table public.question_region
    add constraint extract_status_is_known
    check (extract_status in ('pending', 'running', 'done', 'failed'));
exception when duplicate_object then null; end $$;

comment on column public.question_region.crop_key is
  'Rendered crop in axon-derived, keyed by question id. Hard rule 4 is a UI promise before it is a data one: every field can be shown against the pixels it was read from, including the ones we could not read.';

-- ── extraction_run · runtime state ─────────────────────────────────────────
-- The spec hangs status off the paper. It hangs off the run here, because a
-- rescan starts a new run and a paper can therefore be in two states at once —
-- one finished, one in flight. Putting the state on the paper would make the
-- second overwrite the first's history, which is the history the pipeline is
-- measured by.

alter table public.extraction_run
  add column if not exists status_reason      text,
  add column if not exists heartbeat_at       timestamptz,
  add column if not exists preprocess_version text,
  add column if not exists adjudication       jsonb not null default '{}'::jsonb;

comment on column public.extraction_run.status_reason is
  'Why the run is where it is, in words a student can read. Hard rule 4: a stall with no reason is the invisible failure the rule exists to forbid.';
-- The spec puts total_awarded, total_available and reported_total here. They are
-- already on `paper`, which is where a fact read off the page belongs, and a
-- second copy on the run would be a second answer to "what did the teacher
-- write". Reconciliation's own output stays here as reconcile_delta.
comment on column public.extraction_run.adjudication is
  'What the adjudication pass concluded about a reconciliation gap. Advisory only: it may point at a region to re-read, and it may never change a mark.';

-- A failed run already had to say why. So does a rejected one — the student
-- photographed something, and "this is not a graded paper" is a sentence they
-- are owed.
alter table public.extraction_run drop constraint if exists failed_runs_say_why;
do $$ begin
  alter table public.extraction_run
    add constraint stopped_runs_say_why
    check (status not in ('failed', 'rejected') or status_reason is not null or failure_reason is not null);
exception when duplicate_object then null; end $$;

-- ── upload · a PDF or image on its way in ──────────────────────────────────
-- Bytes go device-to-bucket on a presigned URL and never pass through a
-- function, so the only evidence an upload happened is what the device claims
-- plus what a server-side HEAD confirms. `confirmed` is that HEAD, not the
-- device's word.

create table if not exists public.upload (
  id           uuid        primary key default gen_random_uuid(),
  paper_id     uuid        not null,
  student_id   uuid        not null,
  kind         text        not null check (kind in ('pdf', 'image')),
  r2_bucket    text        not null default 'originals' check (r2_bucket in ('originals', 'derived')),
  r2_key       text        not null,
  content_type text        not null,
  bytes        integer     check (bytes is null or bytes > 0),
  sha256       text        check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  etag         text,
  confirmed    boolean     not null default false,
  created_at   timestamptz not null default now(),

  unique (id, student_id),
  unique (r2_bucket, r2_key),
  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,

  -- A confirmed upload is one we looked at ourselves. Confirming without the
  -- size the HEAD returned would make the flag mean "the device said so".
  constraint confirmed_uploads_were_measured check (not confirmed or bytes is not null)
);

comment on table public.upload is
  'One object a device put in the originals bucket. Exists so an intent can be minted before the bytes land and reconciled after, without a function ever touching a pixel.';

-- ── r2_deletion · deleting is a job, not a hope ────────────────────────────

create table if not exists public.r2_deletion (
  id         bigserial   primary key,
  bucket     text        not null check (bucket in ('originals', 'derived')),
  prefix     text,
  key        text,
  attempts   integer     not null default 0 check (attempts >= 0),
  last_error text,
  done_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint names_exactly_one_target check ((prefix is null) <> (key is null))
);

comment on table public.r2_deletion is
  'The work list for making a deletion real. A row survives a failed delete and is retried: a delete that silently fails and leaves a minor''s exam paper in a bucket is a compliance incident, not a background-job hiccup.';

create index if not exists r2_deletion_pending_idx on public.r2_deletion (created_at)
  where done_at is null;

-- ── model_call · the ledger ────────────────────────────────────────────────
-- Not optional telemetry. It is the only way to answer "did that prompt change
-- help" and "is this business viable", and both questions arrive sooner than
-- expected. `model_id` is what actually served the request, which is not always
-- what we asked for — a fallback that quietly answers as a different model is
-- exactly the thing an eval must not average over.

create table if not exists public.model_call (
  id              bigserial   primary key,
  run_id          uuid,
  paper_id        uuid,
  region_id       uuid,
  student_id      uuid,
  stage           text        not null check (stage in
                    ('triage', 'structure', 'content', 'adjudicate', 'explain')),
  requested_model text        not null,
  model_id        text        not null,
  prompt_version  text        not null,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(12,6),
  latency_ms      integer,
  attempt         integer     not null default 1 check (attempt >= 1),
  ok              boolean     not null,
  error_code      text,
  -- The R2 keys of the images sent, never the presigned URLs. A signed URL in a
  -- log is a credential in a log, and it outlives the log line by ten minutes.
  image_keys      text[]      not null default '{}',
  created_at      timestamptz not null default now(),

  constraint failed_calls_carry_a_code check (ok or error_code is not null)
);

comment on table public.model_call is
  'Cost ledger, latency monitor and eval substrate. Records the model that served the call, not only the one requested.';
comment on column public.model_call.image_keys is
  'Object keys, never signed URLs. A presigned URL is a bearer credential with a ten-minute life; writing one here would put it somewhere it outlives its purpose.';

create index if not exists model_call_paper_idx  on public.model_call (paper_id);
create index if not exists model_call_run_idx    on public.model_call (run_id);
create index if not exists model_call_recent_idx on public.model_call (created_at desc);
create index if not exists model_call_stage_idx  on public.model_call (stage, created_at desc);

-- ── model_route · model choice is configuration ────────────────────────────
-- Swapping the content-pass model must not require a redeploy. Model IDs live
-- here and never in code.

create table if not exists public.model_route (
  stage          text        primary key check (stage in
                   ('triage', 'structure', 'content', 'adjudicate', 'explain')),
  primary_model  text        not null,
  fallbacks      text[]      not null default '{}',
  temperature    real        not null default 0 check (temperature >= 0 and temperature <= 2),
  max_tokens     integer     not null default 4096 check (max_tokens > 0),
  prompt_version text        not null,
  -- Off by default and never flipped by code. See openrouter.ts: a route that
  -- needs this is a route whose provider may train on the page, and the page is
  -- a named minor's exam script.
  allow_training boolean     not null default false,
  enabled        boolean     not null default true,
  notes          text,
  updated_at     timestamptz not null default now()
);

comment on table public.model_route is
  'One row per stage. Read at call time, not at deploy time, so a bad model can be swapped out while a paper is mid-flight.';
comment on column public.model_route.allow_training is
  'Relaxes the zero-data-retention requirement for this stage only. Default false everywhere and set by a human who has read what it means. Nothing in the codebase writes this column.';

-- ── who may read what ──────────────────────────────────────────────────────
-- upload and r2_deletion carry object keys; model_call and model_route carry
-- costs and model identities. The first is student data and follows the same
-- single-hop policy as everything else. The rest is operational and has no
-- student-facing read at all: RLS on with no policy denies every authenticated
-- role, and the service role bypasses it.

alter table public.upload      enable row level security;
alter table public.r2_deletion enable row level security;
alter table public.model_call  enable row level security;
alter table public.model_route enable row level security;

drop policy if exists upload_all_own on public.upload;
create policy upload_all_own on public.upload for all to authenticated
  using (exists (select 1 from public.student s
         where s.id = upload.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s
         where s.id = upload.student_id and s.guardian_id = private.current_guardian_id()));

comment on table public.r2_deletion is
  'The work list for making a deletion real. Service-role only: it is a queue of object keys, and a student who could read it could read keys belonging to rows they have already deleted.';

create index if not exists upload_paper_idx on public.upload (paper_id, created_at);

-- ── deletion, made real ────────────────────────────────────────────────────
-- Row deletion has to become object deletion, and it has to do so without the
-- caller remembering. Every path that removes a paper — the student tapping
-- delete, account erasure, a cascade from somewhere else — goes through these
-- triggers, because a rule enforced by remembering is a rule that lasts until
-- the second caller.
--
-- SECURITY DEFINER because the enqueue happens under the student's own session,
-- and r2_deletion is deliberately unreadable and unwritable to them.

create or replace function private.enqueue_paper_prefix_deletion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.r2_deletion (bucket, prefix)
  values ('originals', old.student_id || '/' || old.id || '/'),
         ('derived',   old.student_id || '/' || old.id || '/');

  -- The whole prefix is going. Child rows are about to cascade, and enqueuing
  -- their individual keys as well would be thousands of redundant DELETEs
  -- against a prefix that one walk already covers.
  perform set_config('axon.deleting_paper', '1', true);
  return old;
end; $$;

drop trigger if exists paper_prefix_deletion on public.paper;
create trigger paper_prefix_deletion before delete on public.paper
  for each row execute function private.enqueue_paper_prefix_deletion();

create or replace function private.enqueue_object_deletion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row    jsonb  := to_jsonb(old);
  v_fields text[] := case tg_table_name
                       when 'paper_page'      then array['r2_key', 'mask_key', 'thumb_key', 'original_key']
                       when 'question_region' then array['crop_key', 'cropmask_key']
                       else array['r2_key']
                     end;
  v_field  text;
  v_key    text;
begin
  if coalesce(current_setting('axon.deleting_paper', true), '') = '1' then
    return old;
  end if;

  -- Read through to_jsonb rather than old.<column>: plpgsql resolves every
  -- branch of a CASE against the record, so naming question_region's columns
  -- here would break the trigger on paper_page, where they do not exist.
  foreach v_field in array v_fields loop
    v_key := v_row ->> v_field;
    if v_key is not null then
      insert into public.r2_deletion (bucket, key)
      values (case
                when v_field = 'original_key' then 'originals'
                when tg_table_name = 'upload'  then coalesce(v_row ->> 'r2_bucket', 'originals')
                else 'derived'
              end, v_key);
    end if;
  end loop;
  return old;
end; $$;

drop trigger if exists paper_page_object_deletion on public.paper_page;
create trigger paper_page_object_deletion before delete on public.paper_page
  for each row execute function private.enqueue_object_deletion();

drop trigger if exists question_region_object_deletion on public.question_region;
create trigger question_region_object_deletion before delete on public.question_region
  for each row execute function private.enqueue_object_deletion();

drop trigger if exists upload_object_deletion on public.upload;
create trigger upload_object_deletion before delete on public.upload
  for each row execute function private.enqueue_object_deletion();

-- Account erasure is the same walk with a shorter prefix. Papers are deleted
-- first by delete_my_account(), so their per-paper prefixes are already
-- enqueued; this covers anything keyed under the student that no paper owns.
create or replace function private.enqueue_student_prefix_deletion()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.r2_deletion (bucket, prefix)
    values ('originals', new.id || '/'),
           ('derived',   new.id || '/');
  end if;
  return new;
end; $$;

drop trigger if exists student_prefix_deletion on public.student;
create trigger student_prefix_deletion after update of deleted_at on public.student
  for each row execute function private.enqueue_student_prefix_deletion();

-- The student-facing delete. Nothing here asks whether they are sure; the
-- consequence sheet has already said what will happen.
create or replace function public.delete_paper(p_paper_id uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_deleted integer;
begin
  delete from public.paper where id = p_paper_id;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'no such paper' using errcode = 'P0002';
  end if;
  return jsonb_build_object('deleted', true, 'paper_id', p_paper_id);
end; $$;

revoke all on function public.delete_paper(uuid) from public, anon;
grant execute on function public.delete_paper(uuid) to authenticated;

comment on function public.delete_paper(uuid) is
  'Deletes a paper and everything under it, including the objects. Runs as the caller so RLS decides whose paper it is.';

-- ── queues ─────────────────────────────────────────────────────────────────
-- pgmq rather than a status column polled by a cron job, because visibility
-- timeouts and per-message attempt counts are the two things a status column
-- gets wrong: two workers claiming one paper, and a crash leaving it claimed
-- forever.
--
-- Six queues, not the spec's four. `adjudicate` and `r2_delete` are queues here
-- because the dispatcher treats every worker identically, and a worker invoked
-- some other way is a worker with a second, untested failure mode.

-- Installed on the project already; created here so a bare Postgres running the
-- migrations for a schema check can stand in a stub instead.
do $$ begin
  if to_regnamespace('pgmq') is null then
    execute 'create extension pgmq';
  end if;
end $$;

do $$
declare q text;
begin
  foreach q in array array[
    'axon_triage', 'axon_structure', 'axon_content',
    'axon_adjudicate', 'axon_explain', 'axon_r2_delete'
  ] loop
    if not exists (select 1 from pgmq.list_queues() where queue_name = q) then
      perform pgmq.create(q);
    end if;
  end loop;
end $$;

-- ── the tick ───────────────────────────────────────────────────────────────
-- The cron entry needs a service key, which has no business in a file that is
-- committed to a repository. So the schedule is created by an operator calling
-- this once, with the key, out of band.

create or replace function private.schedule_pipeline_tick(
  p_functions_url text,
  p_service_key   text,
  p_schedule      text default '10 seconds'
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job text := 'axon-tick';
begin
  if p_functions_url is null or p_service_key is null then
    raise exception 'both the functions URL and the service key are required';
  end if;

  perform cron.unschedule(v_job) where exists (
    select 1 from cron.job where jobname = v_job);

  perform cron.schedule(v_job, p_schedule, format(
    $job$ select net.http_post(
            url     := %L,
            headers := jsonb_build_object(
                         'Authorization', 'Bearer ' || %L,
                         'Content-Type',  'application/json'),
            body    := '{}'::jsonb,
            timeout_milliseconds := 5000) $job$,
    rtrim(p_functions_url, '/') || '/queue-tick', p_service_key));

  return v_job;
end; $$;

revoke all on function private.schedule_pipeline_tick(text, text, text) from public, anon, authenticated;

comment on function private.schedule_pipeline_tick(text, text, text) is
  'Creates the 10-second dispatcher tick. Takes the service key as an argument so it is never committed; call it once per environment from a session that already holds the key.';

-- ── sweeps ─────────────────────────────────────────────────────────────────
-- Two ways a paper stalls invisibly, and hard rule 4 forbids both. A message
-- that exhausted its attempts is dead-lettered and its run is failed with a
-- reason; a run whose worker died mid-stage stops heartbeating and is failed
-- the same way. Neither is allowed to simply sit there looking busy.

create or replace function private.sweep_dead_letters(p_max_attempts integer default 5)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_queue text;
  v_msg   record;
  v_swept integer := 0;
begin
  foreach v_queue in array array[
    'axon_triage', 'axon_structure', 'axon_content',
    'axon_adjudicate', 'axon_explain'
  ] loop
    for v_msg in
      execute format(
        'select msg_id, read_ct, message from pgmq.q_%I where read_ct >= $1', v_queue)
      using p_max_attempts
    loop
      update public.extraction_run
         set status        = 'failed',
             status_reason = 'We could not finish reading this paper. Nothing was saved — you can try again.',
             finished_at   = coalesce(finished_at, now())
       where id = (v_msg.message ->> 'run_id')::uuid
         and status not in ('committed', 'failed', 'rejected');

      perform pgmq.archive(v_queue, v_msg.msg_id);
      v_swept := v_swept + 1;
    end loop;
  end loop;
  return v_swept;
end; $$;

create or replace function private.sweep_stuck_runs(p_stale interval default interval '10 minutes')
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_swept integer;
begin
  update public.extraction_run
     set status        = 'failed',
         status_reason = 'This paper stopped partway through. Nothing was saved — you can try again.',
         finished_at   = now()
   where status not in ('queued', 'needs_review', 'ready', 'committed', 'failed', 'rejected')
     and coalesce(heartbeat_at, started_at) < now() - p_stale;
  get diagnostics v_swept = row_count;
  return v_swept;
end; $$;

revoke all on function private.sweep_dead_letters(integer) from public, anon, authenticated;
revoke all on function private.sweep_stuck_runs(interval) from public, anon, authenticated;

comment on function private.sweep_stuck_runs(interval) is
  'Fails runs whose worker stopped heartbeating. A stall the student can see and retry is recoverable; a spinner that never resolves is the invisible failure hard rule 4 forbids.';

-- ── what the client watches ────────────────────────────────────────────────
-- One row per run, with the counts a progress screen needs and nothing it does
-- not. Deliberately not a percentage: a bar that reaches 90% and stops is a
-- worse lie than a state with a name.

create or replace view public.paper_progress with (security_invoker = true) as
select
  r.id            as run_id,
  r.paper_id,
  r.student_id,
  r.status,
  r.status_reason,
  r.started_at,
  r.finished_at,
  (select count(*) from public.paper_page p where p.paper_id = r.paper_id)          as pages_total,
  (select count(*) from public.paper_page p
    where p.paper_id = r.paper_id and p.structure_status = 'done')                  as pages_done,
  (select count(*) from public.question_region q where q.run_id = r.id)             as questions_total,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.extract_status = 'done')                            as questions_done,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.needs_review and q.student_confirmed_at is null)    as questions_needing_you
from public.extraction_run r;

grant select on public.paper_progress to authenticated;

comment on view public.paper_progress is
  'The progress screen''s only source. Named states and honest counts, never a synthetic percentage.';

-- ── seed the routes ────────────────────────────────────────────────────────
-- Free OpenRouter models, as asked for, so the pipeline can be exercised end to
-- end before a paid key exists. Read `notes` before trusting one with a real
-- student's paper: a free endpoint is usually free because the provider keeps
-- what you send it, and `allow_training` stays false, which means the client
-- will refuse the route rather than quietly relax the policy.

insert into public.model_route
  (stage, primary_model, fallbacks, temperature, max_tokens, prompt_version, notes)
values
  ('triage',     'google/gemma-4-31b-it:free',
                 array['google/gemma-4-26b-a4b-it:free'],
                 0, 512,  'triage.v1',
                 'Vision. One page, one question: is this a graded exam script?'),
  ('structure',  'google/gemma-4-31b-it:free',
                 array['google/gemma-4-26b-a4b-it:free'],
                 0, 4096, 'structure.v1',
                 'Vision. Page segmentation; boxes must be returned or the field does not exist.'),
  ('content',    'google/gemma-4-31b-it:free',
                 array['google/gemma-4-26b-a4b-it:free', 'dots-studio/dots-3-note-preview:free'],
                 0, 4096, 'content.v1',
                 'Vision, and the accuracy-critical stage. Expect to replace this with a paid model first.'),
  ('adjudicate', 'google/gemma-4-31b-it:free',
                 array['google/gemma-4-26b-a4b-it:free'],
                 0, 2048, 'adjudicate.v1',
                 'Vision. Reads a reconciliation gap and points at a region to re-read. Never at a mark.'),
  ('explain',    'openrouter/free',
                 array['google/gemma-4-31b-it:free'],
                 0.2, 2048, 'explain_tier1.v1',
                 'Text only. The one stage whose output a student reads as prose.')
on conflict (stage) do nothing;
