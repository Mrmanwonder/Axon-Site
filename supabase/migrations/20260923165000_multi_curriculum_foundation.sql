-- Axon multi-curriculum foundation.
-- Additive by design: legacy board/class/subject fields remain readable while the
-- normalized model becomes authoritative for new profile writes.

create table if not exists public.curriculum_provider (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  source_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_programme (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, label)
);

create table if not exists public.curriculum_stage (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.curriculum_programme(id),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  school_year_label text,
  legacy_class_level smallint check (legacy_class_level is null or legacy_class_level between 9 and 12),
  sort_order smallint not null,
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_subject (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id),
  canonical_name text not null,
  group_key text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, canonical_name)
);

create table if not exists public.curriculum_source (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id),
  source_type text not null,
  url text not null,
  publication_year smallint,
  version_label text not null,
  fetched_at timestamptz not null default now(),
  sha256 text,
  parser_version text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  unique(provider_id, url, version_label)
);

create table if not exists public.subject_offering (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.curriculum_programme(id),
  stage_id uuid references public.curriculum_stage(id),
  subject_id uuid not null references public.curriculum_subject(id),
  display_name text not null,
  external_code text,
  external_code_kind text,
  levels_supported text[] not null default '{}'::text[],
  availability text not null default 'active'
    check (availability in ('active','retired','upcoming')),
  language_code text,
  variant text not null default '',
  aliases text[] not null default '{}'::text[],
  source_url text not null,
  source_version text,
  source_checked_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(programme_id, stage_id, subject_id, external_code, variant),
  check (external_code_kind is not null or external_code is null),
  check (levels_supported <@ array['SL','HL']::text[])
);

create index if not exists subject_offering_programme_stage_idx
  on public.subject_offering(programme_id, stage_id, availability);
create index if not exists subject_offering_code_idx
  on public.subject_offering(programme_id, external_code)
  where external_code is not null;
create index if not exists subject_offering_name_idx
  on public.subject_offering(programme_id, lower(display_name));

alter table public.student
  add column if not exists programme_id uuid references public.curriculum_programme(id),
  add column if not exists stage_id uuid references public.curriculum_stage(id),
  add column if not exists curriculum_version text;

alter table public.student_subject
  add column if not exists subject_offering_id uuid references public.subject_offering(id),
  add column if not exists selected_level text,
  add column if not exists display_name_snapshot text,
  add column if not exists external_code_snapshot text;

alter table public.student_subject
  drop constraint if exists student_subject_selected_level_check;
alter table public.student_subject
  add constraint student_subject_selected_level_check
  check (selected_level is null or selected_level in ('SL','HL'));

create unique index if not exists student_subject_offering_unique
  on public.student_subject(student_id, subject_offering_id)
  where subject_offering_id is not null;

create table if not exists public.assessment_identity (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.curriculum_programme(id),
  subject_offering_id uuid references public.subject_offering(id),
  level text check (level is null or level in ('SL','HL')),
  exam_year smallint check (exam_year is null or exam_year between 1900 and 2100),
  session text,
  paper_code text,
  component_code text,
  variant text,
  zone text,
  assessment_route text,
  title text not null,
  official_source_url text,
  source_document_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessment_identity_lookup_idx
  on public.assessment_identity(programme_id, subject_offering_id, exam_year, session);

create table if not exists public.scheme_document (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id),
  assessment_identity_id uuid not null references public.assessment_identity(id) on delete cascade,
  source_url text not null,
  source_kind text not null,
  source_version text,
  sha256 text,
  retrieved_at timestamptz,
  copyright_access_class text not null
    check (copyright_access_class in ('public_official','licensed_official','metadata_only','not_ingestible')),
  extraction_status text not null default 'pending',
  parser_version text,
  metadata jsonb not null default '{}'::jsonb,
  unique(assessment_identity_id, source_url, source_version)
);

alter table public.canonical_question
  add column if not exists assessment_identity_id uuid references public.assessment_identity(id);

-- Reference data is readable after authentication; browser clients cannot mutate it.
alter table public.curriculum_provider enable row level security;
alter table public.curriculum_programme enable row level security;
alter table public.curriculum_stage enable row level security;
alter table public.curriculum_subject enable row level security;
alter table public.curriculum_source enable row level security;
alter table public.subject_offering enable row level security;
alter table public.assessment_identity enable row level security;
alter table public.scheme_document enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'curriculum_provider','curriculum_programme','curriculum_stage',
    'curriculum_subject','curriculum_source','subject_offering','assessment_identity'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Scheme documents are service/admin data. Do not expose licensing/provenance rows
-- directly to the browser until a purpose-built read API is needed.
revoke all on public.scheme_document from anon, authenticated;

comment on table public.curriculum_provider is
  'First-class curriculum/awarding providers. Provider, programme, stage and subject identity are deliberately separate.';
comment on table public.subject_offering is
  'Authoritative selectable curriculum offering. Carries provider-specific codes, stage availability and IB level support.';
comment on column public.student.programme_id is
  'Normalized curriculum programme. New profile writes use this instead of public.student.board.';
comment on column public.student.stage_id is
  'Normalized curriculum stage. Legacy class_level remains only for compatibility.';
comment on column public.student_subject.subject_offering_id is
  'Authoritative selected subject identity. Legacy subject/syllabus_code remain snapshots for compatibility.';
comment on table public.scheme_document is
  'Official or licensed marking-scheme source registry. copyright_access_class prevents restricted material from being treated as ingestible.';
