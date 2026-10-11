-- AXO-226: additive retrieval boundary. No corpus is implicitly licensed, and
-- no existing topic worker is switched to this API before its measured eval.
create table private.syllabus_retrieval_approval (
  subject_offering_id uuid not null references public.subject_offering(id) on delete cascade,
  document_id uuid not null references public.syllabus_document(id) on delete cascade,
  -- Empty level means an offering without a separate assessment level.
  assessment_level text not null default '',
  programme_id uuid not null references public.curriculum_programme(id),
  stage_id uuid not null references public.curriculum_stage(id),
  subject_code text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  version_label text not null,
  source_url text not null check (source_url ~ '^https://'),
  valid_from_year smallint not null,
  valid_to_year smallint not null,
  -- '' explicitly includes unqualified objectives. No automatic SL/HL or AS/A expansion.
  qualification_scopes text[] not null check (
    cardinality(qualification_scopes) between 1 and 7
    and array_position(qualification_scopes, null) is null
    and qualification_scopes <@ array['','AS','A','IGCSE_CORE','IGCSE_EXTENDED','SL','HL']::text[]),
  rights_basis text not null check (length(btrim(rights_basis)) > 0),
  approval_reference text not null check (length(btrim(approval_reference)) > 0),
  approved_by text not null check (length(btrim(approved_by)) > 0),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (subject_offering_id, document_id, assessment_level),
  check (valid_to_year >= valid_from_year)
);
create index syllabus_retrieval_approval_document_idx
  on private.syllabus_retrieval_approval(document_id);
create index syllabus_retrieval_approval_programme_idx
  on private.syllabus_retrieval_approval(programme_id);
create index syllabus_retrieval_approval_stage_idx
  on private.syllabus_retrieval_approval(stage_id);
alter table private.syllabus_retrieval_approval enable row level security;
revoke all on private.syllabus_retrieval_approval from public, anon, authenticated, service_role;
-- Only a database operator can approve a source; the runtime can read, not approve it.
grant select on private.syllabus_retrieval_approval to service_role;

-- A changed parsed corpus or source needs fresh approval, even if later restored.
create function private.revoke_syllabus_retrieval_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_TABLE_NAME = 'syllabus_topic' then
    if TG_OP <> 'INSERT' then
      update private.syllabus_retrieval_approval set revoked_at = clock_timestamp()
      where document_id = OLD.document_id and revoked_at is null;
    end if;
    if TG_OP <> 'DELETE' then
      update private.syllabus_retrieval_approval set revoked_at = clock_timestamp()
      where document_id = NEW.document_id and revoked_at is null;
    end if;
  else
    update private.syllabus_retrieval_approval set revoked_at = clock_timestamp()
    where document_id = OLD.id and revoked_at is null;
  end if;
  return null;
end;
$$;
revoke all on function private.revoke_syllabus_retrieval_approval() from public, anon, authenticated;
create trigger syllabus_topic_revoke_retrieval after insert or update or delete
  on public.syllabus_topic for each row execute function private.revoke_syllabus_retrieval_approval();
create trigger syllabus_document_revoke_retrieval after update of
  provider_key, syllabus_code, version_label, valid_from_year, valid_to_year,
  source_url, source_sha256, status, verified_at, verified_by
  on public.syllabus_document for each row execute function private.revoke_syllabus_retrieval_approval();

create index syllabus_topic_retrieval_fts_idx on public.syllabus_topic using gin (
  to_tsvector('simple'::regconfig, coalesce(code,'') || ' ' || title || ' ' || coalesce(objective_text,''))
) where kind = 'objective';
create index syllabus_topic_retrieval_code_idx on public.syllabus_topic(document_id, code)
  where kind = 'objective';

create function public.resolve_syllabus_retrieval_scope(p_paper_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.paper%rowtype;
  o public.subject_offering%rowtype;
  a public.assessment_identity%rowtype;
  d public.syllabus_document%rowtype;
  approval private.syllabus_retrieval_approval%rowtype;
  provider text;
  exam_year integer;
  v_level text := '';
  n integer;
begin
  select * into p from public.paper where id = p_paper_id;
  if not found or p.subject_offering_id is null or p.subject_verified_at is null then
    return jsonb_build_object('status','unavailable','reason','subject_unresolved');
  end if;
  select so.* into o from public.subject_offering so
    join public.curriculum_programme pr on pr.id=so.programme_id and pr.active
    join public.curriculum_stage st on st.id=so.stage_id and st.programme_id=pr.id and st.active
    join public.curriculum_provider cp on cp.id=pr.provider_id and cp.active
    where so.id=p.subject_offering_id and so.availability='active';
  if not found or o.external_code is null then
    return jsonb_build_object('status','unavailable','reason','subject_unresolved');
  end if;
  select cp.key into provider from public.curriculum_programme pr
    join public.curriculum_provider cp on cp.id=pr.provider_id where pr.id=o.programme_id;
  exam_year := extract(year from p.exam_date)::integer;
  if p.assessment_identity_id is not null then
    select * into a from public.assessment_identity where id=p.assessment_identity_id;
    if not found or a.subject_offering_id is distinct from o.id
       or a.programme_id is distinct from o.programme_id then
      return jsonb_build_object('status','unavailable','reason','subject_unresolved');
    end if;
    if exam_year is not null and a.exam_year is not null and exam_year <> a.exam_year then
      return jsonb_build_object('status','unavailable','reason','exam_year_ambiguous');
    end if;
    exam_year := coalesce(exam_year,a.exam_year);
    v_level := coalesce(a.level,'');
  end if;
  if exam_year is null then
    return jsonb_build_object('status','unavailable','reason','exam_year_unresolved');
  end if;
  if cardinality(o.levels_supported)>0 and not (v_level=any(o.levels_supported)) then
    return jsonb_build_object('status','unavailable','reason','qualification_unresolved');
  end if;
  select count(*) into n from public.subject_offering_syllabus m
    join public.syllabus_document sd on sd.id=m.document_id
    where m.subject_offering_id=o.id and sd.provider_key=provider and sd.syllabus_code=o.external_code
      and sd.status <> 'retired';
  if n=0 then return jsonb_build_object('status','unavailable','reason','missing'); end if;
  if not exists (select 1 from public.subject_offering_syllabus m
    join public.syllabus_document sd on sd.id=m.document_id
    where m.subject_offering_id=o.id and sd.provider_key=provider and sd.syllabus_code=o.external_code
      and sd.status='verified') then
    return jsonb_build_object('status','unavailable','reason','draft_only');
  end if;
  -- Unknown validity is not unlimited validity. No latest-version fallback.
  select count(*) into n from public.subject_offering_syllabus m
    join public.syllabus_document sd on sd.id=m.document_id
    where m.subject_offering_id=o.id and sd.provider_key=provider and sd.syllabus_code=o.external_code
      and sd.status='verified' and exam_year between sd.valid_from_year and sd.valid_to_year;
  if n=0 then return jsonb_build_object('status','unavailable','reason','outside_validity'); end if;
  if n<>1 then return jsonb_build_object('status','unavailable','reason','version_ambiguous'); end if;
  select sd.* into d from public.subject_offering_syllabus m
    join public.syllabus_document sd on sd.id=m.document_id
    where m.subject_offering_id=o.id and sd.provider_key=provider and sd.syllabus_code=o.external_code
      and sd.status='verified' and exam_year between sd.valid_from_year and sd.valid_to_year;
  -- assessment_identity.source_document_version describes the assessment itself,
  -- not necessarily its syllabus: it must not be used as a syllabus version pin.
  select * into approval from private.syllabus_retrieval_approval r
    where r.subject_offering_id=o.id and r.document_id=d.id and r.assessment_level=v_level
      and r.programme_id=o.programme_id and r.stage_id=o.stage_id and r.subject_code=o.external_code
      and r.source_sha256=d.source_sha256 and r.version_label=d.version_label and r.source_url=d.source_url
      and r.valid_from_year=d.valid_from_year and r.valid_to_year=d.valid_to_year
      and r.revoked_at is null;
  if not found then return jsonb_build_object('status','unavailable','reason','unlicensed'); end if;
  return jsonb_build_object('status','available','document_id',d.id,'source_sha256',d.source_sha256,
    'version_label',d.version_label,'source_url',d.source_url,'exam_year',exam_year,
    'subject_offering_id',o.id,'qualification_scopes',approval.qualification_scopes);
end;
$$;
revoke all on function public.resolve_syllabus_retrieval_scope(uuid) from public, anon, authenticated;
grant execute on function public.resolve_syllabus_retrieval_scope(uuid) to service_role;

-- Only trusted server code supplies paper/document/hash. Model output supplies
-- p_query alone. Every call rechecks the current source, rights and paper scope.
create function public.search_syllabus_topics(
  p_paper_id uuid, p_document_id uuid, p_source_sha256 text, p_query text, p_limit integer default 12
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  scope jsonb;
  query tsquery;
  results jsonb;
begin
  if p_query is null or octet_length(p_query)>512 or length(btrim(p_query))=0
     or p_limit is null or p_limit not between 1 and 20 then
    return jsonb_build_object('status','unavailable','reason','invalid_query','candidates','[]'::jsonb);
  end if;
  scope := public.resolve_syllabus_retrieval_scope(p_paper_id);
  if scope->>'status' <> 'available' then return scope || jsonb_build_object('candidates','[]'::jsonb); end if;
  if (scope->>'document_id')::uuid is distinct from p_document_id
     or scope->>'source_sha256' is distinct from p_source_sha256 then
    return jsonb_build_object('status','unavailable','reason','scope_changed','candidates','[]'::jsonb);
  end if;
  -- plainto_tsquery treats hostile/SQL-looking strings as data, disallows broad
  -- negation-only searches, and preserves non-English lexemes without stemming.
  query := plainto_tsquery('simple'::regconfig,p_query);
  with candidates as (
    select t.*, ts_rank_cd(to_tsvector('simple'::regconfig,
      coalesce(t.code,'') || ' ' || t.title || ' ' || coalesce(t.objective_text,'')),query) as rank
    from public.syllabus_topic t where t.document_id=p_document_id and t.kind='objective'
      and t.source_page is not null and nullif(btrim(t.objective_text),'') is not null
      and coalesce(t.qualification_scope,'') in (select jsonb_array_elements_text(scope->'qualification_scopes'))
      and (t.code=btrim(p_query) or to_tsvector('simple'::regconfig,
        coalesce(t.code,'') || ' ' || t.title || ' ' || coalesce(t.objective_text,'')) @@ query)
    order by (t.code=btrim(p_query)) desc nulls last, rank desc, t.sort_order, t.id
    limit p_limit
  ), bounded as (
    select c.*, row_number() over (order by (c.code=btrim(p_query)) desc nulls last, rank desc, sort_order, id) as ord
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
  return scope || jsonb_build_object('candidates',results,'retrieval','lexical_v1');
end;
$$;
revoke all on function public.search_syllabus_topics(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.search_syllabus_topics(uuid,uuid,text,text,integer) to service_role;
comment on function public.search_syllabus_topics(uuid,uuid,text,text,integer) is
  'AXO-226 service-only shortlist, never a topic judgment. Bind identity server-side; do not log query text. Requires a statement timeout at the calling connection/HTTP request boundary.';
