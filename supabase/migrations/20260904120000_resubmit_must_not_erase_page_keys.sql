-- ============================================================================
-- A resubmit must not erase the keys it did not send
-- ============================================================================
-- Found by the pgTAP suite once the migration history was reconciled: the
-- assertion "the page keys survived the round trip" fails against the schema
-- production actually runs.
--
-- ── what changed, and when ──
-- In 20260821100200_pipeline_runtime.sql the page loop lived INSIDE
-- `if v_paper.id is null` — the create branch. A retried submit found the paper
-- by idempotency key and never touched `paper_page` at all, so every key on it
-- survived because nothing rewrote them.
--
-- 20260825045847_submit_paper_accept_existing_draft.sql moved that loop out of
-- the branch so it runs on every call, which is correct — the client can now
-- create the paper itself to get R2 upload keys, and the pages have to land
-- somewhere. But its `on conflict do update` assigns every column from
-- `excluded` unconditionally, and `excluded` holds whatever the payload
-- supplied: NULL for anything omitted.
--
-- So a resubmit that names only `page_number` and `r2_key` — which is exactly
-- what a retry after a dropped response looks like — sets `mask_key`,
-- `original_key`, `thumb_key`, `sha256`, `etag` and `bytes` to NULL on a page
-- that had them.
--
-- `mask_key` is the one that hurts. It points at the red-pen layer, and the
-- whole colour-separation path reads it to find the teacher's marks. Losing it
-- does not fail loudly: the page stays, the run proceeds, and the marking is
-- simply invisible from then on — a silent gap in exactly the data the product
-- exists to read. That is the failure mode hard rule 4 is about.
--
-- ── the fix ──
-- Only overwrite a column when the payload actually carried a value. A retry
-- that omits a field leaves it alone; a genuine re-upload that supplies a new
-- key still replaces the old one.
--
-- The three jsonb columns need `nullif` as well as `coalesce`, because the
-- VALUES clause substitutes '{}' / '[]' for an absent key rather than NULL —
-- so "absent" arrives as an empty object, not a null one. The trade is that a
-- deliberate reset to empty no longer overwrites a populated value, which is
-- the safer direction to be wrong in.
--
-- Only the conflict clause changes. Everything else is the function as
-- reconstructed from production.
-- ============================================================================

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

  if p_paper_id is not null then
    select * into v_paper from public.paper where id = p_paper_id and student_id = p_student_id;
  end if;

  if v_paper.id is null and p_paper_id is not null then
    raise exception 'that paper does not exist or is not yours' using errcode = '42501';
  end if;

  if v_paper.id is not null then
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
    on conflict (paper_id, page_number) do update set
      r2_bucket    = coalesce(excluded.r2_bucket, paper_page.r2_bucket),
      r2_key       = coalesce(excluded.r2_key, paper_page.r2_key),
      mask_key     = coalesce(excluded.mask_key, paper_page.mask_key),
      original_key = coalesce(excluded.original_key, paper_page.original_key),
      thumb_key    = coalesce(excluded.thumb_key, paper_page.thumb_key),
      bytes        = coalesce(excluded.bytes, paper_page.bytes),
      sha256       = coalesce(excluded.sha256, paper_page.sha256),
      etag         = coalesce(excluded.etag, paper_page.etag),
      quality_verdict   = coalesce(excluded.quality_verdict, paper_page.quality_verdict),
      quality_signals   = coalesce(nullif(excluded.quality_signals, '{}'::jsonb),
                                   paper_page.quality_signals),
      conditioning_meta = coalesce(nullif(excluded.conditioning_meta, '{}'::jsonb),
                                   paper_page.conditioning_meta),
      layer_fallback    = coalesce(excluded.layer_fallback, paper_page.layer_fallback),
      teacher_marks     = coalesce(nullif(excluded.teacher_marks, '[]'::jsonb),
                                   paper_page.teacher_marks),
      teacher_mark_count = case
        when nullif(excluded.teacher_marks, '[]'::jsonb) is not null
          then excluded.teacher_mark_count
        else paper_page.teacher_mark_count end;
  end loop;

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

comment on function public.submit_paper(uuid, public.paper_type, public.paper_tier, date, text, jsonb, uuid, numeric, numeric, text, uuid) is
  'Creates the paper''s pages and run in one transaction. Reuses an existing paper row (p_paper_id, RLS-checked) when the client already created one via a direct insert to get R2 upload keys; otherwise mints one from p_idempotency_key. A resubmit only overwrites the page columns it actually carries, so a retry that omits mask_key does not erase the red-pen layer.';
