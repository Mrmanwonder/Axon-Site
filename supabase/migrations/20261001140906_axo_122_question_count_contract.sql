-- AXO-122: the question total shown to students was count(*) over question_region,
-- which counts parts, unlabeled structural regions and mis-ordered fragments as
-- "questions". The count was not even stable across retries of the same pages.
--
-- One read-side contract, defined here and mirrored by src/questionCount.js with
-- the shared fixtures in tests/fixtures/question-count-contract.json:
--
--   questions_total   distinct top-level question numbers
--   parts_total       reviewable regions (labeled, or unlabeled with evidence)
--   unassigned_parts  parts whose parent question cannot be determined
--   raw_region_count  every region row, for pipeline diagnostics
--
-- Stored labels are never rewritten. Regions are read in page-then-position
-- order because order_index is not reading order in production data (run
-- 89c8d7a9 runs pages 8, 8, 12, 12, 7, 7, 5, 1, ...). A bare part such as (c),
-- a or (ii) inherits the preceding region's top-level number only when that
-- region is on the same or the previous page and the part is not already taken
-- under it; otherwise it is counted as unassigned, never silently merged.
-- An unlabeled region is a part only if it carries evidence (a mark, an answer
-- or question text); it is then unassigned.

create or replace function public.parse_question_label(p_label text, out q integer, out part text)
language plpgsql immutable set search_path = ''
as $$
declare
  s text := lower(btrim(coalesce(p_label, '')));
  m text[];
begin
  q := null;
  part := null;
  if s = '' then return; end if;

  -- Mirrors canonicalLabel in axon-backend shared/src/labels.ts.
  m := regexp_match(s, '^\(\s*([ivx]+)\s*\)$|^([ivx]{2,})[.)]?$');
  if m is not null then
    part := '(' || coalesce(m[1], m[2]) || ')';
    return;
  end if;

  m := regexp_match(s, '^\(?\s*(?:(\d{1,4})\s*[.)]?\s*)?\(?\s*([a-z])\s*\)?\s*(?:[.)]?\s*\(?\s*([ivx]+)\s*\)?)?\s*$');
  if m is not null then
    q := m[1]::integer;
    part := m[2] || coalesce('(' || m[3] || ')', '');
    return;
  end if;

  m := regexp_match(s, '^\(?\s*(\d{1,4})\s*[.)]?\s*$');
  if m is not null then
    q := m[1]::integer;
  end if;
end;
$$;

create or replace function public.question_count_contract(p_run_id uuid)
returns table (
  questions_total  integer,
  parts_total      integer,
  unassigned_parts integer,
  raw_region_count integer
)
language plpgsql stable set search_path = ''
as $$
declare
  r record;
  lq integer;
  lpart text;
  tops integer[] := '{}';
  used text[] := '{}';
  prev_q integer;
  prev_page integer;
  v_parts integer := 0;
  v_unassigned integer := 0;
  v_raw integer := 0;
  has_evidence boolean;
begin
  for r in
    select qr.question_label, qr.marks_awarded, qr.student_answer, qr.question_text, qr.order_index,
           case when jsonb_typeof(qr.page_spans #> '{0,page}') = 'number'
                then (qr.page_spans #>> '{0,page}')::numeric::integer end as page,
           case when jsonb_typeof(qr.page_spans #> '{0,box,y}') = 'number'
                then (qr.page_spans #>> '{0,box,y}')::numeric end as y
    from public.question_region qr
    where qr.run_id = p_run_id
    order by page nulls last, y nulls last, qr.order_index
  loop
    v_raw := v_raw + 1;
    select pl.q, pl.part into lq, lpart from public.parse_question_label(r.question_label) pl;
    has_evidence := r.marks_awarded is not null
      or nullif(btrim(coalesce(r.student_answer, '')), '') is not null
      or nullif(btrim(coalesce(r.question_text, '')), '') is not null;

    if lq is null and lpart is null then
      -- unlabeled or unreadable label
      if has_evidence then
        v_parts := v_parts + 1;
        v_unassigned := v_unassigned + 1;
      end if;
      prev_q := null;
      prev_page := null;
    elsif lq is not null then
      if not (lq = any (tops)) then tops := tops || lq; end if;
      v_parts := v_parts + 1;
      if lpart is not null then used := used || (lq::text || ':' || lpart); end if;
      prev_q := lq;
      prev_page := r.page;
    else
      v_parts := v_parts + 1;
      if prev_q is not null and prev_page is not null and r.page is not null
         and r.page - prev_page between 0 and 1
         and not ((prev_q::text || ':' || lpart) = any (used)) then
        used := used || (prev_q::text || ':' || lpart);
        prev_page := r.page;
      else
        v_unassigned := v_unassigned + 1;
        prev_q := null;
        prev_page := null;
      end if;
    end if;
  end loop;

  return query select coalesce(array_length(tops, 1), 0), v_parts, v_unassigned, v_raw;
end;
$$;

revoke all on function public.parse_question_label(text) from public, anon;
revoke all on function public.question_count_contract(uuid) from public, anon;
grant execute on function public.parse_question_label(text) to authenticated;
grant execute on function public.question_count_contract(uuid) to authenticated;

comment on function public.question_count_contract(uuid) is
  'AXO-122 counting contract: logical questions, parts, unassigned parts and raw region rows for one extraction run. Read-side only; stored labels are never rewritten. Security invoker, so RLS on question_region applies.';

create or replace view public.paper_progress with (security_invoker = true) as
select
  r.id            as run_id,
  r.paper_id,
  r.student_id,
  r.status,
  r.status_reason,
  r.started_at,
  r.finished_at,
  (select count(*) from public.paper_page p where p.paper_id = r.paper_id)          as pages_total,
  (select count(*) from public.paper_page p
    where p.paper_id = r.paper_id and p.structure_status = 'done')                  as pages_done,
  c.questions_total::bigint                                                         as questions_total,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.extract_status = 'done')                            as questions_done,
  (select count(*) from public.question_region q
    where q.run_id = r.id and q.needs_review and q.student_confirmed_at is null)    as questions_needing_you,
  nullif(btrim(r.tier_routing #>> '{triage,subject}'), '')                          as suggested_subject,
  nullif(btrim(r.tier_routing #>> '{triage,confidence}'), '')                       as suggested_confidence,
  c.parts_total::bigint                                                             as parts_total,
  c.unassigned_parts::bigint                                                        as unassigned_parts,
  c.raw_region_count::bigint                                                        as raw_region_count
from public.extraction_run r
cross join lateral public.question_count_contract(r.id) c;

grant select on public.paper_progress to authenticated;

comment on view public.paper_progress is
  'Latest-run progress source for the client. questions_total is the AXO-122 logical count (top-level questions); parts_total, unassigned_parts and raw_region_count carry the rest of the contract. questions_done and questions_needing_you remain per-region counts (parts).';
