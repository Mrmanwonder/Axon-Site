-- Source-rights governance and revocation controls for official assessment evidence.
-- Runtime scheme retrieval must never infer reproduction rights from a URL.

create table if not exists public.scheme_source_policy (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.curriculum_provider(id) on delete cascade,
  source_kind text not null,
  hostname text not null,
  copyright_access_class text not null
    check (copyright_access_class in ('public_official','licensed_official','metadata_only','not_ingestible')),
  reproduction_permitted boolean not null,
  terms_url text not null,
  policy_version text not null,
  verified_at timestamptz not null,
  active boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, source_kind, hostname)
);

alter table public.scheme_source_policy enable row level security;
revoke all on public.scheme_source_policy from anon, authenticated;

alter table public.scheme_document
  add column if not exists policy_id uuid
    references public.scheme_source_policy(id) on delete restrict,
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists superseded_by_id uuid
    references public.scheme_document(id) on delete restrict;

alter table public.scheme_document
  drop constraint if exists scheme_document_revocation_reason_required;
alter table public.scheme_document
  add constraint scheme_document_revocation_reason_required
  check (revoked_at is null or nullif(btrim(revocation_reason), '') is not null);

create index if not exists scheme_document_active_assessment_idx
  on public.scheme_document(assessment_identity_id, extraction_status)
  where revoked_at is null;

create unique index if not exists scheme_document_provider_hash_kind_unique
  on public.scheme_document(provider_id, sha256, source_kind)
  where sha256 is not null;

insert into public.scheme_source_policy (
  provider_id, source_kind, hostname, copyright_access_class,
  reproduction_permitted, terms_url, policy_version, verified_at, notes, metadata
)
select
  cp.id,
  'marking_scheme',
  v.hostname,
  v.access_class,
  v.reproduction_permitted,
  v.terms_url,
  'verified-2026-09-24',
  timestamptz '2026-09-24T00:00:00Z',
  v.notes,
  jsonb_build_object('reviewed_for', 'Axon official marking-scheme registry')
from public.curriculum_provider cp
join (
  values
    (
      'cbse',
      'cbseacademic.nic.in',
      'public_official',
      true,
      'https://www.cbse.gov.in/cbsenew/documents/WEBSITE_POLICY_U.pdf',
      'CBSE website policy permits accurate reproduction with prominent source acknowledgement unless an item is separately identified as third-party/copyright-restricted.'
    ),
    (
      'cambridge',
      'cambridgeinternational.org',
      'metadata_only',
      false,
      'https://help.cambridgeinternational.org/hc/en-gb/articles/115004418469-How-do-I-apply-for-permission-to-use-Cambridge-copyrighted-material',
      'Cambridge explicitly states it does not grant permission for reproduction of mark schemes.'
    ),
    (
      'ib',
      'ibo.org',
      'metadata_only',
      false,
      'https://ibo.org/terms-and-conditions/intellectual-property',
      'IB exam materials and mark schemes require applicable licensed/authorized use; public metadata may be stored without reproducing the protected material.'
    )
) as v(provider_key, hostname, access_class, reproduction_permitted, terms_url, notes)
  on cp.key = v.provider_key
on conflict (provider_id, source_kind, hostname)
do update set
  copyright_access_class = excluded.copyright_access_class,
  reproduction_permitted = excluded.reproduction_permitted,
  terms_url = excluded.terms_url,
  policy_version = excluded.policy_version,
  verified_at = excluded.verified_at,
  notes = excluded.notes,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();

comment on table public.scheme_source_policy is
  'Service-role-only board/source rights policy. A scheme URL is not sufficient evidence of reproduction permission.';
comment on column public.scheme_document.policy_id is
  'Rights policy verified at ingestion time for this stored official document.';
comment on column public.scheme_document.revoked_at is
  'When set, runtime retrieval must fail closed even if extracted canonical questions still exist.';
