-- AXO-52 — normalize common mathematical/symbol separators for private Library FTS.
--
-- PostgreSQL's simple parser stores strings such as alpha/beta as one lexeme,
-- while a student naturally searching "alpha beta" produces two terms. Rebuild
-- the generated vector with common equation/symbol separators normalized to
-- spaces, and apply the same normalization to FTS query parsing.
--
-- Raw question/answer text remains private on student_attempt and all search
-- functions remain SECURITY INVOKER under Student Mode RLS.

drop index if exists public.student_attempt_search_vector_gin;

alter table public.student_attempt
  drop column if exists search_vector;

alter table public.student_attempt
  add column search_vector tsvector
  generated always as (
    pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple'::regconfig,
        regexp_replace(coalesce(question_label, ''), '[/=;+*×÷^(){}<>|\[\]]+', ' ', 'g')
      ),
      'A'
    )
    ||
    pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple'::regconfig,
        regexp_replace(coalesce(question_text, ''), '[/=;+*×÷^(){}<>|\[\]]+', ' ', 'g')
      ),
      'B'
    )
    ||
    pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple'::regconfig,
        regexp_replace(coalesce(student_answer, ''), '[/=;+*×÷^(){}<>|\[\]]+', ' ', 'g')
      ),
      'C'
    )
  ) stored;

create index student_attempt_search_vector_gin
  on public.student_attempt using gin(search_vector);

comment on column public.student_attempt.search_vector is
  'Private normalized full-text representation of question label/text and student answer. Common mathematical/symbol separators are indexed as term boundaries. Protected by Student Mode RLS; never analytics/public data.';

create or replace function public.search_library_attempts(
  p_query text,
  p_limit integer default 50
)
returns table (
  paper_id uuid,
  attempt_id uuid,
  question_label text,
  rank real
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with parsed as (
    select pg_catalog.websearch_to_tsquery(
      'simple'::regconfig,
      nullif(btrim(regexp_replace(p_query, '[/=;+*×÷^(){}<>|\[\]]+', ' ', 'g')), '')
    ) as query
  )
  select
    a.paper_id,
    a.id as attempt_id,
    a.question_label,
    pg_catalog.ts_rank_cd(a.search_vector, parsed.query) as rank
  from public.student_attempt a
  cross join parsed
  where parsed.query is not null
    and a.search_vector @@ parsed.query
  order by rank desc, a.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;


create or replace function public.search_library(
  p_query text default null,
  p_subject_offering_id uuid default null,
  p_subject_state text default 'all',
  p_paper_type text default null,
  p_tier text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_limit integer default 100
)
returns table (
  paper_id uuid,
  rank real,
  match_kind text,
  subject_state text,
  suggested_subject text,
  suggested_confidence text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with input as (
    select
      nullif(btrim(p_query), '') as q,
      lower(nullif(btrim(p_query), '')) as q_lower,
      nullif(
        btrim(regexp_replace(p_query, '[/=;+*×÷^(){}<>|\[\]]+', ' ', 'g')),
        ''
      ) as q_fts
  ),
  parsed as (
    select
      i.*,
      case when i.q is null then null
           else pg_catalog.websearch_to_tsquery('simple'::regconfig, i.q_fts)
      end as tsq
    from input i
  ),
  attempt_match as (
    select
      a.paper_id,
      max(
        pg_catalog.ts_rank_cd(a.search_vector, parsed.tsq)
        + case
            when parsed.q_lower is not null
             and lower(coalesce(a.question_label, '')) = parsed.q_lower then 8
            when parsed.q_lower is not null
             and lower(coalesce(a.question_label, '')) like parsed.q_lower || '%' then 6
            else 0
          end
      )::real as rank,
      bool_or(parsed.q_lower is not null and lower(coalesce(a.question_label, '')) = parsed.q_lower) as label_exact,
      bool_or(parsed.q_lower is not null and lower(coalesce(a.question_label, '')) like parsed.q_lower || '%') as label_prefix
    from public.student_attempt a
    cross join parsed
    where parsed.tsq is not null
      and (
        a.search_vector @@ parsed.tsq
        or lower(coalesce(a.question_label, '')) = parsed.q_lower
        or lower(coalesce(a.question_label, '')) like parsed.q_lower || '%'
      )
    group by a.paper_id
  ),
  candidates as (
    select
      p.id as paper_id,
      p.subject_offering_id,
      p.subject_display_snapshot,
      p.subject_external_code_snapshot,
      p.type::text as paper_type,
      p.tier::text as paper_tier,
      p.date_taken,
      ai.title as assessment_title,
      nullif(btrim(latest.suggested_subject), '') as suggested_subject,
      nullif(btrim(latest.suggested_confidence), '') as suggested_confidence,
      am.rank as attempt_rank,
      coalesce(am.label_exact, false) as label_exact,
      coalesce(am.label_prefix, false) as label_prefix,
      parsed.q,
      parsed.q_lower,
      case
        when p.subject_offering_id is not null then 'verified'
        when nullif(btrim(latest.suggested_subject), '') is not null
          or nullif(btrim(p.subject), '') is not null then 'suggested'
        else 'unknown'
      end as subject_state,
      coalesce(nullif(btrim(latest.suggested_subject), ''), nullif(btrim(p.subject), '')) as visible_suggestion
    from public.paper p
    cross join parsed
    left join public.assessment_identity ai on ai.id = p.assessment_identity_id
    left join attempt_match am on am.paper_id = p.id
    left join lateral (
      select
        er.tier_routing #>> '{triage,subject}' as suggested_subject,
        er.tier_routing #>> '{triage,confidence}' as suggested_confidence
      from public.extraction_run er
      where er.paper_id = p.id
        and er.student_id = p.student_id
      order by er.started_at desc nulls last, er.id desc
      limit 1
    ) latest on true
    where (p_subject_offering_id is null or p.subject_offering_id = p_subject_offering_id)
      and (
        coalesce(p_subject_state, 'all') = 'all'
        or (p_subject_state = 'verified' and p.subject_offering_id is not null)
        or (
          p_subject_state = 'suggested'
          and p.subject_offering_id is null
          and (
            nullif(btrim(latest.suggested_subject), '') is not null
            or nullif(btrim(p.subject), '') is not null
          )
        )
        or (
          p_subject_state = 'unknown'
          and p.subject_offering_id is null
          and nullif(btrim(latest.suggested_subject), '') is null
          and nullif(btrim(p.subject), '') is null
        )
      )
      and (p_paper_type is null or p.type::text = p_paper_type)
      and (p_tier is null or p.tier::text = p_tier)
      and (p_date_from is null or p.date_taken >= p_date_from)
      and (p_date_to is null or p.date_taken <= p_date_to)
  ),
  scored as (
    select
      c.*,
      (
        coalesce(c.attempt_rank, 0)
        + case when c.label_exact then 8 when c.label_prefix then 6 else 0 end
        + case
            when c.q_lower is null then 0
            when lower(coalesce(c.subject_external_code_snapshot, '')) = c.q_lower then 12
            when lower(coalesce(c.subject_display_snapshot, '')) = c.q_lower then 10
            when lower(coalesce(c.assessment_title, '')) = c.q_lower then 9
            when replace(lower(c.paper_type), '_', ' ') = c.q_lower then 8
            when lower(coalesce(c.subject_external_code_snapshot, '')) like c.q_lower || '%' then 8
            when lower(coalesce(c.subject_display_snapshot, '')) like c.q_lower || '%' then 7
            when lower(coalesce(c.assessment_title, '')) like c.q_lower || '%' then 6
            when replace(lower(c.paper_type), '_', ' ') like c.q_lower || '%' then 5
            when lower(coalesce(c.visible_suggestion, '')) = c.q_lower then 3
            when lower(coalesce(c.visible_suggestion, '')) like c.q_lower || '%' then 2
            when lower(coalesce(c.assessment_title, '')) like '%' || c.q_lower || '%' then 2
            when lower(coalesce(c.subject_display_snapshot, '')) like '%' || c.q_lower || '%' then 2
            when to_char(c.date_taken, 'YYYY-MM-DD') like '%' || c.q_lower || '%' then 1
            else 0
          end
      )::real as score,
      case
        when c.q_lower is null then 'browse'
        when lower(coalesce(c.subject_external_code_snapshot, '')) = c.q_lower
          or lower(coalesce(c.subject_display_snapshot, '')) = c.q_lower then 'subject'
        when c.label_exact or c.label_prefix then 'question_label'
        when c.attempt_rank is not null then 'question_or_answer'
        when lower(coalesce(c.assessment_title, '')) like '%' || c.q_lower || '%' then 'assessment'
        when replace(lower(c.paper_type), '_', ' ') like '%' || c.q_lower || '%' then 'paper_type'
        when lower(coalesce(c.visible_suggestion, '')) like '%' || c.q_lower || '%' then 'suggested_subject'
        else 'metadata'
      end as match_kind
    from candidates c
  )
  select
    s.paper_id,
    s.score as rank,
    s.match_kind,
    s.subject_state,
    case when s.subject_state = 'suggested' then s.visible_suggestion else null end as suggested_subject,
    case when s.subject_state = 'suggested' then s.suggested_confidence else null end as suggested_confidence
  from scored s
  where s.q is null or s.score > 0
  order by s.score desc, s.date_taken desc, s.paper_id
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
$$;


revoke all on function public.search_library_attempts(text, integer) from public, anon;
grant execute on function public.search_library_attempts(text, integer) to authenticated;

revoke all on function public.search_library(text, uuid, text, text, text, date, date, integer)
  from public, anon;
grant execute on function public.search_library(text, uuid, text, text, text, date, date, integer)
  to authenticated;
