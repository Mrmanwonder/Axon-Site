create or replace function public.advance_after_structure(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_paper   uuid;
  v_pending integer;
  v_regions integer;
  v_pages   uuid[];
begin
  perform private.run_lock(p_run_id);
  select paper_id into v_paper from public.extraction_run where id = p_run_id;
  if v_paper is null then return jsonb_build_object('advanced', false); end if;

  select count(*) into v_pending from public.paper_page
   where paper_id = v_paper and structure_status in ('pending', 'running');
  if v_pending > 0 then return jsonb_build_object('advanced', false); end if;

  if (select status from public.extraction_run where id = p_run_id) <> 'structure' then
    return jsonb_build_object('advanced', false);
  end if;

  select count(*) into v_regions
    from public.question_region
   where run_id = p_run_id and extract_status = 'pending';

  if v_regions = 0 then
    perform public.run_advance(p_run_id, 'content');
    return jsonb_build_object('advanced', true, 'enqueue_crop', '[]'::jsonb, 'enqueue_reconcile', true);
  end if;

  perform public.run_advance(p_run_id, 'cropping');

  select array_agg(distinct pp.id) into v_pages
    from public.paper_page pp
    join public.question_region qr on qr.paper_id = pp.paper_id
    join lateral jsonb_array_elements(qr.page_spans) span on true
   where qr.run_id = p_run_id
     and pp.paper_id = v_paper
     and pp.r2_key is not null
     and (span ->> 'page')::int = pp.page_number;

  return jsonb_build_object(
    'advanced', true,
    'enqueue_crop', coalesce(to_jsonb(v_pages), '[]'::jsonb),
    'enqueue_reconcile', false);
end; $$;

create or replace function public.advance_after_crop(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_paper   uuid;
  v_pending integer;
  v_regions uuid[];
begin
  perform private.run_lock(p_run_id);
  select paper_id into v_paper from public.extraction_run where id = p_run_id;
  if v_paper is null then return jsonb_build_object('advanced', false); end if;

  select count(*) into v_pending from public.paper_page
   where paper_id = v_paper and crop_status in ('pending', 'running');
  if v_pending > 0 then return jsonb_build_object('advanced', false); end if;

  if (select status from public.extraction_run where id = p_run_id) <> 'cropping' then
    return jsonb_build_object('advanced', false);
  end if;

  perform public.run_advance(p_run_id, 'content');

  select array_agg(id order by order_index) into v_regions
    from public.question_region
   where run_id = p_run_id and extract_status = 'pending';

  return jsonb_build_object(
    'advanced', true,
    'enqueue_content', coalesce(to_jsonb(v_regions), '[]'::jsonb),
    'enqueue_reconcile', coalesce(array_length(v_regions, 1), 0) = 0);
end; $$;

create or replace function public.apply_region_crops(p_run_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_count integer;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'apply_region_crops expects an array' using errcode = '22023';
  end if;

  update public.question_region qr
     set crop_key     = row_in.crop_key,
         cropmask_key = row_in.cropmask_key,
         updated_at   = now()
    from (
      select (value ->> 'id')::uuid       as id,
             value ->> 'crop_key'         as crop_key,
             value ->> 'cropmask_key'     as cropmask_key
        from jsonb_array_elements(p_rows)
    ) row_in
   where qr.id = row_in.id
     and qr.run_id = p_run_id;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

revoke execute on function public.advance_after_structure(uuid) from public;
revoke execute on function public.advance_after_crop(uuid) from public;
revoke execute on function public.apply_region_crops(uuid, jsonb) from public;
grant execute on function public.advance_after_structure(uuid) to service_role;
grant execute on function public.advance_after_crop(uuid) to service_role;
grant execute on function public.apply_region_crops(uuid, jsonb) to service_role;
