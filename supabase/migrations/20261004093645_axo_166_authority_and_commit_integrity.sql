-- AXO-166: client fields cannot confer server authority.
create or replace function private.asset_key_owned(p_key text, p_student uuid, p_paper uuid)
returns boolean language sql immutable set search_path = ''
as $$ select p_key is not null and p_student is not null and p_paper is not null
  and starts_with(p_key, p_student::text || '/' || p_paper::text || '/')
  and p_key !~ '(^|/)\.{1,2}(/|$)' and position('%' in p_key) = 0 and position(chr(92) in p_key) = 0; $$;
revoke all on function private.asset_key_owned(text, uuid, uuid) from public, anon;
grant execute on function private.asset_key_owned(text, uuid, uuid) to authenticated;

-- Invoker deliberately: trusted erasure/commit definers execute as the owner,
-- while a direct PostgREST write still executes as authenticated.
create or replace function private.guard_student_tombstone()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon')
     and ((tg_op = 'INSERT' and new.deleted_at is not null)
       or (tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at))
     and not private.has_fresh_auth() then
    raise exception 'Fresh Parent Mode required for student deletion or restoration'
      using errcode = '42501', hint = 'parent_mode_required';
  end if;
  return new;
end; $$;
create trigger student_tombstone_authority before insert or update on public.student
for each row execute function private.guard_student_tombstone();

revoke insert, update, delete on public.upload from authenticated, anon;

create or replace function private.guard_page_assets()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_field text;
  v_key text;
  v_bucket text;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'UPDATE' then v_old := to_jsonb(old); end if;
  foreach v_field in array array['r2_key','mask_key','thumb_key','original_key'] loop
    v_key := v_new ->> v_field;
    if v_key is null then continue; end if;
    if tg_op = 'UPDATE' and v_key is not distinct from (v_old ->> v_field)
       and new.student_id = old.student_id and new.paper_id = old.paper_id
       and new.r2_bucket is not distinct from old.r2_bucket then continue; end if;
    v_bucket := case when v_field = 'original_key' then 'originals'
                     when v_field = 'r2_key' then new.r2_bucket else 'derived' end;
    if not private.asset_key_owned(v_key, new.student_id, new.paper_id)
       or not exists (select 1 from public.upload u
                      where u.student_id = new.student_id and u.paper_id = new.paper_id
                        and u.r2_key = v_key and u.r2_bucket = v_bucket and u.confirmed) then
      raise exception 'Page asset must be a confirmed upload belonging to this paper' using errcode = '42501';
    end if;
  end loop;
  return new;
end; $$;
create trigger paper_page_asset_authority before insert or update on public.paper_page
for each row execute function private.guard_page_assets();

create or replace function private.guard_region_authority()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and (new.committed_attempt_id is not null or new.crop_key is not null or new.cropmask_key is not null))
    or (tg_op = 'UPDATE' and (new.committed_attempt_id is distinct from old.committed_attempt_id
      or new.crop_key is distinct from old.crop_key or new.cropmask_key is distinct from old.cropmask_key))
  ) then
    raise exception 'Committed pointers and crop keys are server-authored' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger question_region_server_authority before insert or update on public.question_region
for each row execute function private.guard_region_authority();

create or replace function private.guard_run_commit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
    (tg_op = 'INSERT' and (new.committed_at is not null or new.status = 'committed'))
    or (tg_op = 'UPDATE' and (new.committed_at is distinct from old.committed_at
        or (new.status = 'committed' and old.status <> 'committed')))
  ) then raise exception 'Only the commit RPC may commit a run' using errcode = '42501'; end if;
  return new;
end; $$;
create trigger extraction_run_commit_authority before insert or update on public.extraction_run
for each row execute function private.guard_run_commit();

alter table public.student_attempt add constraint student_attempt_owner_paper_unique unique(id,student_id,paper_id);
alter table public.question_region add constraint question_region_committed_owner
foreign key(committed_attempt_id,student_id,paper_id)
references public.student_attempt(id,student_id,paper_id) not valid;
create index if not exists question_region_committed_owner_idx
on public.question_region(committed_attempt_id,student_id,paper_id);

revoke all on function private.guard_student_tombstone() from public, anon, authenticated;
revoke all on function private.guard_page_assets() from public, anon, authenticated;
revoke all on function private.guard_region_authority() from public, anon, authenticated;
revoke all on function private.guard_run_commit() from public, anon, authenticated;

create or replace function private.sync_explanation_to_loss_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.question_region;
  v_conf public.confidence;
begin
  select * into r from public.question_region where id = new.region_id;
  if r.id is null or r.committed_attempt_id is null then
    return new;
  end if;
  if new.student_id <> r.student_id or new.run_id <> r.run_id
     or not exists (select 1 from public.student_attempt a
                    where a.id = r.committed_attempt_id and a.student_id = r.student_id and a.paper_id = r.paper_id) then
    raise exception 'Explanation ownership does not match the committed attempt' using errcode = '42501';
  end if;
  if new.cause is null or new.marks_lost is null
     or r.marks_awarded is null or r.marks_available is null
     or new.marks_lost > r.marks_available - r.marks_awarded then
    return new;
  end if;

  v_conf := case when r.confidence_tier = 'confident' then 'likely'::public.confidence
                 else 'unsure'::public.confidence end;

  update public.mark_loss_event m
     set cause = new.cause,
         marks_lost = new.marks_lost,
         ai_explanation = new.body,
         do_this_next = new.do_this_next,
         concepts = coalesce(new.concepts, '{}'),
         command_word = new.command_word,
         command_word_note = new.command_word_note,
         model_answer = new.model_answer,
         loss_reasons = coalesce(new.loss_reasons, '[]'::jsonb),
         grounding_status = new.grounding_status,
         model_answer_source = new.model_answer_source,
         depends_on_parts = coalesce(new.depends_on_parts, '{}'),
         unresolved_parts = coalesce(new.unresolved_parts, '{}'),
         confidence = v_conf,
         student_confirmed_at = case when m.ai_explanation is distinct from new.body
                                     then null else m.student_confirmed_at end
   where m.attempt_id = r.committed_attempt_id
     and m.student_id = r.student_id
     and m.student_rejected_at is null;

  if not found
     and not exists (select 1 from public.mark_loss_event m where m.attempt_id = r.committed_attempt_id) then
    insert into public.mark_loss_event (
      attempt_id, student_id, cause, marks_lost, ai_explanation, do_this_next, confidence,
      concepts, command_word, command_word_note, model_answer, loss_reasons,
      grounding_status, model_answer_source, depends_on_parts, unresolved_parts)
    values (
      r.committed_attempt_id, new.student_id, new.cause, new.marks_lost, new.body, new.do_this_next, v_conf,
      coalesce(new.concepts, '{}'), new.command_word, new.command_word_note, new.model_answer,
      coalesce(new.loss_reasons, '[]'::jsonb),
      new.grounding_status, new.model_answer_source,
      coalesce(new.depends_on_parts, '{}'), coalesce(new.unresolved_parts, '{}'));
  end if;
  return new;
end;
$$;
CREATE OR REPLACE FUNCTION private.enqueue_object_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
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
    -- Historical rows may predate the assignment guard. Never turn a foreign
    -- key on such a row into a privileged delete of another student's object.
    if v_key is not null and private.asset_key_owned(v_key, (v_row ->> 'student_id')::uuid, (v_row ->> 'paper_id')::uuid) then
      insert into public.r2_deletion (bucket, key)
      values (case
                when v_field = 'original_key' then 'originals'
                when tg_table_name in ('upload', 'paper_page') and v_field = 'r2_key' then coalesce(v_row ->> 'r2_bucket', 'originals')
                else 'derived'
              end, v_key);
    end if;
  end loop;
  return old;
end; $function$
;
create or replace function public.commit_extraction_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run       public.extraction_run;
  v_paper     public.paper;
  v_pending   integer;
  v_region    public.question_region;
  v_attempt   uuid;
  v_committed integer := 0;
  v_dupes     integer;
  v_skipped   integer := 0;
begin
  select * into v_run from public.extraction_run where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'no such extraction run' using errcode = 'P0002';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('role', true), 'none') not in ('none', 'postgres', 'service_role')
     and not private.student_scope_allows(v_run.student_id) then
    raise exception 'active student scope required' using errcode = '42501';
  end if;
  if v_run.committed_at is not null then
    raise exception 'this run is already committed' using errcode = '23505';
  end if;

  select * into v_paper from public.paper where id = v_run.paper_id;

  perform 1 from public.question_region where run_id = p_run_id for update;
  if exists (select 1 from public.question_region where run_id = p_run_id
             and (student_id <> v_run.student_id or paper_id <> v_run.paper_id)) then
    raise exception 'Region ownership does not match its run' using errcode = '42501';
  end if;

  select count(*) into v_pending
  from public.question_region r
  where r.run_id = p_run_id
    and r.needs_review
    and r.student_confirmed_at is null;

  if v_pending > 0 then
    raise exception '% question(s) still need review before this paper can be saved', v_pending
      using errcode = '42501';
  end if;

  if coalesce((v_run.adjudication ->> 'blocks_commit')::boolean, false) then
    raise exception 'this paper needs a person to look at it first: %',
      coalesce(v_run.adjudication ->> 'blocked_reason', 'the adjudication reported a structural problem')
      using errcode = '42501';
  end if;

  select count(*) into v_dupes from (
    select lower(regexp_replace(question_label, '[^A-Za-z0-9]', '', 'g')) k
      from public.question_region
     where run_id = p_run_id and question_label is not null
     group by 1 having count(*) > 1
  ) d;
  if v_dupes > 0 then
    raise exception 'this paper has % question(s) read twice, so the marks may be on the wrong one', v_dupes
      using errcode = '42501';
  end if;

  for v_region in
    select * from public.question_region
    where run_id = p_run_id
    order by order_index for update
  loop
    if v_region.confidence_tier = 'unreadable' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_region.marks_awarded is null or v_region.marks_available is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.student_attempt (
      student_id, paper_id, paper_tier, canonical_question_id,
      question_label, question_text,
      student_answer, answer_block, marks_awarded, max_marks, marks_source, teacher_remark,
      extraction_confidence,
      student_confirmed_at
    ) values (
      v_region.student_id, v_region.paper_id, v_paper.tier,
      case when v_paper.tier = 'tier_2' then v_region.canonical_question_id end,
      coalesce(v_region.question_label, 'Q' || (v_region.order_index + 1)),
      v_region.question_text, v_region.student_answer, v_region.answer_block,
      v_region.marks_awarded, v_region.marks_available,
      'teacher_pen',
      v_region.teacher_remark,
      case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
           else 'unsure'::public.confidence end,
      v_region.student_confirmed_at
    )
    returning id into v_attempt;

    update public.question_region
       set committed_attempt_id = v_attempt, updated_at = now()
     where id = v_region.id;

    insert into public.mark_loss_event (
      attempt_id, student_id, cause, marks_lost, ai_explanation, do_this_next, confidence,
      concepts,
      command_word, command_word_note, model_answer, loss_reasons,
      grounding_status, model_answer_source, depends_on_parts, unresolved_parts
    )
    select v_attempt, e.student_id, e.cause, e.marks_lost, e.body, e.do_this_next,
           case when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
                else 'unsure'::public.confidence end,
           coalesce(e.concepts, '{}'),
           e.command_word, e.command_word_note, e.model_answer,
           coalesce(e.loss_reasons, '[]'::jsonb),
           e.grounding_status, e.model_answer_source,
           coalesce(e.depends_on_parts, '{}'),
           coalesce(e.unresolved_parts, '{}')
      from public.region_explanation e
     where e.region_id = v_region.id
       and e.student_id = v_region.student_id
       and e.run_id = p_run_id
       and e.cause is not null
       and e.marks_lost is not null
       and e.marks_lost <= v_region.marks_available - v_region.marks_awarded;

    v_committed := v_committed + 1;
  end loop;

  -- The paper's totals are the sum of the marks the student confirmed, which may differ from the
  -- first reading. Left null when nothing was committed rather than shown as zero.
  -- The paper's totals are the sum of the marks the student confirmed. When the paper printed no
  -- total the figure is Axon's own addition (total_basis = 'added_up'), and it is a lower bound
  -- (total_partial) when a question's mark could not be read. Left alone when nothing committed.
  update public.paper p
     set total_awarded   = s.awarded,
         total_available = s.available,
         total_basis     = case when v_paper.reported_total is not null then 'printed' else 'added_up' end,
         reconciled = case when v_paper.reported_total is null or s.awarded is null then null
                           else s.awarded = v_paper.reported_total end,
         total_partial = v_skipped > 0 or exists (
           select 1 from public.page_unreadable u
           join public.paper_page pg on pg.paper_id = u.paper_id and pg.student_id = u.student_id and pg.page_number = u.page_number
           where u.paper_id = v_run.paper_id and u.student_id = v_run.student_id
             and pg.structure_status in ('unreadable', 'failed')
         )
    from (select sum(marks_awarded) awarded, sum(max_marks) available
            from public.student_attempt where paper_id = v_run.paper_id and student_id = v_run.student_id) s
   where p.id = v_run.paper_id and v_committed > 0;

  update public.extraction_run
     set status = 'committed', committed_at = now(), finished_at = coalesce(finished_at, now())
   where id = p_run_id;

  return jsonb_build_object(
    'run_id', p_run_id,
    'attempts_committed', v_committed,
    'reconciled', v_run.reconciled,
    'reconcile_delta', v_run.reconcile_delta
  );
end;
$function$;

revoke all on function public.commit_extraction_run(uuid) from public, anon;
grant execute on function public.commit_extraction_run(uuid) to authenticated, service_role;
create or replace function public.submit_paper(
  p_student_id      uuid,
  p_type            public.paper_type,
  p_tier            public.paper_tier,
  p_date_taken      date,
  p_subject         text,
  p_pages           jsonb,
  p_idempotency_key uuid,
  p_reported_total  numeric default null,
  p_stated_maximum  numeric default null,
  p_pipeline_version text default '1.0.0',
  p_paper_id        uuid default null
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_paper       public.paper;
  v_run_id      uuid;
  v_page        jsonb;
  v_created     boolean := false;
  v_run_created boolean := false;
  v_source_changed boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not private.student_scope_allows(p_student_id) then
    raise exception 'active student scope required'
      using errcode = '42501', hint = 'student_scope_required';
  end if;

  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
    raise exception 'a paper needs at least one page' using errcode = '22023';
  end if;

  if p_paper_id is not null then
    select * into v_paper
      from public.paper
     where id = p_paper_id
       and student_id = p_student_id;
  end if;

  if v_paper.id is null and p_paper_id is not null then
    raise exception 'that paper does not exist or is not yours' using errcode = '42501';
  end if;

  if v_paper.id is not null then
    update public.paper set
      type = p_type,
      tier = p_tier,
      date_taken = coalesce(p_date_taken, date_taken),
      subject = p_subject,
      reported_total = coalesce(p_reported_total, reported_total),
      stated_maximum = coalesce(p_stated_maximum, stated_maximum)
    where id = v_paper.id
    returning * into v_paper;
  else
    if p_idempotency_key is null then
      raise exception 'an idempotency key is required' using errcode = '22004';
    end if;

    select * into v_paper
      from public.paper
     where idempotency_key = p_idempotency_key
       and student_id = p_student_id;

    if v_paper.id is null then
      begin
        insert into public.paper (
          student_id, type, tier, date_taken, subject,
          reported_total, stated_maximum, idempotency_key
        )
        values (
          p_student_id, p_type, p_tier, coalesce(p_date_taken, current_date), p_subject,
          p_reported_total, p_stated_maximum, p_idempotency_key
        )
        returning * into v_paper;
        v_created := true;
      exception when unique_violation then
        raise exception 'idempotency key is unavailable'
          using errcode = '42501';
      end;
    end if;
  end if;

  -- Serialise run selection/creation for this paper. Two rapid Retry taps can
  -- both reach this function, but only the first can mint the fresh run.
  perform pg_advisory_xact_lock(hashtextextended(v_paper.id::text, 0));

  select exists (
    select 1 from jsonb_array_elements(p_pages) incoming
    join public.paper_page existing
      on existing.paper_id = v_paper.id and existing.page_number = (incoming ->> 'page_number')::smallint
    where (incoming ->> 'r2_key' is not null and incoming ->> 'r2_key' is distinct from existing.r2_key)
       or (incoming ->> 'mask_key' is not null and incoming ->> 'mask_key' is distinct from existing.mask_key)
       or (incoming ->> 'sha256' is not null and incoming ->> 'sha256' is distinct from existing.sha256)
  ) into v_source_changed;
  if v_source_changed and exists (
    select 1 from public.extraction_run where paper_id = v_paper.id and committed_at is not null
  ) then
    raise exception 'Saved source pages cannot be replaced; scan them as a new paper' using errcode = '42501';
  end if;
  if v_source_changed then
    update public.extraction_run set status = 'failed', status_reason = 'Source pages replaced by a retake',
      finished_at = now(), heartbeat_at = now()
    where paper_id = v_paper.id and status not in ('failed', 'rejected', 'committed');
  end if;

  for v_page in select * from jsonb_array_elements(p_pages) loop
    insert into public.paper_page (
      paper_id, student_id, page_number, source_kind, status,
      r2_bucket, r2_key, mask_key, original_key, thumb_key,
      bytes, sha256, etag, preprocess_version,
      quality_verdict, quality_signals, conditioning_meta, layer_fallback,
      teacher_marks, teacher_mark_count
    )
    values (
      v_paper.id, p_student_id,
      (v_page ->> 'page_number')::smallint,
      coalesce((v_page ->> 'source_kind')::public.page_source, 'upload'),
      'stored',
      coalesce(v_page ->> 'r2_bucket', 'derived'),
      v_page ->> 'r2_key',
      v_page ->> 'mask_key',
      v_page ->> 'original_key',
      v_page ->> 'thumb_key',
      (v_page ->> 'bytes')::integer,
      v_page ->> 'sha256',
      v_page ->> 'etag',
      coalesce(v_page ->> 'preprocess_version', 'v2'),
      v_page ->> 'quality_verdict',
      coalesce(v_page -> 'quality_signals', '{}'::jsonb),
      coalesce(v_page -> 'conditioning_meta', '{}'::jsonb),
      v_page ->> 'layer_fallback',
      coalesce(v_page -> 'teacher_marks', '[]'::jsonb),
      coalesce(jsonb_array_length(v_page -> 'teacher_marks'), 0)
    )
    on conflict (paper_id, page_number) do update set
      r2_bucket    = coalesce(excluded.r2_bucket, paper_page.r2_bucket),
      r2_key       = coalesce(excluded.r2_key, paper_page.r2_key),
      mask_key     = coalesce(excluded.mask_key, paper_page.mask_key),
      original_key = coalesce(excluded.original_key, paper_page.original_key),
      thumb_key    = coalesce(excluded.thumb_key, paper_page.thumb_key),
      bytes        = coalesce(excluded.bytes, paper_page.bytes),
      sha256       = coalesce(excluded.sha256, paper_page.sha256),
      etag         = coalesce(excluded.etag, paper_page.etag),
      quality_verdict = coalesce(excluded.quality_verdict, paper_page.quality_verdict),
      quality_signals = coalesce(nullif(excluded.quality_signals, '{}'::jsonb), paper_page.quality_signals),
      conditioning_meta = coalesce(nullif(excluded.conditioning_meta, '{}'::jsonb), paper_page.conditioning_meta),
      layer_fallback = coalesce(excluded.layer_fallback, paper_page.layer_fallback),
      teacher_marks = coalesce(nullif(excluded.teacher_marks, '[]'::jsonb), paper_page.teacher_marks),
      teacher_mark_count = case
        when nullif(excluded.teacher_marks, '[]'::jsonb) is not null then excluded.teacher_mark_count
        else paper_page.teacher_mark_count
      end;
  end loop;

  select id
    into v_run_id
    from public.extraction_run
   where paper_id = v_paper.id
     and status not in ('failed', 'rejected')
   order by started_at desc, id desc
   limit 1;

  if v_run_id is null then
    v_run_id := null;

    update public.paper_page
       set structure_status = 'pending',
           crop_status = 'pending'
     where paper_id = v_paper.id
       and student_id = p_student_id;

    insert into public.extraction_run (
      paper_id, student_id, pipeline_version,
      preprocess_version, status, heartbeat_at
    )
    values (
      v_paper.id, p_student_id, p_pipeline_version,
      coalesce(p_pages -> 0 ->> 'preprocess_version', 'v2'), 'queued', now()
    )
    returning id into v_run_id;
    v_run_created := true;
  end if;

  return jsonb_build_object(
    'paper_id', v_paper.id,
    'run_id', v_run_id,
    'created', v_created,
    'run_created', v_run_created,
    'pages', (select count(*) from public.paper_page where paper_id = v_paper.id)
  );
end;
$$;
create or replace function public.advance_after_content(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pending integer;
begin
  perform private.run_lock(p_run_id);
  select count(*) into v_pending from public.question_region
   where run_id = p_run_id and extract_status in ('pending', 'running');
  if v_pending > 0 then return jsonb_build_object('advanced', false); end if;

  if (select status from public.extraction_run where id = p_run_id) in ('attribution', 'reconciliation') then
    return jsonb_build_object('advanced', false, 'enqueue_reconcile', true);
  end if;
  if (select status from public.extraction_run where id = p_run_id) <> 'content' then
    return jsonb_build_object('advanced', false);
  end if;

  perform public.run_advance(p_run_id, 'attribution');
  return jsonb_build_object('advanced', true, 'enqueue_reconcile', true);
end; $$;
