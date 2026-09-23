-- Axon multi-curriculum foundation.
-- Additive compatibility migration: normalized curriculum identity becomes the
-- authority for new writes while legacy board/class/subject columns remain
-- readable for old clients and historical rows.

create table public.curriculum_provider (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(btrim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.curriculum_programme (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id) on delete restrict,
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(btrim(label)) > 0),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique(provider_id, key)
);

create table public.curriculum_stage (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.curriculum_programme(id) on delete restrict,
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(btrim(label)) > 0),
  school_year_label text,
  sort_order smallint not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  unique(programme_id, key)
);

create table public.curriculum_source (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id) on delete restrict,
  source_key text not null unique check (source_key ~ '^[a-z][a-z0-9_]*$'),
  source_type text not null,
  url text not null check (url ~ '^https://'),
  publication_year smallint,
  version_label text,
  fetched_at timestamptz,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  parser_version text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create table public.curriculum_subject (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id) on delete restrict,
  canonical_name text not null check (length(btrim(canonical_name)) > 0),
  group_key text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique(provider_id, canonical_name)
);

create table public.subject_offering (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.curriculum_programme(id) on delete restrict,
  stage_id uuid references public.curriculum_stage(id) on delete restrict,
  subject_id uuid not null references public.curriculum_subject(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) > 0),
  external_code text,
  external_code_kind text,
  levels_supported text[] not null default '{}'::text[],
  availability text not null default 'active'
    check (availability in ('active', 'retired', 'future')),
  language_code text,
  variant text,
  aliases text[] not null default '{}'::text[],
  source_id uuid not null references public.curriculum_source(id) on delete restrict,
  source_url text not null check (source_url ~ '^https://'),
  source_version text,
  source_checked_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint subject_offering_code_pair check (
    (external_code is null and external_code_kind is null)
    or (external_code is not null and external_code_kind is not null)
  ),
  constraint subject_offering_levels check (
    levels_supported <@ array['SL','HL']::text[]
  )
);

create unique index subject_offering_identity_unique
  on public.subject_offering(
    programme_id,
    coalesce(stage_id, '00000000-0000-0000-0000-000000000000'::uuid),
    subject_id,
    coalesce(external_code, ''),
    coalesce(variant, '')
  );
create index subject_offering_programme_stage_idx
  on public.subject_offering(programme_id, stage_id, availability);
create index subject_offering_code_idx
  on public.subject_offering(external_code) where external_code is not null;

-- Reference data is readable by signed-in product clients and writable only by
-- privileged ingestion paths. RLS remains useful even if grants drift later.
alter table public.curriculum_provider enable row level security;
alter table public.curriculum_programme enable row level security;
alter table public.curriculum_stage enable row level security;
alter table public.curriculum_source enable row level security;
alter table public.curriculum_subject enable row level security;
alter table public.subject_offering enable row level security;

create policy curriculum_provider_read on public.curriculum_provider
  for select to authenticated using (true);
create policy curriculum_programme_read on public.curriculum_programme
  for select to authenticated using (true);
create policy curriculum_stage_read on public.curriculum_stage
  for select to authenticated using (true);
create policy curriculum_source_read on public.curriculum_source
  for select to authenticated using (true);
create policy curriculum_subject_read on public.curriculum_subject
  for select to authenticated using (true);
create policy subject_offering_read on public.subject_offering
  for select to authenticated using (true);

revoke insert, update, delete on public.curriculum_provider from authenticated, anon;
revoke insert, update, delete on public.curriculum_programme from authenticated, anon;
revoke insert, update, delete on public.curriculum_stage from authenticated, anon;
revoke insert, update, delete on public.curriculum_source from authenticated, anon;
revoke insert, update, delete on public.curriculum_subject from authenticated, anon;
revoke insert, update, delete on public.subject_offering from authenticated, anon;
grant select on public.curriculum_provider, public.curriculum_programme,
  public.curriculum_stage, public.curriculum_source, public.curriculum_subject,
  public.subject_offering to authenticated;

-- Stable top-level taxonomy. IDs are deliberately generated in the target DB;
-- all relationships below resolve by key rather than hard-coded generated IDs.
insert into public.curriculum_provider(key, name) values
  ('cambridge', 'Cambridge International Education'),
  ('cbse', 'Central Board of Secondary Education'),
  ('ib', 'International Baccalaureate');

insert into public.curriculum_programme(provider_id, key, label)
select p.id, v.key, v.label
from (values
  ('cambridge', 'cambridge_igcse', 'Cambridge IGCSE'),
  ('cambridge', 'cambridge_as', 'Cambridge International AS Level'),
  ('cambridge', 'cambridge_a_level', 'Cambridge International A Level'),
  ('cbse', 'cbse_secondary', 'CBSE Secondary'),
  ('cbse', 'cbse_senior_secondary', 'CBSE Senior Secondary'),
  ('ib', 'ibdp', 'IB Diploma Programme')
) as v(provider_key, key, label)
join public.curriculum_provider p on p.key = v.provider_key;

insert into public.curriculum_stage(programme_id, key, label, school_year_label, sort_order)
select pr.id, v.stage_key, v.stage_label, v.school_year_label, v.sort_order
from (values
  ('cambridge_igcse', 'cambridge_igcse', 'IGCSE', null::text, 10::smallint),
  ('cambridge_as', 'cambridge_as', 'AS Level', null::text, 20::smallint),
  ('cambridge_a_level', 'cambridge_a_level', 'A Level', null::text, 30::smallint),
  ('cbse_secondary', 'cbse_9', 'Class 9', 'Class IX', 10::smallint),
  ('cbse_secondary', 'cbse_10', 'Class 10', 'Class X', 20::smallint),
  ('cbse_senior_secondary', 'cbse_11', 'Class 11', 'Class XI', 10::smallint),
  ('cbse_senior_secondary', 'cbse_12', 'Class 12', 'Class XII', 20::smallint),
  ('ibdp', 'ibdp_1', 'DP1', 'Diploma Programme year 1', 10::smallint),
  ('ibdp', 'ibdp_2', 'DP2', 'Diploma Programme year 2', 20::smallint)
) as v(programme_key, stage_key, stage_label, school_year_label, sort_order)
join public.curriculum_programme pr on pr.key = v.programme_key;

insert into public.curriculum_source(
  provider_id, source_key, source_type, url, publication_year, version_label, active
)
select p.id, v.source_key, v.source_type, v.url, v.publication_year, v.version_label, true
from (values
  ('cambridge', 'cambridge_igcse_subjects', 'official_subject_catalog',
   'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/',
   2026::smallint, 'checked-2026-09-23'),
  ('cambridge', 'cambridge_as_a_subjects', 'official_subject_catalog',
   'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/',
   2026::smallint, 'checked-2026-09-23'),
  ('cbse', 'cbse_curriculum_2027', 'official_curriculum_index',
   'https://cbseacademic.nic.in/curriculum_2027.html',
   2026::smallint, '2026-27'),
  ('cbse', 'cbse_skill_curriculum', 'official_skill_curriculum',
   'https://cbseacademic.nic.in/skill-education-curriculum.html',
   2026::smallint, '2026-27'),
  ('ib', 'ibdp_all_subjects', 'official_subject_catalog_pdf',
   'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
   2026::smallint, 'checked-2026-09-23')
) as v(provider_key, source_key, source_type, url, publication_year, version_label)
join public.curriculum_provider p on p.key = v.provider_key;

-- Normalized curriculum identity on students. Legacy values remain for old
-- clients, but are nullable so IB is not encoded as a fake board/class.
alter table public.student
  add column programme_id uuid references public.curriculum_programme(id) on delete restrict,
  add column stage_id uuid references public.curriculum_stage(id) on delete restrict,
  add column curriculum_version text;

alter table public.student alter column board drop not null;
alter table public.student alter column class_level drop not null;

-- Deterministic legacy backfill only. Ambiguous AS_A_LEVEL rows outside class
-- 11/12 remain un-normalized rather than being guessed.
update public.student s
set programme_id = pr.id,
    stage_id = st.id,
    curriculum_version = 'legacy-backfill-2026-09-23'
from public.curriculum_programme pr
join public.curriculum_stage st on st.programme_id = pr.id
where s.programme_id is null
  and (
    (s.board in ('CAIE'::public.board, 'IGCSE'::public.board)
      and s.class_level in (9,10)
      and pr.key = 'cambridge_igcse' and st.key = 'cambridge_igcse')
    or
    (s.board in ('CAIE'::public.board, 'AS_A_LEVEL'::public.board)
      and s.class_level = 11
      and pr.key = 'cambridge_as' and st.key = 'cambridge_as')
    or
    (s.board in ('CAIE'::public.board, 'AS_A_LEVEL'::public.board)
      and s.class_level = 12
      and pr.key = 'cambridge_a_level' and st.key = 'cambridge_a_level')
    or
    (s.board = 'CBSE'::public.board and s.class_level = 9
      and pr.key = 'cbse_secondary' and st.key = 'cbse_9')
    or
    (s.board = 'CBSE'::public.board and s.class_level = 10
      and pr.key = 'cbse_secondary' and st.key = 'cbse_10')
    or
    (s.board = 'CBSE'::public.board and s.class_level = 11
      and pr.key = 'cbse_senior_secondary' and st.key = 'cbse_11')
    or
    (s.board = 'CBSE'::public.board and s.class_level = 12
      and pr.key = 'cbse_senior_secondary' and st.key = 'cbse_12')
  );

alter table public.student_subject
  add column subject_offering_id uuid references public.subject_offering(id) on delete restrict,
  add column selected_level text,
  add column display_name_snapshot text,
  add column external_code_snapshot text,
  add constraint student_subject_selected_level check (
    selected_level is null or selected_level in ('SL','HL')
  );

update public.student_subject
set display_name_snapshot = subject,
    external_code_snapshot = syllabus_code
where display_name_snapshot is null;

create unique index student_subject_offering_unique
  on public.student_subject(student_id, subject_offering_id)
  where subject_offering_id is not null;

-- Exact official-assessment identity and source-document provenance. Existing
-- Cambridge canonical fields stay intact during the compatibility period.
create table public.assessment_identity (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.curriculum_programme(id) on delete restrict,
  subject_offering_id uuid not null references public.subject_offering(id) on delete restrict,
  level text check (level is null or level in ('SL','HL')),
  exam_year smallint not null check (exam_year between 2000 and 2100),
  session text,
  paper_code text,
  component_code text,
  variant text,
  time_zone text,
  assessment_route text,
  title text not null check (length(btrim(title)) > 0),
  official_source_url text not null check (official_source_url ~ '^https://'),
  source_document_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index assessment_identity_lookup_idx on public.assessment_identity(
  programme_id, subject_offering_id, exam_year, session, paper_code, component_code, variant
);

create table public.scheme_document (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id) on delete restrict,
  assessment_identity_id uuid not null references public.assessment_identity(id) on delete restrict,
  source_url text not null check (source_url ~ '^https://'),
  source_kind text not null,
  source_version text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_at timestamptz not null,
  copyright_access_class text not null
    check (copyright_access_class in ('public_official','licensed_official','metadata_only','not_ingestible')),
  extraction_status text not null,
  parser_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(assessment_identity_id, sha256)
);

alter table public.assessment_identity enable row level security;
alter table public.scheme_document enable row level security;
create policy assessment_identity_read on public.assessment_identity
  for select to authenticated using (true);
create policy scheme_document_read on public.scheme_document
  for select to authenticated using (true);
revoke insert, update, delete on public.assessment_identity from authenticated, anon;
revoke insert, update, delete on public.scheme_document from authenticated, anon;
grant select on public.assessment_identity, public.scheme_document to authenticated;

alter table public.canonical_question
  add column assessment_identity_id uuid references public.assessment_identity(id) on delete restrict;
alter table public.paper
  add column assessment_identity_id uuid references public.assessment_identity(id) on delete restrict;

create or replace function private.legacy_profile_fields(
  p_programme_key text,
  p_stage_key text
)
returns table(board public.board, class_level smallint)
language sql
stable
set search_path = ''
as $$
  select
    case
      when p_programme_key like 'cambridge_%' then 'CAIE'::public.board
      when p_programme_key like 'cbse_%' then 'CBSE'::public.board
      else null::public.board
    end,
    case p_stage_key
      when 'cambridge_igcse' then 10::smallint
      when 'cambridge_as' then 11::smallint
      when 'cambridge_a_level' then 12::smallint
      when 'cbse_9' then 9::smallint
      when 'cbse_10' then 10::smallint
      when 'cbse_11' then 11::smallint
      when 'cbse_12' then 12::smallint
      else null::smallint
    end;
$$;

create or replace function private.validate_profile_v2_selection(
  p_programme_key text,
  p_stage_key text,
  p_subjects jsonb
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_programme public.curriculum_programme;
  v_stage public.curriculum_stage;
  v_item jsonb;
  v_offering public.subject_offering;
  v_level text;
  v_count integer := 0;
  v_unique integer := 0;
begin
  select * into v_programme
  from public.curriculum_programme
  where key = p_programme_key and active;

  if not found then
    raise exception 'Unsupported curriculum programme' using errcode = '22023';
  end if;

  select * into v_stage
  from public.curriculum_stage
  where key = p_stage_key and programme_id = v_programme.id and active;

  if not found then
    raise exception 'Stage does not belong to programme' using errcode = '22023';
  end if;

  if p_subjects is null or jsonb_typeof(p_subjects) <> 'array'
     or jsonb_array_length(p_subjects) = 0 then
    raise exception 'Choose at least one subject' using errcode = '22023';
  end if;

  select count(*), count(distinct value->>'offering_id')
    into v_count, v_unique
  from jsonb_array_elements(p_subjects);

  if v_count <> v_unique then
    raise exception 'Duplicate subject selection' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_subjects) loop
    begin
      select * into v_offering
      from public.subject_offering
      where id = (v_item->>'offering_id')::uuid
        and programme_id = v_programme.id
        and availability = 'active';
    exception when invalid_text_representation then
      raise exception 'Invalid subject offering' using errcode = '22023';
    end;

    if not found then
      raise exception 'Subject is unavailable for programme' using errcode = '22023';
    end if;

    if v_offering.stage_id is not null and v_offering.stage_id <> v_stage.id then
      raise exception 'Subject is unavailable at selected stage' using errcode = '22023';
    end if;

    v_level := nullif(v_item->>'level', '');
    if cardinality(v_offering.levels_supported) > 0 then
      if v_level is null or not (v_level = any(v_offering.levels_supported)) then
        raise exception 'Unsupported subject level' using errcode = '22023';
      end if;
    elsif v_level is not null then
      raise exception 'Subject does not use a level' using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke all on function private.validate_profile_v2_selection(text,text,jsonb)
  from public, anon, authenticated;

create or replace function public.create_student_profile_v2(
  p_request_id uuid,
  p_first_name text,
  p_programme_key text,
  p_stage_key text,
  p_avatar_key text,
  p_subjects jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_programme public.curriculum_programme;
  v_stage public.curriculum_stage;
  v_profile public.student;
  v_legacy record;
begin
  if auth.uid() is null or v_guardian is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_request_id is null or nullif(btrim(p_first_name), '') is null then
    raise exception 'Invalid profile' using errcode = '22023';
  end if;
  if p_avatar_key is null or p_avatar_key !~ '^[a-zA-Z][a-zA-Z0-9]{0,39}$' then
    raise exception 'Invalid avatar preset' using errcode = '22023';
  end if;

  perform private.validate_profile_v2_selection(p_programme_key, p_stage_key, p_subjects);

  select * into strict v_programme
  from public.curriculum_programme where key = p_programme_key;
  select * into strict v_stage
  from public.curriculum_stage
  where key = p_stage_key and programme_id = v_programme.id;
  select * into v_legacy
  from private.legacy_profile_fields(p_programme_key, p_stage_key);

  insert into public.student(
    id, guardian_id, first_name, board, class_level, age_band,
    programme_id, stage_id, curriculum_version, avatar_seed
  )
  values(
    p_request_id, v_guardian, btrim(p_first_name), v_legacy.board,
    v_legacy.class_level, 'under_18', v_programme.id, v_stage.id,
    coalesce((select version_label from public.curriculum_source
      where provider_id = v_programme.provider_id and active
      order by publication_year desc nulls last, source_key limit 1), 'current'),
    p_avatar_key
  )
  on conflict(id) do nothing
  returning * into v_profile;

  if found then
    insert into public.student_subject(
      student_id, subject, syllabus_code, subject_offering_id, selected_level,
      display_name_snapshot, external_code_snapshot
    )
    select
      v_profile.id,
      o.display_name,
      case when o.external_code_kind = 'syllabus_code' then o.external_code else null end,
      o.id,
      nullif(x.level, ''),
      o.display_name,
      o.external_code
    from jsonb_to_recordset(p_subjects) as x(offering_id uuid, level text)
    join public.subject_offering o on o.id = x.offering_id;
  else
    select * into strict v_profile
    from public.student where id = p_request_id and guardian_id = v_guardian;
  end if;

  return to_jsonb(v_profile) || jsonb_build_object(
    'programme_key', p_programme_key,
    'stage_key', p_stage_key,
    'subject_selections', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'offering_id', ss.subject_offering_id,
        'display_name', ss.display_name_snapshot,
        'external_code', ss.external_code_snapshot,
        'level', ss.selected_level
      ) order by ss.display_name_snapshot), '[]'::jsonb)
      from public.student_subject ss where ss.student_id = v_profile.id
    )
  );
end;
$$;

revoke all on function public.create_student_profile_v2(uuid,text,text,text,text,jsonb)
  from public, anon;
grant execute on function public.create_student_profile_v2(uuid,text,text,text,text,jsonb)
  to authenticated;

create or replace function public.update_student_profile_v2(
  p_student_id uuid,
  p_first_name text,
  p_programme_key text,
  p_stage_key text,
  p_avatar_key text,
  p_subjects jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.student;
  v_programme public.curriculum_programme;
  v_stage public.curriculum_stage;
  v_old_provider uuid;
  v_legacy record;
begin
  if nullif(btrim(p_first_name), '') is null then
    raise exception 'Student first name is required' using errcode = '22023';
  end if;
  if p_avatar_key is null or p_avatar_key !~ '^[a-zA-Z][a-zA-Z0-9]{0,39}$' then
    raise exception 'Invalid avatar preset' using errcode = '22023';
  end if;

  select * into v_existing from public.student where id = p_student_id;
  if not found then
    raise exception 'Student profile was not found' using errcode = 'P0002';
  end if;

  perform private.validate_profile_v2_selection(p_programme_key, p_stage_key, p_subjects);

  select * into strict v_programme
  from public.curriculum_programme where key = p_programme_key;
  select * into strict v_stage
  from public.curriculum_stage
  where key = p_stage_key and programme_id = v_programme.id;

  if v_existing.programme_id is not null then
    select provider_id into v_old_provider
    from public.curriculum_programme where id = v_existing.programme_id;
  else
    select id into v_old_provider
    from public.curriculum_provider
    where key = case when v_existing.board = 'CBSE'::public.board then 'cbse' else 'cambridge' end;
  end if;

  if v_old_provider is distinct from v_programme.provider_id
     and exists (select 1 from public.paper where student_id = p_student_id) then
    raise exception 'Curriculum provider change requires paper migration'
      using errcode = '22023';
  end if;

  select * into v_legacy
  from private.legacy_profile_fields(p_programme_key, p_stage_key);

  update public.student
  set first_name = btrim(p_first_name),
      programme_id = v_programme.id,
      stage_id = v_stage.id,
      board = v_legacy.board,
      class_level = v_legacy.class_level,
      avatar_seed = p_avatar_key,
      curriculum_version = coalesce((select version_label
        from public.curriculum_source
        where provider_id = v_programme.provider_id and active
        order by publication_year desc nulls last, source_key limit 1), 'current'),
      updated_at = now()
  where id = p_student_id;

  delete from public.student_subject where student_id = p_student_id;

  insert into public.student_subject(
    student_id, subject, syllabus_code, subject_offering_id, selected_level,
    display_name_snapshot, external_code_snapshot
  )
  select
    p_student_id,
    o.display_name,
    case when o.external_code_kind = 'syllabus_code' then o.external_code else null end,
    o.id,
    nullif(x.level, ''),
    o.display_name,
    o.external_code
  from jsonb_to_recordset(p_subjects) as x(offering_id uuid, level text)
  join public.subject_offering o on o.id = x.offering_id;

  return (
    select to_jsonb(s) || jsonb_build_object(
      'programme_key', p_programme_key,
      'stage_key', p_stage_key,
      'subject_selections', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'offering_id', ss.subject_offering_id,
          'display_name', ss.display_name_snapshot,
          'external_code', ss.external_code_snapshot,
          'level', ss.selected_level
        ) order by ss.display_name_snapshot), '[]'::jsonb)
        from public.student_subject ss where ss.student_id = p_student_id
      )
    )
    from public.student s where s.id = p_student_id
  );
end;
$$;

revoke all on function public.update_student_profile_v2(uuid,text,text,text,text,jsonb)
  from public, anon;
grant execute on function public.update_student_profile_v2(uuid,text,text,text,text,jsonb)
  to authenticated;

comment on table public.subject_offering is
  'Authoritative selectable curriculum offering. Provider-specific assessment identity lives here rather than in frontend arrays.';
comment on column public.student.programme_id is
  'Normalized curriculum programme. New code must prefer this over the legacy board column.';
comment on column public.student.stage_id is
  'Normalized programme stage. Does not assume every curriculum uses a numeric class.';
comment on table public.scheme_document is
  'Provenance registry for official marking-scheme documents. Restricted content is never implied to be ingestible by the presence of metadata.';
