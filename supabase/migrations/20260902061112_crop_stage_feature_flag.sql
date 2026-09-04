-- The crop stage, behind a flag that defaults to OFF.
--
-- ── why this exists ───────────────────────────────────────────────────────
--
-- 20260901120100 replaced `advance_after_structure` so it advances a run to
-- 'cropping' and returns `enqueue_crop`. That was applied to the live database
-- while the worker that understands `enqueue_crop` was still unmerged and
-- undeployed — so the deployed structure worker, which reads `enqueue_content`,
-- enqueued nothing and left the run sitting in 'cropping' until the sweep
-- failed it ten minutes later.
--
-- No paper was actually lost (nothing was submitted in the window), but the
-- hazard was live for about sixteen hours. The mistake was ordering: a schema
-- change that assumes new code must not go out before that code does.
--
-- The flag removes the ordering requirement entirely rather than replacing it
-- with a carefully-sequenced one. All four combinations are now safe:
--
--                  flag off              flag on
--   old worker     content path OK       stalls  <- so do not flip until deployed
--   new worker     content path OK       crop path OK
--
-- The new worker reads `enqueue_crop` first and falls back to `enqueue_content`,
-- which is what makes the bottom-left cell work. Flip the flag only once
-- `mastery-crop` and `mastery-structure` are both deployed and `crop-queue`
-- exists.

create schema if not exists private;

create table if not exists private.feature_flag (
  key        text primary key,
  enabled    boolean not null default false,
  note       text,
  updated_at timestamptz not null default now()
);

-- Not in the public schema, so PostgREST never exposes it and no student
-- session can read or write it. The pipeline reads it with the service key.
revoke all on private.feature_flag from public, anon, authenticated;

insert into private.feature_flag (key, enabled, note)
values ('crop_stage', false,
        'WP4. Turn on only once mastery-crop and mastery-structure are deployed and crop-queue exists.')
on conflict (key) do nothing;

create or replace function private.flag(p_key text)
returns boolean
language sql
stable
security definer
set search_path to 'private', 'pg_temp'
as $$
  select coalesce((select enabled from private.feature_flag where key = p_key), false);
$$;

-- ── advance_after_structure, now flag-aware ───────────────────────────────
--
-- The 'off' branch is byte-for-byte the behaviour that shipped before WP4:
-- advance to 'content', return the region ids. The 'on' branch is WP4's.
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

  if (select status from public.extraction_run where id = p_run_id) <> 'structure' then
    return jsonb_build_object('advanced', false);
  end if;

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
revoke execute on function private.flag(text) from public, anon, authenticated;
grant execute on function public.advance_after_structure(uuid) to service_role;
