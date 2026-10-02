-- ============================================================================
-- AXO-116 · structure stage: page-local writes, one run-level assembly pass
-- ============================================================================
-- Production run 89c8d7a9 (and every earlier run of the same 14-page paper)
-- lost the same 6 pages. The model read all 14; the writes did not land.
--
-- 1. Bare part labels. A page whose questions are printed (a), (b) stores the
--    labels `a`, `b`; the parent number is on an earlier page the worker may not
--    have seen, because queue delivery order is not page order (that run was
--    structured 8, 12, 7, 5, 1, 3, …). The next page with an (a) collided with
--    question_region_one_label_per_run (SQLSTATE 23505), the whole page insert
--    was rejected and the page was recorded as unreadable. The index now covers
--    only labels that carry a question number; bare parts recur legitimately
--    and are resolved in page order downstream (AXO-122). The worker withholds
--    a numbered label that genuinely repeats and sends the region to review.
--
-- 2. Continuations. The worker stitched `continues_from_previous` onto the run's
--    highest order_index — the last page to *finish*, not the previous page.
--    Production holds regions spanning [12, 3] and [11, 3]: page 3's tail, with
--    its teacher marks, attached to a page-12 question. Continuations are now
--    written page-locally with continues_from_previous = true and merged here,
--    once, in page order, after every page is structured. Their teacher marks
--    move with them. A continuation with nothing on the previous page to attach
--    to (page 1, or a previous page that failed) stays its own region and goes
--    to review — admitted, not guessed.
--
-- Backward compatible in both deploy orders: the column defaults to false, so
-- the currently deployed worker is unaffected; the new worker needs the column.
-- ============================================================================

alter table public.question_region
  add column if not exists continues_from_previous boolean not null default false;

comment on column public.question_region.continues_from_previous is
  'Written by the structure stage for a page''s top band that continues the previous page''s last question. Merged into that question by private.assemble_structure once every page is structured; a row still true after assembly had nothing to attach to and is flagged for review.';

-- Same cutoff as the original (20260906134509_verification_doctrine): rows from
-- before it are historical and not touched. Narrowing the predicate can only
-- remove rows from the index, so it cannot fail on existing data.
drop index if exists public.question_region_one_label_per_run;
create unique index question_region_one_label_per_run
  on public.question_region (run_id, lower(regexp_replace(question_label, '[^A-Za-z0-9]', '', 'g')))
  where question_label is not null
    and question_label ~ '[0-9]'
    and created_at >= '2026-09-06 12:00:00+00';

comment on index public.question_region_one_label_per_run is
  'One region per numbered question part per run ("2a" and "2. a)" are the same key). Bare part labels such as "a" or "(ii)" are excluded: they recur under every question and their parent is resolved in page order (AXO-116, AXO-122). Partial on created_at so historical duplicate rows from real scans are preserved rather than deleted.';

create or replace function private.assemble_structure(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  c        record;
  v_target uuid;
  v_merged integer := 0;
begin
  -- Ascending page order, so a question running across pages 1→2→3 resolves:
  -- page 2's band is merged into the page-1 question first, which then has a
  -- span on page 2 for page 3's band to find.
  for c in
    select qr.id, qr.page_spans, (qr.page_spans -> 0 ->> 'page')::int as pg
      from public.question_region qr
     where qr.run_id = p_run_id
       and qr.continues_from_previous
     order by (qr.page_spans -> 0 ->> 'page')::int, qr.order_index
  loop
    -- The question this band continues: the region whose band on the previous
    -- page starts lowest on that page.
    select qr.id into v_target
      from public.question_region qr
      cross join lateral jsonb_array_elements(qr.page_spans) s
     where qr.run_id = p_run_id
       and qr.id <> c.id
       and (s ->> 'page')::int = c.pg - 1
     order by (s -> 'box' ->> 'y')::numeric desc, qr.order_index desc
     limit 1;

    if v_target is null then
      update public.question_region
         set needs_review = true
       where id = c.id;
      continue;
    end if;

    update public.question_region
       set page_spans = page_spans || c.page_spans
     where id = v_target;
    update public.teacher_mark
       set region_id = v_target
     where region_id = c.id;
    delete from public.question_region where id = c.id;
    v_merged := v_merged + 1;
  end loop;
  return v_merged;
end; $$;

revoke all on function private.assemble_structure(uuid) from public, anon, authenticated;

comment on function private.assemble_structure(uuid) is
  'AXO-116. Merges page-local continuation bands into the question they continue, in page order, once every page of the run is structured. Called only from advance_after_structure under the run lock.';

-- advance_after_structure: unchanged except for the assembly call, placed after
-- the "every page settled" and "still in structure" checks and before regions
-- are collected for the next stage.
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
