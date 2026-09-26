-- ============================================================================
-- AXO-61 — Enforce Student Mode across academic resources and mutations
-- ============================================================================
-- Depends on AXO-60 private.student_scope_allows(uuid).
--
-- Ordinary student academic access is constrained to the one active student
-- selected for the exact signed auth session. Strong guardian-only destructive
-- actions remain guardian-authorized and require fresh Parent Mode instead of
-- being weakened to Student Mode.
-- ============================================================================

-- ── Core academic RLS: ordinary reads/writes are Student Mode scoped ─────────

drop policy if exists attempt_concept_all_own on public.attempt_concept;
create policy attempt_concept_all_scope on public.attempt_concept
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists extraction_run_all_own on public.extraction_run;
create policy extraction_run_all_scope on public.extraction_run
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists loss_all_own on public.mark_loss_event;
create policy loss_all_scope on public.mark_loss_event
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));
-- loss_archive_depth_gate remains restrictive and unchanged.

drop policy if exists page_unreadable_all_own on public.page_unreadable;
create policy page_unreadable_all_scope on public.page_unreadable
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists paper_rw_own on public.paper;
drop policy if exists paper_insert_own on public.paper;
drop policy if exists paper_update_own on public.paper;
create policy paper_select_scope on public.paper
  for select to authenticated
  using (private.student_scope_allows(student_id));
create policy paper_insert_scope on public.paper
  for insert to authenticated
  with check (private.student_scope_allows(student_id));
create policy paper_update_scope on public.paper
  for update to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

-- AXO-95 removed the redundant Parent Mode prompt for academic actions.
-- AXO-61 preserves that UX for the active student while keeping Parent Mode
-- as the stronger guardian override across owned profiles.
drop policy if exists paper_delete_own on public.paper;
create policy paper_delete_scope_or_parent on public.paper
  for delete to authenticated
  using (
    private.student_scope_allows(student_id)
    or (
      private.has_fresh_auth()
      and exists (
        select 1 from public.student s
         where s.id = paper.student_id
           and s.guardian_id = private.current_guardian_id()
      )
    )
  );

drop policy if exists paper_page_all_own on public.paper_page;
create policy paper_page_all_scope on public.paper_page
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists report_select_own_pro on public.parent_progress_report;
create policy report_select_scope_pro on public.parent_progress_report
  for select to authenticated
  using (
    private.student_scope_allows(student_id)
    and private.guardian_is_pro(private.current_guardian_id())
  );

drop policy if exists pattern_insight_insert_own on public.pattern_insight;
drop policy if exists pattern_insight_select_own on public.pattern_insight;
drop policy if exists pattern_insight_update_own on public.pattern_insight;
create policy pattern_insight_insert_scope on public.pattern_insight
  for insert to authenticated
  with check (private.student_scope_allows(student_id));
create policy pattern_insight_select_scope on public.pattern_insight
  for select to authenticated
  using (
    private.student_scope_allows(student_id)
    and (
      scope = 'single_subject'
      or (
        scope = 'cross_subject'
        and private.guardian_is_pro(private.current_guardian_id())
      )
    )
  );
create policy pattern_insight_update_scope on public.pattern_insight
  for update to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists question_region_select_own on public.question_region;
drop policy if exists question_region_insert_own on public.question_region;
drop policy if exists question_region_update_own on public.question_region;
create policy question_region_select_scope on public.question_region
  for select to authenticated
  using (private.student_scope_allows(student_id));
create policy question_region_insert_scope on public.question_region
  for insert to authenticated
  with check (private.student_scope_allows(student_id));
create policy question_region_update_scope on public.question_region
  for update to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists question_region_delete_own on public.question_region;
create policy question_region_delete_scope_or_parent on public.question_region
  for delete to authenticated
  using (
    private.student_scope_allows(student_id)
    or (
      private.has_fresh_auth()
      and exists (
        select 1 from public.student s
         where s.id = question_region.student_id
           and s.guardian_id = private.current_guardian_id()
      )
    )
  );

drop policy if exists region_explanation_all_own on public.region_explanation;
create policy region_explanation_all_scope on public.region_explanation
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists attempt_select_own on public.student_attempt;
drop policy if exists attempt_insert_own on public.student_attempt;
drop policy if exists attempt_update_own on public.student_attempt;
create policy attempt_select_scope on public.student_attempt
  for select to authenticated
  using (private.student_scope_allows(student_id));
create policy attempt_insert_scope on public.student_attempt
  for insert to authenticated
  with check (private.student_scope_allows(student_id));
create policy attempt_update_scope on public.student_attempt
  for update to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));
-- attempt_archive_depth_gate remains restrictive and unchanged.

drop policy if exists attempt_delete_own on public.student_attempt;
create policy attempt_delete_scope_or_parent on public.student_attempt
  for delete to authenticated
  using (
    private.student_scope_allows(student_id)
    or (
      private.has_fresh_auth()
      and exists (
        select 1 from public.student s
         where s.id = student_attempt.student_id
           and s.guardian_id = private.current_guardian_id()
      )
    )
  );

drop policy if exists teacher_mark_all_own on public.teacher_mark;
create policy teacher_mark_all_scope on public.teacher_mark
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

drop policy if exists upload_all_own on public.upload;
create policy upload_all_scope on public.upload
  for all to authenticated
  using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

-- student + student_subject remain guardian/profile-management surfaces so a
-- guardian can enumerate and edit owned profiles before selecting Student Mode.

-- ── Storage: daily paper object access follows Student Mode ──────────────────

create or replace function private.student_scope_owns_storage_prefix(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, storage, pg_temp
as $$
declare
  v_segment text;
  v_student uuid;
begin
  v_segment := (storage.foldername(object_name))[1];
  if v_segment is null
     or v_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_student := v_segment::uuid;
  return private.student_scope_allows(v_student);
exception when others then
  return false;
end;
$$;

revoke all on function private.student_scope_owns_storage_prefix(text) from public, anon;
grant execute on function private.student_scope_owns_storage_prefix(text) to authenticated;

drop policy if exists papers_select_own on storage.objects;
create policy papers_select_scope on storage.objects
  for select to authenticated
  using (
    bucket_id = 'papers'
    and private.student_scope_owns_storage_prefix(name)
  );

drop policy if exists papers_insert_own on storage.objects;
create policy papers_insert_scope on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'papers'
    and private.student_scope_owns_storage_prefix(name)
    and private.consent_is_granted(
      private.current_guardian_id(),
      ((storage.foldername(name))[1])::uuid,
      'store_papers'
    )
  );

drop policy if exists papers_update_own on storage.objects;
create policy papers_update_scope on storage.objects
  for update to authenticated
  using (
    bucket_id = 'papers'
    and private.student_scope_owns_storage_prefix(name)
  )
  with check (
    bucket_id = 'papers'
    and private.student_scope_owns_storage_prefix(name)
  );

-- Active Student Mode may clean up its own objects without a redundant
-- re-auth prompt. Fresh Parent Mode remains the stronger guardian override.
drop policy if exists papers_delete_own on storage.objects;
create policy papers_delete_scope_or_parent on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'papers'
    and (
      private.student_scope_owns_storage_prefix(name)
      or (
        private.has_fresh_auth()
        and private.owns_storage_student_prefix(name)
      )
    )
  );

-- ── Privileged / RPC paths: defend in depth against arbitrary student IDs ────

create or replace function public.create_link_paper(
  p_request_id uuid,
  p_student_id uuid,
  p_type public.paper_type,
  p_date date,
  p_url text
)
returns public.paper
language plpgsql
set search_path to ''
as $$
declare
  result public.paper;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.student_scope_allows(p_student_id) then
    raise exception 'active student scope required' using errcode = '42501';
  end if;
  if p_request_id is null or p_url is null or p_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'Invalid link';
  end if;

  insert into public.paper(id,student_id,type,tier,date_taken)
    values(
      p_request_id,
      p_student_id,
      p_type,
      case when p_type in ('pyq','sample_paper')
        then 'tier_2'::public.paper_tier
        else 'tier_1'::public.paper_tier end,
      p_date
    )
    on conflict(id) do nothing
    returning * into result;

  if found then
    insert into public.paper_page(
      paper_id,student_id,page_number,source_kind,source_url,status
    ) values (
      result.id,p_student_id,1,'link',p_url,'pending'
    );
  else
    select * into strict result
      from public.paper
     where id = p_request_id
       and student_id = p_student_id;
  end if;

  return result;
end;
$$;

-- Keep the existing submit_paper implementation, but wrap its first authority
-- boundary by replacing it below from the current production definition.
-- NOTE: this definition is intentionally complete so migration replay is
-- deterministic and does not depend on textual function-body surgery.
create or replace function public.submit_paper(
  p_student_id uuid,
  p_type public.paper_type,
  p_tier public.paper_tier,
  p_date_taken date,
  p_subject text,
  p_pages jsonb,
  p_idempotency_key uuid,
  p_reported_total numeric default null,
  p_stated_maximum numeric default null,
  p_pipeline_version text default '1.0.0',
  p_paper_id uuid default null
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_paper       public.paper;
  v_run_id      uuid;
  v_run_status  public.extraction_status;
  v_page        jsonb;
  v_created     boolean := false;
  v_run_created boolean := false;
begin
  if not private.student_scope_allows(p_student_id) then
    raise exception 'active student scope required' using errcode = '42501';
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
     where idempotency_key = p_idempotency_key;

    -- A reused idempotency key must not become a sibling-data oracle.
    if v_paper.id is not null and v_paper.student_id is distinct from p_student_id then
      raise exception 'idempotency key is unavailable' using errcode = '42501';
    end if;

    if v_paper.id is null then
      insert into public.paper (
        student_id, type, tier, date_taken, subject,
        reported_total, stated_maximum, idempotency_key
      )
      values (
        p_student_id, p_type, p_tier,
        coalesce(p_date_taken, current_date), p_subject,
        p_reported_total, p_stated_maximum, p_idempotency_key
      )
      returning * into v_paper;
      v_created := true;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_paper.id::text, 0));

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
      quality_signals = coalesce(
        nullif(excluded.quality_signals, '{}'::jsonb),
        paper_page.quality_signals
      ),
      conditioning_meta = coalesce(
        nullif(excluded.conditioning_meta, '{}'::jsonb),
        paper_page.conditioning_meta
      ),
      layer_fallback = coalesce(excluded.layer_fallback, paper_page.layer_fallback),
      teacher_marks = coalesce(
        nullif(excluded.teacher_marks, '[]'::jsonb),
        paper_page.teacher_marks
      ),
      teacher_mark_count = case
        when nullif(excluded.teacher_marks, '[]'::jsonb) is not null
          then excluded.teacher_mark_count
        else paper_page.teacher_mark_count
      end;
  end loop;

  select id, status
    into v_run_id, v_run_status
    from public.extraction_run
   where paper_id = v_paper.id
   order by started_at desc, id desc
   limit 1;

  if v_run_id is null or v_run_status in ('failed', 'rejected') then
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
      coalesce(p_pages -> 0 ->> 'preprocess_version', 'v2'),
      'queued', now()
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

-- SECURITY DEFINER bypasses pattern_insight RLS, so repeat both the Student
-- Mode and Pro entitlement checks explicitly.
create or replace function public.get_cross_subject_signal()
returns table(
  student_id uuid,
  cause public.loss_cause,
  detected_at timestamptz,
  dismissed_at timestamptz
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select pi.student_id, pi.cause, pi.detected_at, pi.dismissed_at
    from public.pattern_insight pi
   where pi.scope = 'cross_subject'
     and private.student_scope_allows(pi.student_id)
     and private.guardian_is_pro(private.current_guardian_id());
$$;

-- AXO-95 deliberately removed the extra Parent Mode ceremony from academic
-- Share/Delete. AXO-61 adds Student Mode as the normal authority while keeping
-- fresh Parent Mode as a stronger guardian override across owned profiles.

create or replace function private.delete_question(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_student  uuid;
  v_paper    uuid;
  v_regions integer := 0;
  v_deleted integer := 0;
  v_total_awarded numeric(6,2);
  v_total_available numeric(6,2);
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select a.student_id, a.paper_id
    into v_student, v_paper
    from public.student_attempt a
    join public.student s on s.id = a.student_id
   where a.id = p_attempt_id
     and s.guardian_id = v_guardian;

  if v_student is null then
    raise exception 'no such question' using errcode = 'P0002';
  end if;

  if not private.student_scope_allows(v_student)
     and not private.has_fresh_auth() then
    raise exception 'active student scope or Parent Mode required'
      using errcode = '42501', hint = 'student_scope_required';
  end if;

  delete from public.question_region
   where committed_attempt_id = p_attempt_id
     and student_id = v_student
     and paper_id = v_paper;
  get diagnostics v_regions = row_count;

  delete from public.student_attempt
   where id = p_attempt_id
     and student_id = v_student
     and paper_id = v_paper;
  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'question deletion did not affect exactly one attempt'
      using errcode = 'P0001';
  end if;

  select sum(a.marks_awarded), sum(a.max_marks)
    into v_total_awarded, v_total_available
    from public.student_attempt a
   where a.paper_id = v_paper
     and a.student_id = v_student;

  update public.paper p
     set total_awarded = v_total_awarded,
         total_available = v_total_available,
         reconciled = case
           when v_total_awarded is null or p.reported_total is null then null
           else v_total_awarded = p.reported_total
         end
   where p.id = v_paper
     and p.student_id = v_student;

  return jsonb_build_object(
    'deleted', true,
    'attempt_id', p_attempt_id,
    'paper_id', v_paper,
    'regions_deleted', v_regions,
    'total_awarded', v_total_awarded,
    'total_available', v_total_available
  );
end;
$$;

create or replace function private.create_academic_share(
  p_resource_type text,
  p_resource_id uuid,
  p_expires_minutes integer default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_student uuid;
  v_paper uuid;
  v_attempt uuid;
  v_token text;
  v_share uuid;
  v_expires timestamptz;
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_resource_type not in ('paper', 'question') then
    raise exception 'unknown share resource' using errcode = '22023';
  end if;
  if p_expires_minutes < 5 or p_expires_minutes > 10080 then
    raise exception 'share expiry must be between 5 minutes and 7 days'
      using errcode = '22023';
  end if;

  if p_resource_type = 'paper' then
    select p.student_id, p.id
      into v_student, v_paper
      from public.paper p
      join public.student s on s.id = p.student_id
     where p.id = p_resource_id
       and s.guardian_id = v_guardian;
  else
    select a.student_id, a.paper_id, a.id
      into v_student, v_paper, v_attempt
      from public.student_attempt a
      join public.student s on s.id = a.student_id
     where a.id = p_resource_id
       and s.guardian_id = v_guardian;
  end if;

  if v_student is null or v_paper is null then
    raise exception 'no such resource' using errcode = 'P0002';
  end if;

  if not private.student_scope_allows(v_student)
     and not private.has_fresh_auth() then
    raise exception 'active student scope or Parent Mode required'
      using errcode = '42501', hint = 'student_scope_required';
  end if;

  update private.academic_share
     set revoked_at = now()
   where guardian_id = v_guardian
     and resource_type = p_resource_type
     and paper_id = v_paper
     and (
       (p_resource_type = 'paper' and attempt_id is null)
       or
       (p_resource_type = 'question' and attempt_id = v_attempt)
     )
     and revoked_at is null;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(mins => p_expires_minutes);

  insert into private.academic_share(
    guardian_id, student_id, resource_type, paper_id, attempt_id,
    token_hash, expires_at
  ) values (
    v_guardian, v_student, p_resource_type, v_paper, v_attempt,
    digest(v_token, 'sha256'), v_expires
  )
  returning id into v_share;

  return jsonb_build_object(
    'share_id', v_share,
    'resource_type', p_resource_type,
    'token', v_token,
    'expires_at', v_expires
  );
end;
$$;

create or replace function private.revoke_academic_share(p_share_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_student uuid;
  v_count integer;
begin
  if v_guardian is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select sh.student_id
    into v_student
    from private.academic_share sh
   where sh.id = p_share_id
     and sh.guardian_id = v_guardian;

  if v_student is null then
    return false;
  end if;

  if not private.student_scope_allows(v_student)
     and not private.has_fresh_auth() then
    raise exception 'active student scope or Parent Mode required'
      using errcode = '42501', hint = 'student_scope_required';
  end if;

  update private.academic_share
     set revoked_at = coalesce(revoked_at, now())
   where id = p_share_id
     and guardian_id = v_guardian;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function private.delete_question(uuid) from public, anon;
revoke all on function private.create_academic_share(text, uuid, integer) from public, anon;
revoke all on function private.revoke_academic_share(uuid) from public, anon;
grant execute on function private.delete_question(uuid) to authenticated;
grant execute on function private.create_academic_share(text, uuid, integer) to authenticated;
grant execute on function private.revoke_academic_share(uuid) to authenticated;

-- Share-state lookup is a daily UI read and must not reveal sibling resource
-- existence.
create or replace function private.active_academic_share(
  p_resource_type text,
  p_resource_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_share private.academic_share%rowtype;
begin
  if v_guardian is null then return null; end if;

  if p_resource_type = 'paper' then
    select sh.* into v_share
      from private.academic_share sh
      join public.paper p on p.id = sh.paper_id
     where sh.guardian_id = v_guardian
       and private.student_scope_allows(p.student_id)
       and sh.resource_type = 'paper'
       and sh.paper_id = p_resource_id
       and sh.attempt_id is null
       and sh.revoked_at is null
       and sh.expires_at > now()
     order by sh.created_at desc
     limit 1;
  elsif p_resource_type = 'question' then
    select sh.* into v_share
      from private.academic_share sh
      join public.student_attempt a on a.id = sh.attempt_id
     where sh.guardian_id = v_guardian
       and private.student_scope_allows(a.student_id)
       and sh.resource_type = 'question'
       and sh.attempt_id = p_resource_id
       and sh.revoked_at is null
       and sh.expires_at > now()
     order by sh.created_at desc
     limit 1;
  else
    return null;
  end if;

  if v_share.id is null then return null; end if;
  return jsonb_build_object(
    'share_id', v_share.id,
    'resource_type', v_share.resource_type,
    'expires_at', v_share.expires_at
  );
end;
$$;

comment on function private.student_scope_owns_storage_prefix(text) is
  'AXO-61. Daily papers-bucket authorization: the first path segment must be the one active Student Mode profile for this signed auth session.';

comment on function public.get_cross_subject_signal() is
  'AXO-61. SECURITY DEFINER cross-subject signal constrained by both active Student Mode scope and Pro entitlement.';
