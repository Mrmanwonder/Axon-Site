-- ============================================================================
-- 0016 · submit_paper finishes a paper the client already created
-- ============================================================================
-- The client-side cutover to mastery-api. R2's upload-intent route requires
-- the `paper` row to already exist before it will presign a PUT (it checks
-- ownership by looking the row up), so the client has to create the paper —
-- via the same direct RLS-scoped insert it already used with Supabase
-- Storage — *before* it can upload any pages. submit_paper then has to
-- finish that same row rather than mint a second one keyed off an
-- idempotency key, which is what it did when the client uploaded straight to
-- Supabase Storage with nothing but a bucket policy standing in its way.
--
-- Backward compatible in spirit, not in signature: p_paper_id is a new
-- trailing parameter with a default, so a caller that omits it still gets
-- the old idempotency-key path. The old 10-argument overload is dropped
-- rather than left alongside the new 11-argument one — PostgREST resolves
-- an RPC call by matching the named parameters in the request body against
-- candidate overloads, and leaving both around risks a call landing on
-- whichever one PostgREST picks rather than the one the caller meant.
-- ============================================================================

drop function if exists public.submit_paper(uuid, public.paper_type, public.paper_tier, date, text,
  jsonb, uuid, numeric, numeric, text);

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
  v_paper   public.paper;
  v_run_id  uuid;
  v_page    jsonb;
  v_created boolean := false;
begin
  if jsonb_typeof(p_pages) <> 'array' or jsonb_array_length(p_pages) = 0 then
    raise exception 'a paper needs at least one page' using errcode = '22023';
  end if;

  -- The client-created-draft path. RLS on this select is what proves
  -- ownership: a paper_id belonging to someone else's student comes back
  -- null here exactly as it would for a guessed id.
  if p_paper_id is not null then
    select * into v_paper from public.paper where id = p_paper_id and student_id = p_student_id;
  end if;

  if v_paper.id is null and p_paper_id is not null then
    raise exception 'that paper does not exist or is not yours' using errcode = '42501';
  end if;

  if v_paper.id is not null then
    -- Finish the row the client already created. Idempotent on its own
    -- terms: pages are upserted below, so a retried submit against the same
    -- paper_id with the same pages is a no-op past the first successful call.
    update public.paper set
      type = p_type, tier = p_tier, date_taken = coalesce(p_date_taken, date_taken),
      subject = p_subject,
      reported_total = coalesce(p_reported_total, reported_total),
      stated_maximum = coalesce(p_stated_maximum, stated_maximum)
    where id = v_paper.id
    returning * into v_paper;
  else
    if p_idempotency_key is null then
      raise exception 'an idempotency key is required' using errcode = '22004';
    end if;

    -- The retry lands here. RLS still decides whose paper this is, so a
    -- second caller with a guessed key finds nothing rather than someone
    -- else's row.
    select * into v_paper from public.paper where idempotency_key = p_idempotency_key;

    if v_paper.id is null then
      insert into public.paper (student_id, type, tier, date_taken, subject,
                                reported_total, stated_maximum, idempotency_key)
      values (p_student_id, p_type, p_tier, coalesce(p_date_taken, current_date), p_subject,
              p_reported_total, p_stated_maximum, p_idempotency_key)
      returning * into v_paper;
      v_created := true;
    end if;
  end if;

  for v_page in select * from jsonb_array_elements(p_pages) loop
    insert into public.paper_page (
      paper_id, student_id, page_number, source_kind, status,
      r2_bucket, r2_key, mask_key, original_key, thumb_key,
      bytes, sha256, etag, preprocess_version,
      quality_verdict, quality_signals, conditioning_meta, layer_fallback,
      teacher_marks, teacher_mark_count)
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
      coalesce(jsonb_array_length(v_page -> 'teacher_marks'), 0))
    -- A resubmit — the client retrying after a dropped connection, or the
    -- draft-then-submit path calling submit_paper a second time — upserts
    -- rather than conflicts. The old function only ever inserted, because
    -- its idempotency key made a second call impossible; this path can
    -- legitimately see the same (paper_id, page_number) twice.
    on conflict (paper_id, page_number) do update set
      r2_bucket = excluded.r2_bucket, r2_key = excluded.r2_key, mask_key = excluded.mask_key,
      original_key = excluded.original_key, thumb_key = excluded.thumb_key,
      bytes = excluded.bytes, sha256 = excluded.sha256, etag = excluded.etag,
      quality_verdict = excluded.quality_verdict, quality_signals = excluded.quality_signals,
      conditioning_meta = excluded.conditioning_meta, layer_fallback = excluded.layer_fallback,
      teacher_marks = excluded.teacher_marks, teacher_mark_count = excluded.teacher_mark_count;
  end loop;

  -- A resubmit reuses the run that is already in flight rather than starting
  -- a second one against the same pages, which would double every model call.
  select id into v_run_id from public.extraction_run
   where paper_id = v_paper.id and status not in ('failed', 'rejected')
   order by started_at desc limit 1;

  if v_run_id is null then
    insert into public.extraction_run (paper_id, student_id, pipeline_version,
                                       preprocess_version, status, heartbeat_at)
    values (v_paper.id, p_student_id, p_pipeline_version,
            coalesce(p_pages -> 0 ->> 'preprocess_version', 'v2'), 'queued', now())
    returning id into v_run_id;
  end if;

  return jsonb_build_object(
    'paper_id', v_paper.id, 'run_id', v_run_id, 'created', v_created,
    'pages', (select count(*) from public.paper_page where paper_id = v_paper.id));
end; $$;

revoke all on function public.submit_paper(uuid, public.paper_type, public.paper_tier, date, text,
  jsonb, uuid, numeric, numeric, text, uuid) from public, anon;
grant execute on function public.submit_paper(uuid, public.paper_type, public.paper_tier, date, text,
  jsonb, uuid, numeric, numeric, text, uuid) to authenticated, service_role;

comment on function public.submit_paper(uuid, public.paper_type, public.paper_tier, date, text,
  jsonb, uuid, numeric, numeric, text, uuid) is
  'Creates the paper''s pages and run in one transaction. Reuses an existing paper row (p_paper_id, RLS-checked) when the client already created one via a direct insert to get R2 upload keys; otherwise mints one from p_idempotency_key as before.';
