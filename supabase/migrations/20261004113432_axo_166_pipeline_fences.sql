-- Fence all shared pipeline writes against retakes and completed stages.
create or replace function public.pipeline_write(p_run_id uuid, p_stage text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_run public.extraction_run;
  v_page public.paper_page;
  v_page_id uuid := nullif(p_args->>'page_id','')::uuid;
  v_paper_id uuid;
  v_patch jsonb := coalesce(p_args->'patch','{}'::jsonb);
  v_next text := p_args->>'to';
begin
  select paper_id into v_paper_id from public.extraction_run where id=p_run_id;
  if v_paper_id is null then return jsonb_build_object('applied',false); end if;
  -- Same order as submit/commit: paper lock, then run row lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_paper_id::text,0));
  select * into v_run from public.extraction_run where id=p_run_id for update;
  if not (
    (p_stage='triage' and v_run.status::text in ('queued','triaging')) or
    (p_stage='structure' and v_run.status::text='structure') or
    (p_stage='crop' and v_run.status::text='cropping') or
    (p_stage='reconcile_start' and v_run.status::text in ('attribution','reconciliation')) or
    (p_stage='reconcile_result' and v_run.status::text='reconciliation')
  ) then return jsonb_build_object('applied',false,'status',v_run.status); end if;

  if p_stage in ('structure','crop') then
    select * into v_page from public.paper_page
      where id=v_page_id and paper_id=v_run.paper_id and student_id=v_run.student_id for update;
    if v_page.id is null then return jsonb_build_object('applied',false); end if;
    if p_stage='structure' then
      if coalesce(v_patch->>'structure_status','') not in ('running','done','failed','unreadable') then
        raise exception 'Invalid structure state' using errcode='22023';
      end if;
      if v_patch->>'structure_status'='done' then
        delete from public.page_unreadable where paper_id=v_run.paper_id
          and student_id=v_run.student_id and page_number=v_page.page_number;
      elsif p_args->>'unreadable_reason' is not null then
        insert into public.page_unreadable(paper_id,student_id,page_number,storage_path,reason)
          values(v_run.paper_id,v_run.student_id,v_page.page_number,v_page.r2_key,p_args->>'unreadable_reason');
      end if;
      update public.paper_page set structure_status=(jsonb_populate_record(null::public.paper_page,v_patch)).structure_status
        where id=v_page.id;
    else
      if coalesce(v_patch->>'crop_status','') not in ('running','done','failed','skipped') then
        raise exception 'Invalid crop state' using errcode='22023';
      end if;
      update public.paper_page set crop_status=(jsonb_populate_record(null::public.paper_page,v_patch)).crop_status
        where id=v_page.id;
    end if;
  elsif p_stage='triage' then
    update public.paper_page set structure_status='pending',crop_status='pending',
      layer_fallback=case when p_args->>'fallback'='non_red_marking' and layer_fallback is null
                          then 'non_red_marking' else layer_fallback end
      where paper_id=v_run.paper_id and student_id=v_run.student_id;
    v_next := 'structure';
  elsif p_stage='reconcile_result' then
    if exists (select 1 from jsonb_array_elements(coalesce(p_args->'confidence','[]'::jsonb)) item
      left join public.question_region r on r.id=(item->>'id')::uuid
      where r.id is null or r.run_id<>p_run_id or r.paper_id<>v_run.paper_id or r.student_id<>v_run.student_id) then
      raise exception 'Confidence rows must belong to this run' using errcode='42501';
    end if;
    perform public.apply_region_confidence(coalesce(p_args->'confidence','[]'::jsonb));
    update public.extraction_run set
      reconciled=(jsonb_populate_record(null::public.extraction_run,p_args->'run_result')).reconciled,
      reconcile_delta=(jsonb_populate_record(null::public.extraction_run,p_args->'run_result')).reconcile_delta,
      status_reason_code=p_args->'run_result'->>'status_reason_code' where id=p_run_id;
    update public.paper set
      total_awarded=(jsonb_populate_record(null::public.paper,p_args->'paper_result')).total_awarded,
      total_available=(jsonb_populate_record(null::public.paper,p_args->'paper_result')).total_available,
      reconciled=(jsonb_populate_record(null::public.paper,p_args->'paper_result')).reconciled,
      total_basis=(jsonb_populate_record(null::public.paper,p_args->'paper_result')).total_basis,
      total_partial=(jsonb_populate_record(null::public.paper,p_args->'paper_result')).total_partial
      where id=v_run.paper_id and student_id=v_run.student_id;
    if coalesce(v_next,'') not in ('adjudicating','needs_review') then
      raise exception 'Invalid reconciliation destination' using errcode='22023';
    end if;
  elsif p_stage='reconcile_start' then v_next := 'reconciliation';
  end if;

  if v_next is not null then
    if p_stage not in ('triage','reconcile_start','reconcile_result') then
      raise exception 'This stage cannot transition the run' using errcode='22023';
    end if;
    perform public.run_advance(p_run_id,
      (jsonb_populate_record(null::public.extraction_run,jsonb_build_object('status',v_next))).status,
      p_args->>'reason');
  end if;
  return jsonb_build_object('applied',true);
end; $$;
revoke all on function public.pipeline_write(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.pipeline_write(uuid,text,jsonb) to service_role;

create or replace function public.advance_after_structure(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_paper   uuid;
  v_pending integer;
  v_regions uuid[];
  v_pages   uuid[];
begin
  perform private.run_lock(p_run_id);
  select paper_id into v_paper from public.extraction_run where id = p_run_id;
  if v_paper is null then return jsonb_build_object('advanced', false); end if;

  select count(*) into v_pending from public.paper_page
   where paper_id = v_paper and structure_status in ('pending', 'running');
  if v_pending > 0 then return jsonb_build_object('advanced', false); end if;

  -- A failed queue send retries after the durable transition. Reissue only pending work.
  if (select status from public.extraction_run where id = p_run_id) = 'cropping' then
    select array_agg(id) into v_pages from public.paper_page
      where paper_id=v_paper and crop_status in ('pending','running') and r2_key is not null;
    return jsonb_build_object('advanced',false,'enqueue_crop',coalesce(to_jsonb(v_pages),'[]'::jsonb));
  elsif (select status from public.extraction_run where id = p_run_id) = 'content' then
    select array_agg(id order by order_index) into v_regions from public.question_region
      where run_id=p_run_id and extract_status in ('pending','running');
    return jsonb_build_object('advanced',false,'enqueue_content',coalesce(to_jsonb(v_regions),'[]'::jsonb),
      'enqueue_reconcile',coalesce(array_length(v_regions,1),0)=0);
  elsif (select status from public.extraction_run where id = p_run_id) <> 'structure' then
    return jsonb_build_object('advanced',false);
  end if;

  perform private.assemble_structure(p_run_id);

  select array_agg(id order by order_index) into v_regions
    from public.question_region
   where run_id = p_run_id and extract_status = 'pending';

  -- No regions at all: nothing to crop and nothing to read, either way.
  if coalesce(array_length(v_regions, 1), 0) = 0 then
    perform public.run_advance(p_run_id, 'content');
    return jsonb_build_object('advanced', true,
                              'enqueue_content', '[]'::jsonb,
                              'enqueue_crop', '[]'::jsonb,
                              'enqueue_reconcile', true);
  end if;

  if not private.flag('crop_stage') then
    perform public.run_advance(p_run_id, 'content');
    return jsonb_build_object('advanced', true,
                              'enqueue_content', to_jsonb(v_regions),
                              'enqueue_reconcile', false);
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

  -- A run with regions but no croppable page would otherwise sit in 'cropping'
  -- with nothing to consume it. Fall through to content rather than stall.
  if coalesce(array_length(v_pages, 1), 0) = 0 then
    perform public.run_advance(p_run_id, 'content');
    return jsonb_build_object('advanced', true,
                              'enqueue_content', to_jsonb(v_regions),
                              'enqueue_reconcile', false);
  end if;

  return jsonb_build_object('advanced', true,
                            'enqueue_crop', to_jsonb(v_pages),
                            'enqueue_reconcile', false);
end; $$;

revoke execute on function public.advance_after_structure(uuid) from public, anon, authenticated;
grant execute on function public.advance_after_structure(uuid) to service_role;

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

  if (select status from public.extraction_run where id=p_run_id) = 'content' then
    select array_agg(id order by order_index) into v_regions from public.question_region
      where run_id=p_run_id and extract_status in ('pending','running');
    return jsonb_build_object('advanced',false,'enqueue_content',coalesce(to_jsonb(v_regions),'[]'::jsonb),
      'enqueue_reconcile',coalesce(array_length(v_regions,1),0)=0);
  elsif (select status from public.extraction_run where id = p_run_id) <> 'cropping' then
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


-- Every issued PUT capability also has a deferred staging cleanup, after URL expiry.
alter table public.r2_deletion add column if not exists not_before timestamptz not null default now();
create or replace function public.claim_deletions(p_limit integer default 5)
returns table(id bigint,bucket text,prefix text,key text,attempts integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return query update public.r2_deletion d set attempts=d.attempts+1
    where d.id in (select c.id from public.r2_deletion c
      where c.done_at is null and c.attempts<20 and c.not_before<=now()
      order by c.created_at for update skip locked limit p_limit)
    returning d.id,d.bucket,d.prefix,d.key,d.attempts;
end; $$;
revoke all on function public.claim_deletions(integer) from public,anon,authenticated;
grant execute on function public.claim_deletions(integer) to service_role;
