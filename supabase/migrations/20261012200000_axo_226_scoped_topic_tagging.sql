-- AXO-226: what the scoped topic tagger needs from the database.
--
-- 1. `search_syllabus_topics_any`: the same server-pinned scope, version and
--    rights checks as `search_syllabus_topics`, but ANY of a few server-chosen
--    terms may match. `plainto_tsquery` ANDs every word, so a question's whole
--    text, or even five keywords, rarely matches one objective. Within a term
--    words are still ANDed ("equations of motion" stays a phrase-like unit).
-- 2. A topic job can end as `unavailable`, with a machine reason, when the paper
--    has no verified, approved syllabus. Model tags drawn from a draft or
--    unapproved document are removed; a tag the student added or rejected is not
--    touched. Unavailable jobs are re-checked once a day (no model call).
--
-- Nothing here changes behaviour by itself. The backend uses it only when the
-- explain Worker sets SYLLABUS_SEARCH=1.

-- ── 1. any-term search ─────────────────────────────────────────────────────
create function public.search_syllabus_topics_any(
  p_paper_id uuid, p_document_id uuid, p_source_sha256 text, p_terms text[], p_limit integer default 12
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  scope jsonb;
  query tsquery;
  term_query tsquery;
  term text;
  codes text[] := '{}';
  results jsonb;
begin
  if p_terms is null or cardinality(p_terms) not between 1 and 12
     or array_position(p_terms, null) is not null
     or octet_length(array_to_string(p_terms, ' ')) > 512
     or exists (select 1 from unnest(p_terms) t where length(btrim(t)) = 0 or length(t) > 64)
     or p_limit is null or p_limit not between 1 and 20 then
    return jsonb_build_object('status','unavailable','reason','invalid_query','candidates','[]'::jsonb);
  end if;
  scope := public.resolve_syllabus_retrieval_scope(p_paper_id);
  if scope->>'status' <> 'available' then return scope || jsonb_build_object('candidates','[]'::jsonb); end if;
  if (scope->>'document_id')::uuid is distinct from p_document_id
     or scope->>'source_sha256' is distinct from p_source_sha256 then
    return jsonb_build_object('status','unavailable','reason','scope_changed','candidates','[]'::jsonb);
  end if;

  foreach term in array p_terms loop
    codes := codes || btrim(term);
    -- plainto_tsquery keeps hostile or SQL-looking text as plain lexemes.
    term_query := plainto_tsquery('simple'::regconfig, term);
    if numnode(term_query) > 0 then
      query := case when query is null then term_query else query || term_query end;
    end if;
  end loop;
  if query is null then
    return scope || jsonb_build_object('candidates','[]'::jsonb,'retrieval','lexical_any_v1');
  end if;

  with candidates as (
    select t.*, ts_rank_cd(to_tsvector('simple'::regconfig,
      coalesce(t.code,'') || ' ' || t.title || ' ' || coalesce(t.objective_text,'')), query) as rank
    from public.syllabus_topic t where t.document_id=p_document_id and t.kind='objective'
      and t.source_page > 0 and nullif(btrim(t.objective_text),'') is not null
      and coalesce(t.qualification_scope,'') in (select jsonb_array_elements_text(scope->'qualification_scopes'))
      and (t.code = any(codes) or to_tsvector('simple'::regconfig,
        coalesce(t.code,'') || ' ' || t.title || ' ' || coalesce(t.objective_text,'')) @@ query)
    order by (t.code = any(codes)) desc, rank desc, t.sort_order, t.id
    limit p_limit
  ), bounded as (
    select c.*, row_number() over (order by (c.code = any(codes)) desc, rank desc, sort_order, id) as ord
    from candidates c
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'objective_id',c.id,'code',left(c.code,100),'title',left(c.title,300),
    'objective_text',left(c.objective_text,2000),'source_page',c.source_page,
    'text_truncated',length(c.objective_text)>2000,
    'parent',case when parent.id is null then null else jsonb_build_object(
      'id',parent.id,'code',left(parent.code,100),'title',left(parent.title,300)) end
    ) order by c.ord),'[]'::jsonb) into results
  from bounded c left join public.syllabus_topic parent on parent.id=c.parent_id
    and parent.document_id=p_document_id
    and coalesce(parent.qualification_scope,'') in (select jsonb_array_elements_text(scope->'qualification_scopes'));
  return scope || jsonb_build_object('candidates',results,'retrieval','lexical_any_v1');
end;
$$;
revoke all on function public.search_syllabus_topics_any(uuid,uuid,text,text[],integer) from public, anon, authenticated;
grant execute on function public.search_syllabus_topics_any(uuid,uuid,text,text[],integer) to service_role;
comment on function public.search_syllabus_topics_any(uuid,uuid,text,text[],integer) is
  'AXO-226 service-only shortlist where any server-chosen term may match. Same scope, version and rights checks as search_syllabus_topics. Never a topic judgment; do not log the terms.';

-- ── 2. an honest unavailable state ─────────────────────────────────────────
alter table private.topic_tag_job drop constraint if exists topic_tag_job_status_check;
alter table private.topic_tag_job add constraint topic_tag_job_status_check
  check (status in ('queued', 'done', 'failed', 'no_match', 'unavailable'));
alter table private.topic_tag_job add column if not exists unavailable_reason text;
alter table private.topic_tag_job add constraint topic_tag_job_unavailable_says_why
  check (status <> 'unavailable' or unavailable_reason is not null);

create function public.finish_topic_tags_unavailable(p_region_id uuid, p_document_id uuid, p_reason text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_reason is null or p_reason !~ '^[a-z_]{1,40}$' then
    raise exception 'reason must be a short machine code' using errcode = '22023';
  end if;
  if not exists (select 1 from private.topic_tag_job where region_id = p_region_id and document_id = p_document_id) then
    return false; -- superseded
  end if;
  -- No official, approved syllabus: no model tag may stand on it.
  delete from public.region_topic
   where region_id = p_region_id and source = 'model' and student_rejected_at is null;
  update private.topic_tag_job
     set status = 'unavailable', unavailable_reason = p_reason, finished_at = now(), last_error = null
   where region_id = p_region_id;
  return true;
end;
$$;
revoke all on function public.finish_topic_tags_unavailable(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finish_topic_tags_unavailable(uuid, uuid, text) to service_role;
comment on function public.finish_topic_tags_unavailable(uuid, uuid, text) is
  'AXO-226: ends a topic job as unavailable (no verified, approved syllabus for this paper) and removes model tags. Rechecked daily by claim_topic_tag_work. Service role only.';

-- claim_topic_tag_work, unchanged except that an unavailable job is offered
-- again after a day, so a newly approved syllabus is picked up.
create or replace function public.claim_topic_tag_work(p_limit integer default 25)
returns table (region_id uuid, document_id uuid)
language plpgsql
security definer
set search_path to ''
as $function$
#variable_conflict use_column
begin
  return query
  with candidates as (
    select q.id as region_id, private.syllabus_for_paper(q.paper_id) as document_id, j.status, j.attempts, j.document_id as job_document, j.queued_at, j.finished_at
      from public.question_region q
      join public.paper p on p.id = q.paper_id and p.subject_offering_id is not null
      left join private.topic_tag_job j on j.region_id = q.id
     where q.committed_attempt_id is not null
       and nullif(btrim(coalesce(q.question_text, '')), '') is not null
  ), due as (
    select c.region_id, c.document_id
      from candidates c
     where c.document_id is not null
       and (
         c.status is null
         or c.job_document is distinct from c.document_id
         or (c.status = 'failed' and c.attempts < 3 and c.finished_at < now() - interval '30 minutes')
         -- A message lost after claiming is retried after an hour.
         or (c.status = 'queued' and c.queued_at < now() - interval '1 hour' and c.attempts < 3)
         -- AXO-226: no approved syllabus yet; look again tomorrow (no model call unless one is found).
         or (c.status = 'unavailable' and c.finished_at < now() - interval '1 day')
       )
     limit greatest(1, least(p_limit, 100))
  ), claimed as (
    insert into private.topic_tag_job as j (region_id, document_id, status, attempts, queued_at, finished_at, last_error)
    select d.region_id, d.document_id, 'queued', 1, now(), null, null from due d
    on conflict on constraint topic_tag_job_pkey do update
       set document_id = excluded.document_id,
           status = 'queued',
           attempts = case when j.document_id = excluded.document_id and j.status <> 'unavailable' then j.attempts + 1 else 1 end,
           queued_at = now(), finished_at = null, last_error = null, unavailable_reason = null
    returning j.region_id, j.document_id
  )
  select claimed.region_id, claimed.document_id from claimed;
end;
$function$;

revoke all on function public.claim_topic_tag_work(integer) from public, anon, authenticated;
grant execute on function public.claim_topic_tag_work(integer) to service_role;
