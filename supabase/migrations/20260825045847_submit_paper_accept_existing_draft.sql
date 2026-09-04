-- ============================================================================
-- Reconstructed from the live project's migration history (2026-09-04).
-- ============================================================================
-- One deliberate addition: the explicit DROP below.
--
-- This migration adds an eleventh parameter (`p_paper_id`) to `submit_paper`.
-- `create or replace function` cannot change a signature, so it creates a
-- SECOND function rather than replacing the ten-argument one from
-- 20260821100200_pipeline_runtime.sql. Every added parameter has a default, so
-- the two overloads are ambiguous for any call that omits the optional tail —
-- which is every real caller. `supabase/tests/pipeline_runtime.sql` calls it
-- with seven arguments and fails with "function public.submit_paper(...) is
-- not unique".
--
-- Production has exactly one `submit_paper`, the eleven-argument one, so the
-- ten-argument version was disposed of there by some means outside this
-- history. Dropping it explicitly is what makes a replay of these files
-- reproduce the schema that actually exists.
-- ============================================================================

drop function if exists public.submit_paper(
  uuid, public.paper_type, public.paper_tier, date, text,
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
      r2_bucket = excluded.r2_bucket, r2_key = excluded.r2_key, mask_key = excluded.mask_key,
      original_key = excluded.original_key, thumb_key = excluded.thumb_key,
      bytes = excluded.bytes, sha256 = excluded.sha256, etag = excluded.etag,
      quality_verdict = excluded.quality_verdict, quality_signals = excluded.quality_signals,
      conditioning_meta = excluded.conditioning_meta, layer_fallback = excluded.layer_fallback,
      teacher_marks = excluded.teacher_marks, teacher_mark_count = excluded.teacher_mark_count;
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
  'Creates the paper''s pages and run in one transaction. Reuses an existing paper row (p_paper_id, RLS-checked) when the client already created one via a direct insert to get R2 upload keys; otherwise mints one from p_idempotency_key as before.';
