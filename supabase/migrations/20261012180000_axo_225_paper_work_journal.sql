-- AXO-225 slice 1: a durable journal of paid model outputs, keyed by what was
-- read rather than by which run read it.
--
-- Why: a run that times out is failed and its done pages are reset to pending
-- (private.sweep_stuck_runs), and the retry starts a NEW extraction_run. Nothing
-- carried the earlier paid answers across, so the two failed 9 Oct runs paid
-- $0.519 for work that was thrown away. This table lets a retry find the answer
-- it already paid for. A new run_id alone never invalidates a saved output.
--
-- What this is not: no outbox, no dispatcher and no change to run failure
-- semantics. Those need the backend dispatcher and are the next slice. Nothing
-- here changes behaviour until the backend turns the journal on (WORK_JOURNAL).
--
-- Privacy: outputs can restate a student's handwriting, so the table is private,
-- reachable only through the service-only functions below, removed with the paper
-- (cascade) and unreusable after 14 days (purged on the next begin for that paper).

create table private.paper_work_item (
  work_id            uuid primary key default gen_random_uuid(),
  paper_id           uuid not null,
  student_id         uuid not null,
  -- Bumped when source pages or authoritative inputs change. Every key below
  -- already changes with the content, so slice 1 only ever writes 1.
  generation         integer not null default 1 check (generation >= 1),
  stage              text not null check (stage ~ '^[a-z_]{1,32}$'),
  logical_unit_key   text not null check (length(logical_unit_key) between 1 and 200),
  -- Digest of the page/crop evidence (device sha256 of each page the model sees).
  input_digest       text not null check (input_digest ~ '^[0-9a-f]{64}$'),
  -- Digest of system text, instruction (which carries teacher marks, labels and
  -- page counts), schema name and thinking level: anything else that shapes the answer.
  prompt_digest      text not null check (prompt_digest ~ '^[0-9a-f]{64}$'),
  model_id           text not null check (length(model_id) between 1 and 200),
  prompt_version     text not null check (length(prompt_version) between 1 and 200),
  schema_version     text not null check (length(schema_version) between 1 and 200),
  status             text not null default 'ready'
                       check (status in ('ready', 'leased', 'output_saved', 'applied', 'retry_due', 'invalidated')),
  lease_owner_token  uuid,
  lease_expires_at   timestamptz,
  attempts           integer not null default 0 check (attempts >= 0),
  -- Leases that expired with no saved output. Each may have been billed by the
  -- provider with the answer lost, so this is reported, never hidden.
  unknown_outcomes   integer not null default 0 check (unknown_outcomes >= 0),
  -- Times a saved answer was handed back instead of paying again. A reused call
  -- writes no model_call row, so this (with output_meta.costUsd) is the evidence
  -- for what the journal saved.
  reuse_count        integer not null default 0 check (reuse_count >= 0),
  output             jsonb,
  output_meta        jsonb,
  output_checksum    text,
  output_saved_at    timestamptz,
  error_code         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '14 days',
  foreign key (paper_id, student_id) references public.paper (id, student_id) on delete cascade,
  constraint saved_states_carry_output check (
    status not in ('output_saved', 'applied') or (output is not null and output_checksum is not null)),
  constraint leased_has_owner check (
    status <> 'leased' or (lease_owner_token is not null and lease_expires_at is not null))
);

comment on table private.paper_work_item is
  'AXO-225: one unit of paid model work for one paper (a page, a question region), identified by its evidence and prompt digests plus model, prompt and schema versions. Service-only; outputs can contain student handwriting.';

-- The identity of reusable work. Deliberately has no run_id.
create unique index paper_work_item_identity_uq on private.paper_work_item (
  paper_id, stage, logical_unit_key, input_digest, prompt_digest, model_id, prompt_version, schema_version)
  where status <> 'invalidated';
create index paper_work_item_student_idx on private.paper_work_item (paper_id, student_id);
create index paper_work_item_expiry_idx on private.paper_work_item (expires_at);

alter table private.paper_work_item enable row level security;
revoke all on private.paper_work_item from public, anon, authenticated, service_role;
-- No policies and no grants: the SECURITY DEFINER functions below are the only door.

-- ── work_begin · find a saved answer, or claim the right to pay for one ──────
create function public.work_begin(
  p_paper_id uuid, p_student_id uuid, p_stage text, p_unit_key text,
  p_input_digest text, p_prompt_digest text, p_model_id text,
  p_prompt_version text, p_schema_version text,
  p_lease_seconds integer default 300)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v private.paper_work_item;
  v_token uuid := gen_random_uuid();
begin
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'lease must be 30 to 900 seconds' using errcode = '22023';
  end if;
  if not exists (select 1 from public.paper p where p.id = p_paper_id and p.student_id = p_student_id) then
    raise exception 'unknown paper for this student' using errcode = '42501';
  end if;

  -- Retention: saved answers are reusable for 14 days, then they go.
  delete from private.paper_work_item w where w.paper_id = p_paper_id and w.expires_at < now();

  insert into private.paper_work_item (
    paper_id, student_id, stage, logical_unit_key, input_digest, prompt_digest,
    model_id, prompt_version, schema_version)
  values (p_paper_id, p_student_id, p_stage, p_unit_key, p_input_digest, p_prompt_digest,
    p_model_id, p_prompt_version, p_schema_version)
  on conflict (paper_id, stage, logical_unit_key, input_digest, prompt_digest, model_id, prompt_version, schema_version)
    where status <> 'invalidated'
  do nothing;

  select * into v from private.paper_work_item w
   where w.paper_id = p_paper_id and w.stage = p_stage and w.logical_unit_key = p_unit_key
     and w.input_digest = p_input_digest and w.prompt_digest = p_prompt_digest
     and w.model_id = p_model_id and w.prompt_version = p_prompt_version
     and w.schema_version = p_schema_version and w.status <> 'invalidated'
   for update;

  if v.status in ('output_saved', 'applied') then
    update private.paper_work_item w set reuse_count = w.reuse_count + 1, updated_at = now() where w.work_id = v.work_id;
    return jsonb_build_object('action', 'reuse', 'work_id', v.work_id, 'status', v.status,
      'output', v.output, 'output_meta', v.output_meta, 'checksum', v.output_checksum);
  end if;

  if v.status = 'leased' and v.lease_expires_at > now() then
    return jsonb_build_object('action', 'busy', 'work_id', v.work_id,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from (v.lease_expires_at - now())))::integer));
  end if;

  -- ready, retry_due, or a lease that expired with nothing saved. The last may
  -- have been billed by the provider with the answer lost; count it.
  update private.paper_work_item w set
      status = 'leased',
      lease_owner_token = v_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = w.attempts + 1,
      unknown_outcomes = w.unknown_outcomes + (case when v.status = 'leased' then 1 else 0 end),
      error_code = null,
      updated_at = now()
   where w.work_id = v.work_id
   returning * into v;

  return jsonb_build_object('action', 'run', 'work_id', v.work_id, 'lease_token', v_token,
    'generation', v.generation, 'attempt', v.attempts, 'unknown_outcomes', v.unknown_outcomes);
end;
$$;

-- ── work_save_output · record the paid answer before anything downstream ─────
-- Only the current lease holder may save. A worker whose lease was taken over is
-- fenced: it learns it is stale and must not publish.
create function public.work_save_output(
  p_work_id uuid, p_lease_token uuid, p_output jsonb, p_output_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v private.paper_work_item;
begin
  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'output must be a JSON object' using errcode = '22023';
  end if;
  if pg_column_size(p_output) > 1048576 then
    raise exception 'output exceeds 1 MiB' using errcode = '54000';
  end if;
  select * into v from private.paper_work_item w where w.work_id = p_work_id for update;
  if not found then return jsonb_build_object('result', 'fenced'); end if;

  if v.status in ('output_saved', 'applied') then
    -- Idempotent: a retried save, or a second worker that lost the race, gets the
    -- stored answer so every reader downstream sees the same one.
    return jsonb_build_object('result', 'already_saved', 'output', v.output, 'output_meta', v.output_meta);
  end if;
  if v.status <> 'leased' or v.lease_owner_token is distinct from p_lease_token then
    return jsonb_build_object('result', 'fenced');
  end if;

  update private.paper_work_item w set
      status = 'output_saved',
      output = p_output,
      output_meta = coalesce(p_output_meta, '{}'::jsonb),
      output_checksum = encode(sha256(convert_to(p_output::text, 'UTF8')), 'hex'),
      output_saved_at = now(),
      lease_owner_token = null,
      lease_expires_at = null,
      updated_at = now()
   where w.work_id = v.work_id;
  return jsonb_build_object('result', 'saved');
end;
$$;

-- ── work_mark_applied · the downstream write landed ──────────────────────────
create function public.work_mark_applied(p_work_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update private.paper_work_item w set status = 'applied', updated_at = now()
   where w.work_id = p_work_id and w.status = 'output_saved';
  return exists (select 1 from private.paper_work_item w where w.work_id = p_work_id and w.status = 'applied');
end;
$$;

-- ── work_release · the call failed; let the next attempt claim at once ───────
create function public.work_release(p_work_id uuid, p_lease_token uuid, p_error_code text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  update private.paper_work_item w set
      status = 'retry_due',
      lease_owner_token = null,
      lease_expires_at = null,
      error_code = left(coalesce(p_error_code, 'unknown'), 100),
      updated_at = now()
   where w.work_id = p_work_id and w.status = 'leased' and w.lease_owner_token = p_lease_token;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- ── work_invalidate · a saved answer that the current code cannot accept ─────
create function public.work_invalidate(p_work_id uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_rows integer;
begin
  update private.paper_work_item w set
      status = 'invalidated',
      lease_owner_token = null,
      lease_expires_at = null,
      error_code = left(coalesce(p_reason, 'invalidated'), 100),
      updated_at = now()
   where w.work_id = p_work_id and w.status <> 'invalidated';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.work_begin(uuid, uuid, text, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.work_save_output(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.work_mark_applied(uuid) from public, anon, authenticated;
revoke all on function public.work_release(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.work_invalidate(uuid, text) from public, anon, authenticated;
grant execute on function public.work_begin(uuid, uuid, text, text, text, text, text, text, text, integer) to service_role;
grant execute on function public.work_save_output(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.work_mark_applied(uuid) to service_role;
grant execute on function public.work_release(uuid, uuid, text) to service_role;
grant execute on function public.work_invalidate(uuid, text) to service_role;

comment on function public.work_begin(uuid, uuid, text, text, text, text, text, text, text, integer) is
  'AXO-225: returns reuse (a saved answer exists, make no model call), busy (a live lease holds it) or run (you now hold the lease; pay once, then work_save_output). Service role only.';
comment on function public.work_save_output(uuid, uuid, jsonb, jsonb) is
  'AXO-225: saves the paid answer if the caller still holds the lease. A fenced caller must not publish. Service role only.';
