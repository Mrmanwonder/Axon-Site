-- ============================================================================
-- AXO-244 / AXO-262 follow-up: grade thresholds load themselves (owner,
-- 13 Oct 2026), one row per published route, and the outlook reads every
-- variant of the student's route instead of one picked arbitrarily.
--
-- What Cambridge publishes, and what this stores:
--   * A grade threshold table per syllabus and series. Its syllabus section
--     lists routes ("11, 31, 41, 51" = paper 1 variant 1, paper 3 variant 1,
--     ...) with a maximum weighted mark and A*..E (A Level) or a..e (AS).
--   * A separate "syllabus component weighting factors" file giving each
--     component's raw maximum, weighted maximum and weighting factor.
--   scripts/exams/cambridge_thresholds.py reads both. One grade_threshold_set
--   row per route: option_code is the route as printed, components its paper
--   numbers, component_max / component_weight keyed by paper number.
--
-- A route is 'verified' only when every check passes (recorded in `checks`):
--   the table names this syllabus and series; every component of the route is
--   in the table and in the weighting file with the same raw maximum; the
--   weighted maximum equals the sum of weighted component maxima exactly; A and
--   E equal the weighted sums of the component A and E thresholds to within
--   the board's rounding; grades strictly descend. Routes that carry forward
--   earlier results ("staged": components 7x-9x with no component thresholds)
--   cannot be checked and stay 'draft'. verified_by names the checker version.
-- ============================================================================

alter table public.grade_threshold_set
  add column if not exists assessment text not null default 'linear'
    check (assessment in ('linear', 'staged', 'as')),
  add column if not exists weights_source_url text check (weights_source_url ~ '^https://'),
  add column if not exists weights_source_sha256 text check (weights_source_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object');

-- One route per qualification: an AS route and an A Level route may print the
-- same combination ("50") in one document.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.grade_threshold_set'::regclass and contype = 'u'
     and pg_get_constraintdef(oid) = 'UNIQUE (provider_key, syllabus_code, series_key, option_code)';
  if c is not null then execute format('alter table public.grade_threshold_set drop constraint %I', c); end if;
end $$;
alter table public.grade_threshold_set
  add constraint grade_threshold_set_route_key unique (provider_key, syllabus_code, series_key, qualification, option_code);

create index if not exists grade_threshold_set_lookup_idx
  on public.grade_threshold_set (syllabus_code, qualification, series_key) where status = 'verified';

comment on column public.grade_threshold_set.option_code is
  'The route as the board prints it, e.g. "11,31,41,51". components holds its paper numbers.';
comment on column public.grade_threshold_set.checks is
  'Every automatic check run on this route and its result. verified only when all passed.';

-- The outlook. Opt-in, a range, and its basis (AXO-262; owner 13 Oct 2026).
--
-- Route choice: the student's own papers for this syllabus when they chose
-- them; otherwise the most complete route their identified papers cover. The
-- series: the most recent verified series in the same month as the student's
-- own series, else the most recent. Every variant of that route in that series
-- is read, and the range is widened across them: the low grade is the worst
-- any variant gives the low total, the high grade the best any gives the high
-- total, and the middle grade the more cautious of the variants.
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

  -- Every candidate route with the student's evidence on it.
  with per_paper as (
    select t.paper_id, t.paper_number, sum(t.marks_awarded) / nullif(sum(t.max_marks), 0) as share
      from private.attempt_tags(p_student) t
     where t.syllabus_code = v_syllabus and t.paper_number is not null and not t.total_partial
     group by t.paper_id, t.paper_number
  ),
  pc as (
    select paper_number, count(*)::int as n, min(share) as lo, avg(share) as mid, max(share) as hi
      from per_paper group by paper_number
  ),
  sets as (
    select s.* from public.grade_threshold_set s
     where s.syllabus_code = v_syllabus and s.series_key = v_series and s.status = 'verified'
       and s.qualification = v_qual and s.assessment <> 'staged'
       and (v_papers is null or s.components = v_papers)
  )
  select jsonb_agg(jsonb_build_object(
           'id', s.id, 'option_code', s.option_code, 'components', to_jsonb(s.components),
           'max_total', s.max_total, 'source_url', s.source_url,
           'missing', (select to_jsonb(coalesce(array_agg(c order by c), '{}'::smallint[]))
                         from unnest(s.components) c where not exists (select 1 from pc where pc.paper_number = c)),
           -- One paper on a component is too little to know its spread; widen it.
           'lo', (select sum(greatest(0, case when pc.n = 1 then pc.mid - 0.10 else pc.lo end)
                             * (s.component_max ->> c::text)::numeric * (s.component_weight ->> c::text)::numeric)
                    from unnest(s.components) c join pc on pc.paper_number = c),
           'mid', (select sum(pc.mid * (s.component_max ->> c::text)::numeric * (s.component_weight ->> c::text)::numeric)
                     from unnest(s.components) c join pc on pc.paper_number = c),
           'hi', (select sum(least(1, case when pc.n = 1 then pc.mid + 0.10 else pc.hi end)
                             * (s.component_max ->> c::text)::numeric * (s.component_weight ->> c::text)::numeric)
                    from unnest(s.components) c join pc on pc.paper_number = c)))
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
           (e ->> 'lo')::numeric as lo, (e ->> 'mid')::numeric as mid, (e ->> 'hi')::numeric as hi
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
         string_agg(option_code, ' | ' order by option_code), min(source_url)
    into v_routes, v_lo_rank, v_mid_rank, v_hi_rank, v_lo, v_mid, v_hi, v_max, v_target_min, v_options, v_source
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
    'marks_to_target', case when v_target_min is not null and v_target_min > v_mid then ceil(v_target_min - v_mid) end,
    'suggested', v_mid_grade,
    'stretch', case when v_mid_rank > 1 and v_mid_rank <= cardinality(v_scale) then v_scale[v_mid_rank - 1] end);
end;
$$;
revoke all on function public.grade_outlook(uuid, text) from public, anon;
grant execute on function public.grade_outlook(uuid, text) to authenticated;
