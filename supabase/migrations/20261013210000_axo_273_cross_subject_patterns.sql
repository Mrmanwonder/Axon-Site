-- AXO-273: the cross-subject pattern writer (owner decision, 13 Oct 2026).
--
-- The owner's rule: "the same cause in at least 2 subjects, each with 4 or
-- more papers, and above the student's usual rate beyond chance."
--
-- public.pattern_insight existed since 20260902125040, but nothing ever wrote
-- to it, so get_cross_subject_signal() never returned a row. This adds the
-- writer. Everything is deterministic and reads only the analytics views
-- (hard rule 3); no model is involved and the summary is a fixed template.
--
-- How the rule is read (docs/claude_insights-accuracy-audit-2026-10-13.md):
--   · A question's cause is its eligible loss event carrying the most marks
--     (the same choice as private.attempt_tags).
--   · Rate of a cause in a subject: questions lost to that cause / every
--     eligible question in the subject, lost or not. Questions are the trials;
--     marks inside one question are not independent.
--   · The student's usual rate: their rate of losing a question to any one
--     cause, averaged over the seven causes, across all their subjects
--     (lost questions / all questions / 7). It does not use the cause being
--     tested, so a cause that is high in every subject can still show, and a
--     student with exactly two subjects can still have one.
--   · Beyond chance: the one-sided 95% Wilson lower bound of the subject's
--     rate (z = 1.645) is above the usual rate.
--   · Each subject also needs 4 or more papers, and the cause in at least two
--     of them. A row needs 2 or more such subjects for the same cause.
-- Rows that no longer hold are removed unless the student dismissed them; a
-- dismissed row stays dismissed.

create or replace function private.wilson_lower(p_k numeric, p_n numeric, p_z numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_n is null or p_n <= 0 then null else
    greatest(0, ((p_k / p_n) + p_z * p_z / (2 * p_n)
                 - p_z * sqrt(greatest(0, (p_k / p_n) * (1 - p_k / p_n) / p_n + p_z * p_z / (4 * p_n * p_n))))
                / (1 + p_z * p_z / p_n)) end;
$$;
revoke all on function private.wilson_lower(numeric, numeric, numeric) from public, anon, authenticated;

create or replace function private.cause_phrase(p_cause public.loss_cause)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_cause::text
    when 'conceptual_gap' then 'Concept gaps'
    when 'procedural_slip' then 'Slips in the working'
    when 'misread_question' then 'Misreading the question'
    when 'incomplete' then 'Answers left incomplete'
    when 'presentation' then 'How answers were presented'
    when 'keyword_miss' then 'Missing keywords'
    when 'timed_out' then 'Running out of time'
  end;
$$;
revoke all on function private.cause_phrase(public.loss_cause) from public, anon, authenticated;

-- The candidate patterns for one student, without writing anything.
create or replace function private.cross_subject_patterns(p_student uuid)
returns table (cause public.loss_cause, subjects text[], paper_ids uuid[], question_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select a.id, a.paper_id, btrim(p.subject) as subject
      from public.attempt_analytics a
      join public.paper p on p.id = a.paper_id
     where a.student_id = p_student
       and a.marks_awarded is not null and a.max_marks is not null and a.max_marks > 0
       and btrim(coalesce(p.subject, '')) <> ''
  ),
  lost as (
    select distinct on (m.attempt_id) m.attempt_id, m.cause
      from public.mark_loss_analytics m
     where m.student_id = p_student and m.cause is not null and coalesce(m.marks_lost, 0) > 0
     order by m.attempt_id, m.marks_lost desc, m.created_at desc
  ),
  usual as (
    select count(l.attempt_id)::numeric / nullif(count(*), 0) / 7 as p0
      from q left join lost l on l.attempt_id = q.id
  ),
  subj as (
    select q.subject, count(*)::numeric as n, count(distinct q.paper_id) as papers
      from q group by q.subject
  ),
  sc as (
    select q.subject, l.cause, count(*)::numeric as k, count(distinct q.paper_id) as kp,
           array_agg(distinct q.paper_id) as paper_ids
      from lost l join q on q.id = l.attempt_id
     group by q.subject, l.cause
  ),
  hit as (
    select sc.*
      from sc join subj s on s.subject = sc.subject cross join usual u
     where s.papers >= 4 and sc.kp >= 2 and u.p0 is not null
       and private.wilson_lower(sc.k, s.n, 1.645) > u.p0
  )
  select h.cause,
         array_agg(h.subject order by h.subject),
         (select array_agg(distinct x order by x) from hit h2, unnest(h2.paper_ids) x where h2.cause = h.cause),
         sum(h.k)::int
    from hit h
   group by h.cause
  having count(*) >= 2;
$$;
revoke all on function private.cross_subject_patterns(uuid) from public, anon, authenticated;

-- Writes the student's cross-subject rows. Returns how many hold now.
create or replace function private.refresh_cross_subject_patterns(p_student uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  -- Undismissed rows whose rule no longer holds go; dismissed rows stay.
  delete from public.pattern_insight pi
   where pi.student_id = p_student and pi.scope = 'cross_subject' and pi.dismissed_at is null
     and not exists (select 1 from private.cross_subject_patterns(p_student) n where n.cause = pi.cause and n.subjects = pi.subjects);

  insert into public.pattern_insight (student_id, scope, cause, subjects, paper_ids, question_count, summary_text)
  select p_student, 'cross_subject', n.cause, n.subjects, n.paper_ids, n.question_count,
         private.cause_phrase(n.cause) || ' cost marks more often than usual in '
           || array_to_string(n.subjects[1:cardinality(n.subjects) - 1], ', ') || ' and ' || n.subjects[cardinality(n.subjects)]
           || ': ' || n.question_count || ' questions across ' || cardinality(n.paper_ids) || ' papers.'
    from private.cross_subject_patterns(p_student) n
  on conflict (student_id, scope, cause, subjects) do update
     set paper_ids = excluded.paper_ids,
         question_count = excluded.question_count,
         summary_text = excluded.summary_text;

  select count(*)::int into v_n from public.pattern_insight
   where student_id = p_student and scope = 'cross_subject';
  return v_n;
end;
$$;
revoke all on function private.refresh_cross_subject_patterns(uuid) from public, anon, authenticated;

-- Refresh whenever the student's evidence changed: the same dirty flag that
-- keeps error items in step (attempts, losses, topics and papers mark it).
create or replace function private.ensure_error_items(p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.error_item_dirty where student_id = p_student)
     or not exists (select 1 from public.error_item where student_id = p_student) then
    perform private.sync_error_items(p_student);
    -- AXO-273. Never let the pattern refresh fail the practice read.
    begin
      perform private.refresh_cross_subject_patterns(p_student);
    exception when others then
      raise warning 'cross-subject pattern refresh skipped for %: %', p_student, sqlerrm;
    end;
  end if;
end;
$$;
revoke all on function private.ensure_error_items(uuid) from public, anon, authenticated;
