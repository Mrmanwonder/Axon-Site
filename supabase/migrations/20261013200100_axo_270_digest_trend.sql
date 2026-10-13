-- AXO-270: the parent digest names "fewer" or "more" only when the change
-- clears a two-proportion test as well as the ten-point floor. On 10 and 10
-- questions a ten-point gap is well inside chance. Reasoning in
-- docs/claude_insights-accuracy-audit-2026-10-13.md.

create or replace function private.build_parent_digest(p_student uuid, p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_first     text;
  v_from      timestamptz := (p_start::timestamp at time zone 'UTC');
  v_to        timestamptz := ((p_end + 1)::timestamp at time zone 'UTC');
  v_papers    integer;
  v_subjects  text[];
  v_counted   integer;
  v_lost_q    integer;
  v_lost_m    integer;
  v_ready     record;
  v_areas     jsonb := '[]'::jsonb;
  v_subj      jsonb := '[]'::jsonb;
  v_eq        integer;
  v_el        integer;
  v_trend     text;
begin
  select s.first_name into v_first
    from public.student s
   where s.id = p_student and s.deleted_at is null;
  if v_first is null then return null; end if;

  with wp as (
    select distinct r.paper_id
      from public.extraction_run r
     where r.student_id = p_student
       and r.status::text = 'committed'
       and r.committed_at >= v_from and r.committed_at < v_to
  ),
  att as (
    select a.id
      from public.attempt_analytics a
      join wp on wp.paper_id = a.paper_id
     where a.student_id = p_student
  ),
  loss as (
    select m.attempt_id, m.marks_lost
      from public.mark_loss_analytics m
      join att on att.id = m.attempt_id
     where m.student_id = p_student
  )
  select (select count(*) from wp)::int,
         (select count(*) from att)::int,
         (select count(distinct attempt_id) from loss)::int,
         (select coalesce(round(sum(marks_lost)), 0) from loss)::int
    into v_papers, v_counted, v_lost_q, v_lost_m;

  select coalesce(array_agg(distinct btrim(p.subject)) filter (where btrim(p.subject) <> ''), '{}')
    into v_subjects
    from public.paper p
   where p.id in (
     select r.paper_id from public.extraction_run r
      where r.student_id = p_student and r.status::text = 'committed'
        and r.committed_at >= v_from and r.committed_at < v_to);

  select rd.papers_counted, rd.questions_counted, rd.has_enough_data
    into v_ready
    from public.student_analytics_readiness rd
   where rd.student_id = p_student;

  if coalesce(v_ready.has_enough_data, false) then
    select coalesce(jsonb_agg(x order by x.marks_lost desc, x.questions desc, x.name), '[]'::jsonb)
      into v_areas
      from (
        select 'command_word'::text                         as kind,
               initcap(lower(btrim(m.command_word)))        as name,
               count(distinct m.attempt_id)::int            as questions,
               count(distinct a.paper_id)::int              as papers,
               round(sum(m.marks_lost))::int                as marks_lost
          from public.mark_loss_analytics m
          join public.attempt_analytics a on a.id = m.attempt_id
         where m.student_id = p_student
           and btrim(coalesce(m.command_word, '')) <> ''
         group by lower(btrim(m.command_word))
        having count(distinct m.attempt_id) >= 3
           and count(distinct a.paper_id) >= 2
         order by sum(m.marks_lost) desc, count(distinct m.attempt_id) desc, lower(btrim(m.command_word))
         limit 2
      ) x;
  end if;


  -- What they read, subject by subject (counts only: no scores, no percentages).
  select coalesce(jsonb_agg(x order by x.questions desc, x.subject), '[]'::jsonb)
    into v_subj
    from (
      select btrim(p.subject)                                   as subject,
             count(distinct a.paper_id)::int                    as papers,
             count(distinct a.id)::int                          as questions,
             count(distinct l.attempt_id)::int                  as lost_questions,
             coalesce(round(sum(l.marks_lost)), 0)::int         as marks_lost
        from public.attempt_analytics a
        join public.paper p on p.id = a.paper_id
        left join public.mark_loss_analytics l on l.attempt_id = a.id and l.student_id = p_student
       where a.student_id = p_student
         and btrim(coalesce(p.subject, '')) <> ''
         and a.paper_id in (
           select r.paper_id from public.extraction_run r
            where r.student_id = p_student and r.status::text = 'committed'
              and r.committed_at >= v_from and r.committed_at < v_to)
       group by btrim(p.subject)
       order by count(distinct a.id) desc, btrim(p.subject)
       limit 6
    ) x;

  -- Earlier work, to compare this week with. Papers first committed before this
  -- week and not touched in it. Shown only when both sides are large enough to
  -- mean something (10 questions each), and always with both counts.
  select count(distinct a.id)::int, count(distinct l.attempt_id)::int
    into v_eq, v_el
    from public.attempt_analytics a
    left join public.mark_loss_analytics l on l.attempt_id = a.id and l.student_id = p_student
   where a.student_id = p_student
     and a.paper_id in (
       select r.paper_id from public.extraction_run r
        where r.student_id = p_student and r.status::text = 'committed' and r.committed_at < v_from)
     and a.paper_id not in (
       select r.paper_id from public.extraction_run r
        where r.student_id = p_student and r.status::text = 'committed'
          and r.committed_at >= v_from and r.committed_at < v_to);

  if v_counted >= 10 and v_eq >= 10 then
    -- Share of questions that lost marks this week against earlier. A
    -- direction is named only when the gap is at least a tenth of the
    -- questions AND clears a two-proportion test at 95% (AXO-270): on 10 and
    -- 10 questions a ten-point gap is well inside chance.
    v_trend := case
      when abs(v_lost_q::numeric / v_counted - v_el::numeric / v_eq) < 0.10 then 'similar'
      when abs(v_lost_q::numeric / v_counted - v_el::numeric / v_eq)
           < 1.96 * sqrt(greatest(1e-9, ((v_lost_q + v_el)::numeric / (v_counted + v_eq))
                                         * (1 - (v_lost_q + v_el)::numeric / (v_counted + v_eq))
                                         * (1.0 / v_counted + 1.0 / v_eq))) then 'similar'
      when v_lost_q::numeric / v_counted < v_el::numeric / v_eq then 'fewer'
      else 'more' end;
  end if;

  return jsonb_build_object(
    'first_name',       v_first,
    'period_start',     p_start,
    'period_end',       p_end,
    'papers_committed', v_papers,
    'subjects',         to_jsonb(v_subjects),
    'questions_counted', v_counted,
    'questions_lost',   v_lost_q,
    'marks_lost',       v_lost_m,
    'papers_counted',   coalesce(v_ready.papers_counted, 0),
    'has_enough_data',  coalesce(v_ready.has_enough_data, false),
    'areas',            v_areas,
    'by_subject',       v_subj,
    'earlier_questions', case when v_trend is null then null else v_eq end,
    'earlier_lost',     case when v_trend is null then null else v_el end,
    'trend',            v_trend
  );
end;
$$;

revoke all on function private.build_parent_digest(uuid, date, date) from public, anon, authenticated;

