-- AXO-270: insights and analytics accuracy (owner request, 13 Oct 2026).
--
-- Every number here is computed in the database from data already extracted;
-- nothing calls a model. The reasoning and sources are in
-- docs/claude_insights-accuracy-audit-2026-10-13.md.
--
--  1. A paper's component and series come from its printed reference
--     ("9709/12/M/J/24") when the catalogue has no identity for it. Before
--     this, almost no paper had a paper number, so the scorecard's weights and
--     the grade outlook had nothing to read.
--  2. Component grade thresholds are stored (grade_threshold_component), so a
--     past paper's raw marks can be put on the board's own difficulty scale.
--  3. The scorecard's command-word and AO rates use only printed command
--     words. The explain stage's tag exists only on parts that lost marks, so
--     a rate built on it has no full-mark parts in its denominator.
--  4. The grade outlook's range is a 90% interval from the papers' spread and
--     each paper's measurement error, not the min and max of the shares (which
--     widened as evidence grew). Papers are equated across series through
--     verified component thresholds where both ends have them.
--  5. Focus reasons say "to win back" (owner copy rule, 13 Oct 2026).
--  6. The parent digest's trend is in the next migration (20261013200100), on
--     its own so the digest tests can load it beside the digest's own files.

-- ── 1. The printed reference ──────────────────────────────────────────────
-- Strict: the full footer reference, or a high-confidence reading with the
-- syllabus code, a two-digit component, a session and a year. Anything else is
-- null. Mirrors cambridgeSchemeRef in axon-backend/shared/src/cambridge_scheme.ts.
create or replace function private.cambridge_ref(p_identity jsonb)
returns table (syllabus_code text, component text, series_key text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_m text[];
  v_field text;
  v_code text;
  v_comp text;
  v_month text;
  v_year int;
  v_session text;
begin
  if p_identity is null or jsonb_typeof(p_identity) <> 'object' then return; end if;
  foreach v_field in array array['paper_code', 'component_code', 'session'] loop
    v_m := regexp_match(upper(regexp_replace(coalesce(p_identity ->> v_field, ''), '\s+', '', 'g')),
                        '([0-9]{4})/([0-9]{2})/(O/N|M/J|F/M)/([0-9]{2})(?![0-9])');
    if v_m is not null then
      if nullif(regexp_replace(coalesce(p_identity ->> 'subject_code', ''), '\D', '', 'g'), '') is not null
         and regexp_replace(p_identity ->> 'subject_code', '\D', '', 'g') <> v_m[1] then
        return;
      end if;
      return query select v_m[1], v_m[2],
        (2000 + v_m[4]::int)::text || '-' || case v_m[3] when 'O/N' then '11' when 'M/J' then '06' else '03' end;
      return;
    end if;
  end loop;

  if coalesce(p_identity ->> 'confidence', '') <> 'high' then return; end if;
  v_code := regexp_replace(coalesce(p_identity ->> 'subject_code', ''), '\D', '', 'g');
  if v_code !~ '^[0-9]{4}$' then return; end if;
  foreach v_field in array array['component_code', 'paper_code'] loop
    v_comp := regexp_replace(coalesce(p_identity ->> v_field, ''), '\D', '', 'g');
    if length(v_comp) = 6 and left(v_comp, 4) = v_code then v_comp := right(v_comp, 2); end if;
    exit when v_comp ~ '^[0-9]{2}$';
    v_comp := null;
  end loop;
  if v_comp is null then
    v_comp := regexp_replace(coalesce(p_identity ->> 'paper_code', p_identity ->> 'component_code', ''), '\D', '', 'g')
              || regexp_replace(coalesce(p_identity ->> 'variant', ''), '\D', '', 'g');
    if v_comp !~ '^[0-9]{2}$' then return; end if;
  end if;
  v_session := lower(coalesce(p_identity ->> 'session', ''));
  v_month := case
    when v_session ~ '\m(oct|nov|o/n)\M|october|november' then '11'
    when v_session ~ '\m(may|jun|m/j)\M|june' then '06'
    when v_session ~ '\m(feb|mar|f/m)\M|february|march' then '03' end;
  v_year := case when coalesce(p_identity ->> 'exam_year', '') ~ '^[0-9]{4}$' then (p_identity ->> 'exam_year')::int end;
  if v_month is null or v_year is null or v_year not between 2000 and 2100 then return; end if;
  return query select v_code, v_comp, v_year::text || '-' || v_month;
end;
$$;
revoke all on function private.cambridge_ref(jsonb) from public, anon, authenticated;

-- The reference printed on one paper, read at triage. Only accepted when its
-- syllabus code is the paper's own (the subject the student filed it under).
create or replace function private.paper_printed_ref(p_paper uuid)
returns table (syllabus_code text, component text, series_key text)
language sql
stable
security definer
set search_path = ''
as $$
  with run as (
    select r.tier_routing #> '{triage,assessment_identity}' as ident
      from public.extraction_run r
     where r.paper_id = p_paper
       and r.status::text not in ('failed', 'rejected')
       and r.tier_routing #> '{triage,assessment_identity}' is not null
     order by (r.status::text = 'committed') desc, r.committed_at desc nulls last, r.started_at desc nulls last, r.id
     limit 1
  ),
  own as (
    select coalesce(
             case when so.external_code ~ '^[0-9]{4}$' then so.external_code end,
             case when p.subject_external_code_snapshot ~ '^[0-9]{4}$' then p.subject_external_code_snapshot end,
             (select ss.syllabus_code from public.student_subject ss
               where ss.student_id = p.student_id and ss.subject = p.subject and ss.syllabus_code ~ '^[0-9]{4}$' limit 1)) as code
      from public.paper p
      left join public.subject_offering so on so.id = p.subject_offering_id
     where p.id = p_paper
  )
  select c.syllabus_code, c.component, c.series_key
    from run, own, lateral private.cambridge_ref(run.ident) c
   where own.code is not null and c.syllabus_code = own.code;
$$;
revoke all on function private.paper_printed_ref(uuid) from public, anon, authenticated;

-- ── 2. Component grade thresholds ─────────────────────────────────────────
-- One row per component per series, as printed in the board's threshold
-- table. Verified (by scripts/exams/thresholds_ingest.py) only when the
-- component sits in a verified route of the same table, so its A and E were
-- cross-checked against the weighting factors file, its raw maximum matches
-- that file, and its grades strictly descend.
create table public.grade_threshold_component (
  id             uuid primary key default gen_random_uuid(),
  provider_key   text not null check (provider_key in ('cambridge')),
  syllabus_code  text not null check (syllabus_code ~ '^[0-9]{4}$'),
  series_key     text not null check (series_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  component      text not null check (component ~ '^[0-9]{2}$'),
  max_raw        numeric not null check (max_raw > 0),
  grades         jsonb not null check (jsonb_typeof(grades) = 'object'),
  source_url     text not null check (source_url ~ '^https://'),
  source_sha256  text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  status         text not null default 'draft' check (status in ('draft', 'verified')),
  verified_by    text,
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (provider_key, syllabus_code, series_key, component),
  check (status = 'draft' or (verified_by is not null and verified_at is not null))
);
comment on table public.grade_threshold_component is
  'Component grade thresholds from the board''s threshold tables, used to place a past paper''s raw marks on the board''s difficulty scale (AXO-270). Read only when verified.';
alter table public.grade_threshold_component enable row level security;
create policy grade_threshold_component_read on public.grade_threshold_component
  for select to authenticated using (status = 'verified');
revoke all on public.grade_threshold_component from anon, authenticated;
grant select on public.grade_threshold_component to authenticated;

-- Raw mark to the uniform scale the boards used for UMS: straight lines
-- between (0, 0), the E to A thresholds at 40, 50, 60, 70 and 80, and
-- (maximum, 100). Null unless the points strictly rise.
create or replace function private.uniform_points(p_max numeric, p_grades jsonb)
returns numeric[]
language sql
immutable
set search_path = ''
as $$
  select case when pts[2] > 0 and pts[2] < pts[3] and pts[3] < pts[4] and pts[4] < pts[5]
                   and pts[5] < pts[6] and pts[6] < pts[7] then pts end
    from (select array[0::numeric, (p_grades ->> 'E')::numeric, (p_grades ->> 'D')::numeric, (p_grades ->> 'C')::numeric,
                       (p_grades ->> 'B')::numeric, (p_grades ->> 'A')::numeric, p_max] as pts) x;
$$;
revoke all on function private.uniform_points(numeric, jsonb) from public, anon, authenticated;

-- A share of one component's marks, carried to another component (or the
-- same component in another series) through the uniform scale: the same
-- position relative to the board's own thresholds. Null when either side has
-- no usable thresholds, so the caller keeps the raw share and says so.
create or replace function private.equate_share(p_share numeric, p_src_max numeric, p_src jsonb, p_dst_max numeric, p_dst jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  u   numeric[] := array[0, 40, 50, 60, 70, 80, 100];
  s   numeric[] := private.uniform_points(p_src_max, p_src);
  d   numeric[] := private.uniform_points(p_dst_max, p_dst);
  x   numeric;
  v   numeric;
  i   int;
begin
  if p_share is null or s is null or d is null then return null; end if;
  x := least(1, greatest(0, p_share)) * p_src_max;
  for i in 1..6 loop
    if x <= s[i + 1] then v := u[i] + (x - s[i]) * (u[i + 1] - u[i]) / (s[i + 1] - s[i]); exit; end if;
  end loop;
  for i in 1..6 loop
    if v <= u[i + 1] then return (d[i] + (v - u[i]) * (d[i + 1] - d[i]) / (u[i + 1] - u[i])) / p_dst_max; end if;
  end loop;
  return 1;
end;
$$;
revoke all on function private.equate_share(numeric, numeric, jsonb, numeric, jsonb) from public, anon, authenticated;

-- ── 1b. attempt_tags reads the printed reference ─────────────────────────
create or replace function private.attempt_tags(p_student uuid)
returns table (
  attempt_id uuid, paper_id uuid, question_label text, question_text text,
  answer_blank boolean, marks_awarded numeric, max_marks numeric,
  subject text, assessment_identity_id uuid, paper_date date, total_partial boolean,
  syllabus_code text, provider_key text, programme_key text, paper_number smallint,
  loss_id uuid, cause public.loss_cause, command_word text, command_word_source text,
  ao text, topic_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select a.id as attempt_id, a.paper_id, a.question_label, a.question_text, a.answer_blank,
           a.marks_awarded, a.max_marks,
           p.subject, p.assessment_identity_id,
           coalesce(p.exam_date, p.date_taken, p.created_at::date) as paper_date,
           coalesce(p.total_partial, false) as total_partial,
           coalesce(
             case when so.external_code ~ '^[0-9]{4}$' then so.external_code end,
             case when p.subject_external_code_snapshot ~ '^[0-9]{4}$' then p.subject_external_code_snapshot end,
             (select ss.syllabus_code from public.student_subject ss
               where ss.student_id = a.student_id and ss.subject = p.subject and ss.syllabus_code ~ '^[0-9]{4}$' limit 1)
           ) as syllabus_code,
           coalesce(pr.key, 'cambridge') as provider_key,
           cp.key as programme_key,
           -- The catalogue identity first; otherwise the reference printed on
           -- the paper itself (AXO-270).
           coalesce(private.paper_number_of(ai.component_code, ai.paper_code),
                    private.paper_number_of((select r.component from private.paper_printed_ref(p.id) r), null)) as paper_number,
           private.printed_command_word(a.question_text) as printed_cw
      from public.attempt_analytics a
      join public.paper p on p.id = a.paper_id
      join public.student s on s.id = a.student_id
      left join public.curriculum_programme cp on cp.id = s.programme_id
      left join public.curriculum_provider pr on pr.id = cp.provider_id
      left join public.subject_offering so on so.id = p.subject_offering_id
      left join public.assessment_identity ai on ai.id = p.assessment_identity_id
     where a.student_id = p_student
       and a.marks_awarded is not null and a.max_marks is not null and a.max_marks > 0
  ),
  explained as (
    -- The eligible event carrying the most marks explains the part.
    select distinct on (m.attempt_id) m.attempt_id, m.id as loss_id, m.cause, m.command_word
      from public.mark_loss_analytics m
     where m.student_id = p_student
     order by m.attempt_id, m.marks_lost desc, m.created_at desc
  ),
  topic as (
    select distinct on (t.attempt_id) t.attempt_id, t.topic_id
      from public.topic_evidence t
     where t.student_id = p_student
     order by t.attempt_id, t.is_primary desc, (t.confidence = 'confirmed') desc, t.topic_id
  )
  select b.attempt_id, b.paper_id, b.question_label, b.question_text, b.answer_blank,
         b.marks_awarded, b.max_marks, b.subject, b.assessment_identity_id, b.paper_date, b.total_partial,
         b.syllabus_code, b.provider_key, b.programme_key, b.paper_number,
         e.loss_id, e.cause,
         coalesce(b.printed_cw, e.command_word),
         case when b.printed_cw is not null then 'printed' when e.command_word is not null then 'model' end,
         private.inferred_ao(b.provider_key, b.syllabus_code, b.paper_number, coalesce(b.printed_cw, e.command_word)),
         t.topic_id
    from base b
    left join explained e on e.attempt_id = b.attempt_id
    left join topic t on t.attempt_id = b.attempt_id;
$$;

revoke all on function private.attempt_tags(uuid) from public, anon, authenticated;

-- ── 3. The scorecard's rates use printed command words only ──────────────
create or replace function public.scorecard(p_student uuid, p_subject text)
returns table (
  dimension text, key text, questions integer, papers integer,
  marks_gained numeric, marks_available numeric,
  weighted_gained numeric, weighted_available numeric, trend jsonb)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_scope(p_student);
  return query
  with t as (
    select x.*, private.component_weight_factor(x.provider_key, x.syllabus_code, x.paper_number, x.programme_key) as wf
      from private.attempt_tags(p_student) x
     where x.subject is not distinct from p_subject
  ),
  -- Rates need a word every question can carry. Only the printed command
  -- word is read from every question; the explain stage's tag exists only
  -- on parts that lost marks, so a part it tagged is counted as untagged here
  -- (AXO-270). The same holds for the AO inferred from that word.
  dims as (
    select 'command_word'::text as dimension,
           coalesce(case when t.command_word_source = 'printed' then t.command_word end, 'untagged') as key, t.* from t
    union all
    select 'ao',
           coalesce(case when t.command_word_source = 'printed'
                         then private.inferred_ao(t.provider_key, t.syllabus_code, t.paper_number, t.command_word) end,
                    'untagged'), t.* from t
  ),
  per_paper as (
    select d.dimension, d.key, d.paper_id, min(d.paper_date) as paper_date,
           sum(d.marks_awarded) as g, sum(d.max_marks) as av
      from dims d group by 1, 2, 3
  )
  select d.dimension, d.key, count(*)::int, count(distinct d.paper_id)::int,
         sum(d.marks_awarded), sum(d.max_marks),
         round(sum(d.marks_awarded * d.wf), 2), round(sum(d.max_marks * d.wf), 2),
         (select jsonb_agg(jsonb_build_object('paper_id', pp.paper_id, 'date', pp.paper_date, 'gained', pp.g, 'available', pp.av)
                           order by pp.paper_date, pp.paper_id)
            from per_paper pp where pp.dimension = d.dimension and pp.key = d.key)
    from dims d
   group by d.dimension, d.key
   order by d.dimension, sum(d.max_marks - d.marks_awarded) desc, d.key;
end;
$$;

revoke all on function public.scorecard(uuid, text) from public, anon;
grant execute on function public.scorecard(uuid, text) to authenticated;

-- ── 5. Focus reasons follow the copy rule ────────────────────────────────
create or replace function public.focus_areas(p_student uuid, p_subject text default null, p_limit integer default 5)
returns table (
  kind text, key text, label text, subject text, marks_recoverable numeric,
  items_open integer, papers_seen integer, exam_date date, exam_days integer,
  heaviest_paper smallint, heaviest_weight_pct numeric, score numeric, reason text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_types boolean := private.flag('mistake_type_ui');
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);
  return query
  with open_items as (
    -- Fixed items are recovered; they are not something to work on.
    select * from private.scored_items(p_student) s
     where s.status <> 'fixed' and (p_subject is null or s.subject = p_subject)
  ),
  -- A command word is named only once it covers 3 parts that lost marks
  -- (owner, 5 Oct 2026). Counted over every item, recovered ones included.
  named_words as (
    select e.subject, e.command_word
      from public.error_item e
     where e.student_id = p_student and e.withdrawn_at is null and e.command_word is not null
     group by 1, 2 having count(*) >= 3
  ),
  tagged as (
    select 'topic'::text as kind, o.topic_id::text as key, o.* from open_items o where o.topic_id is not null
    union all
    select 'command_word', o.command_word, o.* from open_items o
      join named_words n on n.subject is not distinct from o.subject and n.command_word = o.command_word
    union all
    select 'mistake_type', o.mistake_type, o.* from open_items o where v_types and o.mistake_type is not null
    union all
    select 'subject', coalesce(o.subject, ''), o.* from open_items o
  ),
  areas as (
    select t.kind, t.key, t.subject,
           sum(t.marks_lost) as marks, count(*)::int as n, count(distinct t.paper_id)::int as papers,
           min(t.exam_date) as exam_date, min(t.exam_days) as exam_days,
           (array_agg(t.paper_number order by t.weight_pct desc nulls last))[1] as heaviest_paper,
           max(t.weight_pct) as heaviest_weight,
           sum(t.weight)
             -- Recurring across papers is worth more than one bad paper.
             * (1 + 0.5 * (count(distinct t.paper_id) - 1))
             as score
      from tagged t
     group by t.kind, t.key, t.subject
  )
  select a.kind, a.key,
         case a.kind
           when 'topic' then (select coalesce(st.code || ' ', '') || st.title from public.syllabus_topic st where st.id = a.key::uuid)
           else a.key end,
         a.subject, a.marks, a.n, a.papers, a.exam_date, a.exam_days, a.heaviest_paper, a.heaviest_weight,
         round(a.score, 3),
         concat_ws('; ',
           trim(to_char(a.marks, 'FM999990.##')) || case when a.marks = 1 then ' mark' else ' marks' end
             || ' to win back across ' || a.papers || case when a.papers = 1 then ' paper' else ' papers' end,
           case when a.exam_days is not null then 'exam in ' || a.exam_days || case when a.exam_days = 1 then ' day' else ' days' end end,
           case when a.heaviest_weight is not null and a.heaviest_paper is not null
                then 'Paper ' || a.heaviest_paper || ' is ' || trim(to_char(a.heaviest_weight, 'FM990.##')) || '% of the qualification' end)
    from areas a
   -- The whole-subject area is the fallback: listed after every specific area.
   order by (a.kind = 'subject'), a.score desc, a.marks desc, a.kind, a.key
   limit greatest(1, least(coalesce(p_limit, 5), 20));
end;
$$;

revoke all on function public.focus_areas(uuid, text, integer) from public, anon;
grant execute on function public.focus_areas(uuid, text, integer) to authenticated;

-- ── 4. The outlook's range and difficulty equating ───────────────────────
create or replace function public.grade_outlook(p_student uuid, p_subject text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opt boolean;
  v_syllabus text;
  v_plan_series text;
  v_papers smallint[];
  v_prog text;
  v_qual text;
  v_scale text[];
  v_series text;
  v_target text;
  v_ev jsonb;
  v_route smallint[];
  v_missing smallint[];
  v_n integer;
  v_components jsonb;
  v_routes integer;
  v_lo_rank integer; v_mid_rank integer; v_hi_rank integer;
  v_lo numeric; v_mid numeric; v_hi numeric; v_max numeric;
  v_target_min numeric;
  v_options text;
  v_source text;
  v_mid_grade text;
  v_equated integer;
begin
  perform private.require_scope(p_student);
  select outlook_opt_in into v_opt from public.student_practice_pref where student_id = p_student;
  if not coalesce(v_opt, false) then return jsonb_build_object('state', 'off'); end if;

  select ss.syllabus_code into v_syllabus from public.student_subject ss
   where ss.student_id = p_student and ss.subject = p_subject;
  if v_syllabus is null then return jsonb_build_object('state', 'unsupported', 'why', 'no_syllabus_code'); end if;

  select cp.key into v_prog
    from public.student s left join public.curriculum_programme cp on cp.id = s.programme_id
   where s.id = p_student;
  v_qual := case v_prog when 'cambridge_as' then 'as' when 'cambridge_a_level' then 'a_level' when 'cambridge_igcse' then 'igcse' end;
  v_scale := private.grade_scale(v_prog);
  if v_qual is null or v_scale is null then
    return jsonb_build_object('state', 'unsupported', 'why', 'no_verified_thresholds');
  end if;

  select series_key into v_plan_series from public.student_exam_plan where student_id = p_student;
  select (select array_agg(x order by x) from unnest(p.papers) x) into v_papers
    from public.student_exam_papers p where p.student_id = p_student and p.syllabus_code = v_syllabus;

  select s.series_key into v_series
    from public.grade_threshold_set s
   where s.syllabus_code = v_syllabus and s.status = 'verified' and s.qualification = v_qual
     and s.assessment <> 'staged' and (v_papers is null or s.components = v_papers)
   order by (v_plan_series is not null and right(s.series_key, 2) = right(v_plan_series, 2)) desc, s.series_key desc
   limit 1;
  if v_series is null then return jsonb_build_object('state', 'unsupported', 'why', 'no_verified_thresholds'); end if;

  select grade into v_target from public.student_target_grade where student_id = p_student and subject = p_subject;

  -- Every candidate route with the student's evidence on it (AXO-270).
  -- Each paper's share is carried onto the route's own component and series
  -- through verified component thresholds when both ends have them (the same
  -- place relative to the board's grade lines), and kept raw otherwise.
  -- Per component: the mean share, and a variance that is the larger of what
  -- the papers show and one paper's measurement error (0.55/sqrt(max), from
  -- Ofqual's reliability programme). The total's 90% range is
  -- mid +/- 1.645 sd, with sd from each component's predictive variance
  -- v(1 + 1/n), weighted by its marks; it narrows as papers accumulate.
  with pp0 as (
    select t.paper_id, t.paper_number, sum(t.marks_awarded) / nullif(sum(t.max_marks), 0) as share
      from private.attempt_tags(p_student) t
     where t.syllabus_code = v_syllabus and t.paper_number is not null and not t.total_partial
     group by t.paper_id, t.paper_number
  ),
  pp as (
    select pp0.*, r.component, r.series_key
      from pp0 left join lateral private.paper_printed_ref(pp0.paper_id) r on true
  ),
  sets as (
    select s.* from public.grade_threshold_set s
     where s.syllabus_code = v_syllabus and s.series_key = v_series and s.status = 'verified'
       and s.qualification = v_qual and s.assessment <> 'staged'
       and (v_papers is null or s.components = v_papers)
  ),
  sc as (
    select s.id as set_id, c as paper_number,
           (select btrim(x) from unnest(string_to_array(s.option_code, ',')) x
             where private.paper_number_of(btrim(x), null) = c limit 1) as dst_code,
           (s.component_max ->> c::text)::numeric as cmax, (s.component_weight ->> c::text)::numeric as cw
      from sets s, unnest(s.components) c
  ),
  eq as (
    select sc.set_id, sc.paper_number, sc.cmax, sc.cw, pp.paper_id,
           private.equate_share(pp.share, src.max_raw, src.grades, dst.max_raw, dst.grades) as eq_share, pp.share
      from sc
      join pp on pp.paper_number = sc.paper_number
      left join public.grade_threshold_component src
        on src.provider_key = 'cambridge' and src.syllabus_code = v_syllabus and src.series_key = pp.series_key
       and src.component = pp.component and src.status = 'verified'
      left join public.grade_threshold_component dst
        on dst.provider_key = 'cambridge' and dst.syllabus_code = v_syllabus and dst.series_key = v_series
       and dst.component = sc.dst_code and dst.status = 'verified'
  ),
  comp as (
    select e.set_id, e.paper_number, e.cmax, e.cw, count(*)::int as n,
           avg(coalesce(e.eq_share, e.share)) as m,
           greatest(coalesce(var_samp(coalesce(e.eq_share, e.share)), 0),
                    power(least(0.25, 0.55 / sqrt(greatest(e.cmax, 1))), 2)) as v,
           count(*) filter (where e.eq_share is not null)::int as equated
      from eq e group by e.set_id, e.paper_number, e.cmax, e.cw
  )
  select jsonb_agg(jsonb_build_object(
           'id', s.id, 'option_code', s.option_code, 'components', to_jsonb(s.components),
           'max_total', s.max_total, 'source_url', s.source_url,
           'missing', (select to_jsonb(coalesce(array_agg(c order by c), '{}'::smallint[]))
                         from unnest(s.components) c where not exists (select 1 from pp0 where pp0.paper_number = c)),
           'mid', (select sum(least(1, greatest(0, k.m)) * k.cmax * k.cw) from comp k where k.set_id = s.id),
           'sd', (select sqrt(sum(power(k.cmax * k.cw, 2) * k.v * (1 + 1.0 / k.n))) from comp k where k.set_id = s.id),
           'equated', (select coalesce(sum(k.equated), 0) from comp k where k.set_id = s.id)))
    into v_ev
    from sets s;

  -- The route: the student's own, else the most complete one fully covered.
  select (select array_agg(x::smallint order by x::int) from jsonb_array_elements_text(e -> 'components') x) into v_route
    from jsonb_array_elements(coalesce(v_ev, '[]'::jsonb)) e
   where jsonb_array_length(e -> 'missing') = 0
   order by jsonb_array_length(e -> 'components') desc, (e -> 'components')::text
   limit 1;

  select count(distinct t.paper_id)::int into v_n
    from private.attempt_tags(p_student) t
   where t.syllabus_code = v_syllabus and t.paper_number is not null and not t.total_partial
     and t.paper_number = any (coalesce(v_route, v_papers, (select array_agg(distinct x::smallint) from jsonb_array_elements(coalesce(v_ev, '[]'::jsonb)) e, jsonb_array_elements_text(e -> 'components') x)));

  if v_route is null or v_n < 3 then
    -- Not enough: say what is missing on the route closest to complete.
    select (select coalesce(array_agg(x::smallint order by x::int), '{}'::smallint[]) from jsonb_array_elements_text(e -> 'missing') x),
           (select jsonb_agg(jsonb_build_object('paper', x::int, 'papers',
                     (select count(distinct t.paper_id) from private.attempt_tags(p_student) t
                       where t.syllabus_code = v_syllabus and t.paper_number = x::smallint and not t.total_partial)) order by x::int)
              from jsonb_array_elements_text(e -> 'components') x)
      into v_missing, v_components
      from jsonb_array_elements(coalesce(v_ev, '[]'::jsonb)) e
     where v_route is null or (e -> 'components') = to_jsonb(v_route)
     order by jsonb_array_length(e -> 'missing'), jsonb_array_length(e -> 'components') desc
     limit 1;
    return jsonb_build_object('state', 'not_enough', 'papers', coalesce(v_n, 0), 'needed', 3,
      'missing_papers', to_jsonb(coalesce(v_missing, '{}'::smallint[])), 'components', coalesce(v_components, '[]'::jsonb));
  end if;

  select jsonb_agg(jsonb_build_object('paper', c, 'papers',
           (select count(distinct t.paper_id) from private.attempt_tags(p_student) t
             where t.syllabus_code = v_syllabus and t.paper_number = c and not t.total_partial)) order by c)
    into v_components from unnest(v_route) c;

  -- Grade each variant of the route; a total below every threshold ranks last.
  with ev as (
    select (e ->> 'id')::uuid as id, e ->> 'option_code' as option_code, e ->> 'source_url' as source_url,
           (e ->> 'max_total')::numeric as max_total,
           greatest(0, (e ->> 'mid')::numeric - 1.645 * (e ->> 'sd')::numeric) as lo,
           (e ->> 'mid')::numeric as mid,
           least((e ->> 'max_total')::numeric, (e ->> 'mid')::numeric + 1.645 * (e ->> 'sd')::numeric) as hi,
           (e ->> 'equated')::int as equated
      from jsonb_array_elements(v_ev) e
     where (e -> 'components') = to_jsonb(v_route) and jsonb_array_length(e -> 'missing') = 0
  ),
  graded as (
    select ev.*,
      coalesce(array_position(v_scale, (select g.grade from public.grade_threshold g where g.set_id = ev.id and g.min_total <= ev.lo order by g.min_total desc limit 1)), 99) as lo_rank,
      coalesce(array_position(v_scale, (select g.grade from public.grade_threshold g where g.set_id = ev.id and g.min_total <= ev.mid order by g.min_total desc limit 1)), 99) as mid_rank,
      coalesce(array_position(v_scale, (select g.grade from public.grade_threshold g where g.set_id = ev.id and g.min_total <= ev.hi order by g.min_total desc limit 1)), 99) as hi_rank,
      (select g.min_total from public.grade_threshold g where g.set_id = ev.id and g.grade = v_target) as target_min
    from ev
  )
  select count(*)::int, max(lo_rank), max(mid_rank), min(hi_rank),
         min(lo), avg(mid), max(hi), max(max_total), max(target_min),
         string_agg(option_code, ' | ' order by option_code), min(source_url), min(equated)
    into v_routes, v_lo_rank, v_mid_rank, v_hi_rank, v_lo, v_mid, v_hi, v_max, v_target_min, v_options, v_source, v_equated
    from graded;

  v_mid_grade := case when v_mid_rank <= cardinality(v_scale) then v_scale[v_mid_rank] end;

  return jsonb_build_object(
    'state', 'ready',
    'syllabus_code', v_syllabus, 'series_key', v_series, 'option_code', v_options, 'routes', v_routes,
    'source_url', v_source, 'papers', v_n, 'components', v_components,
    'low_grade', case when v_lo_rank <= cardinality(v_scale) then v_scale[v_lo_rank] else 'below lowest grade' end,
    'mid_grade', v_mid_grade,
    'high_grade', case when v_hi_rank <= cardinality(v_scale) then v_scale[v_hi_rank] else 'below lowest grade' end,
    'low_total', round(v_lo), 'mid_total', round(v_mid), 'high_total', round(v_hi), 'max_total', v_max,
    'target', v_target,
    'interval', 90, 'equated_papers', coalesce(v_equated, 0),
    'marks_to_target', case when v_target_min is not null and v_target_min > v_mid then ceil(v_target_min - v_mid) end,
    'suggested', v_mid_grade,
    'stretch', case when v_mid_rank > 1 and v_mid_rank <= cardinality(v_scale) then v_scale[v_mid_rank - 1] end);
end;
$$;

revoke all on function public.grade_outlook(uuid, text) from public, anon;
grant execute on function public.grade_outlook(uuid, text) to authenticated;
