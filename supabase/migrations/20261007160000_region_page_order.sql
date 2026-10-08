-- ============================================================================
-- AXO-216 · council D1 step 2: regions numbered in page order, not finish order
-- ============================================================================
-- order_index is claimed by the structure worker as max(order_index)+1 when
-- each PAGE FINISHES structure. Since axon-backend #176 pages are structured
-- concurrently, so finish order has nothing to do with the paper: the owner's
-- runs carried page 3's questions ahead of page 1's, and the numbering signal
-- (and the placement walk that counts and groups parts, AXO-122) judged that
-- queue order as if it were the paper (ADDENDUM-01A item 1).
--
-- Approach: keep the worker's provisional claim (it is what makes concurrent
-- page inserts safe under question_region_run_id_order_index_key), and
-- renumber ONCE, here, at the end of the run-level assembly pass. That pass
-- already runs exactly once per run, under the run lock, after every page is
-- structured and before anything downstream (crop, content, reconcile, the
-- review screen) reads order_index. Deterministic indices computed per page
-- (page_number * 1000 + rank) were rejected: a page's rank is not final until
-- assembly has merged its continuation bands, they leave gaps every consumer
-- would have to tolerate, and they cap a page at 1000 regions by convention.
--
-- Final order: the page the region starts on (its first span, which a merged
-- continuation keeps), then the top of its box on that page, then the top of
-- its printed label, then left to right, then the provisional index (stable for
-- exact ties). The result is 0..n-1 with no gaps.
--
-- (run_id, order_index) is unique and not deferrable, and order_index >= 0, so
-- the renumber is two statements: lift every row above the current maximum,
-- then lower each to its rank. Neither statement can collide with a row it has
-- not yet moved.
--
-- Body of the merge loop is unchanged from 20261001180000_axo_116_structure_assembly.
-- ============================================================================

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
  v_lift   integer;
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

  -- Renumber in page order (AXO-216). See the header for why two statements.
  select coalesce(max(order_index), 0) + 1 into v_lift
    from public.question_region
   where run_id = p_run_id;

  with ranked as (
    select qr.id,
           row_number() over (
             order by (qr.page_spans -> 0 ->> 'page')::int nulls last,
                      (qr.page_spans -> 0 -> 'box' ->> 'y')::numeric nulls last,
                      (qr.question_label_box ->> 'y')::numeric nulls last,
                      (qr.page_spans -> 0 -> 'box' ->> 'x')::numeric nulls last,
                      qr.order_index,
                      qr.id
           ) - 1 as rank
      from public.question_region qr
     where qr.run_id = p_run_id
  )
  update public.question_region qr
     set order_index = v_lift + ranked.rank
    from ranked
   where qr.id = ranked.id;

  update public.question_region
     set order_index = order_index - v_lift
   where run_id = p_run_id;

  return v_merged;
end; $$;

revoke all on function private.assemble_structure(uuid) from public, anon, authenticated;

comment on function private.assemble_structure(uuid) is
  'Run-level structure assembly, called once from advance_after_structure under the run lock after every page is structured: merges continuation bands in page order (AXO-116), then renumbers order_index 0..n-1 by page, then position on the page (AXO-216).';
