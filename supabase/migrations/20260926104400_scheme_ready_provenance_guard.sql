-- Scheme documents may be discovered before their provenance is complete, but
-- anything eligible for runtime retrieval must have immutable, policy-backed
-- provenance at the database boundary.

alter table public.scheme_document
  drop constraint if exists scheme_document_ready_provenance_required;

alter table public.scheme_document
  add constraint scheme_document_ready_provenance_required
  check (
    extraction_status not in ('ready','complete','extracted')
    or (
      policy_id is not null
      and nullif(btrim(source_version), '') is not null
      and sha256 ~ '^[0-9a-f]{64}$'
      and retrieved_at is not null
      and nullif(btrim(parser_version), '') is not null
      and copyright_access_class in ('public_official','licensed_official')
      and revoked_at is null
    )
  );

create or replace function private.enforce_scheme_ready_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.scheme_source_policy;
  v_source_host text;
begin
  if new.extraction_status not in ('ready','complete','extracted') then
    return new;
  end if;

  if new.policy_id is null then
    raise exception 'Ready scheme document requires source policy'
      using errcode = '23514';
  end if;

  select *
    into v_policy
  from public.scheme_source_policy
  where id = new.policy_id;

  if not found then
    raise exception 'Scheme source policy not found'
      using errcode = '23503';
  end if;

  if not v_policy.active or not v_policy.reproduction_permitted then
    raise exception 'Scheme source policy does not permit retrieval-ready content'
      using errcode = '23514';
  end if;

  if v_policy.copyright_access_class
     not in ('public_official','licensed_official') then
    raise exception 'Scheme source policy is metadata-only or not ingestible'
      using errcode = '23514';
  end if;

  if new.copyright_access_class <> v_policy.copyright_access_class then
    raise exception 'Scheme document access class does not match source policy'
      using errcode = '23514';
  end if;

  v_source_host := lower(
    split_part(
      split_part(new.source_url, '://', 2),
      '/',
      1
    )
  );
  v_source_host := regexp_replace(v_source_host, '^www\.', '');

  if v_source_host <> lower(regexp_replace(v_policy.hostname, '^www\.', '')) then
    raise exception 'Scheme source hostname does not match source policy'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_scheme_ready_policy() from public, anon, authenticated;

drop trigger if exists scheme_document_ready_policy_guard
  on public.scheme_document;

create trigger scheme_document_ready_policy_guard
before insert or update of
  extraction_status,
  policy_id,
  source_url,
  copyright_access_class,
  source_version,
  sha256,
  retrieved_at,
  parser_version,
  revoked_at
on public.scheme_document
for each row
execute function private.enforce_scheme_ready_policy();

comment on constraint scheme_document_ready_provenance_required
  on public.scheme_document is
  'Retrieval-ready scheme content must have immutable provenance and a reproduction-permitted access class.';

comment on function private.enforce_scheme_ready_policy() is
  'Fail-closed guard: ready official-scheme content must use an active reproduction-permitted policy whose hostname/access class match the source.';
