-- Scheme source governance must fail closed at the database boundary.

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql
as $$ insert into public._r(name, passed, detail) values (n, p, d); $$;

do $$
declare
  v_provider uuid;
  v_programme uuid;
  v_offering uuid;
  v_identity uuid;
  v_policy uuid;
  v_document uuid;
  v_blocked boolean;
begin
  select cp.id
    into strict v_provider
  from public.curriculum_provider cp
  where cp.key='cbse';

  select pr.id
    into strict v_programme
  from public.curriculum_programme pr
  where pr.key='cbse_senior_secondary';

  select so.id
    into strict v_offering
  from public.subject_offering so
  join public.curriculum_stage st on st.id=so.stage_id
  where so.programme_id=v_programme
    and st.key='cbse_12'
    and so.availability='active'
  order by so.display_name
  limit 1;

  select ssp.id
    into strict v_policy
  from public.scheme_source_policy ssp
  where ssp.provider_id=v_provider
    and ssp.source_kind='marking_scheme'
    and ssp.hostname='cbseacademic.nic.in'
    and ssp.active;

  insert into public.assessment_identity(
    programme_id,
    subject_offering_id,
    exam_year,
    session,
    assessment_route,
    title,
    official_source_url,
    source_document_version,
    metadata
  )
  values(
    v_programme,
    v_offering,
    2099,
    'governance-test',
    'sample_paper',
    'Governance test assessment',
    'https://cbseacademic.nic.in/governance-test-sqp.pdf',
    'governance-test',
    '{}'::jsonb
  )
  returning id into v_identity;

  -- Pending metadata can exist before provenance is complete.
  insert into public.scheme_document(
    provider_id,
    assessment_identity_id,
    source_url,
    source_kind,
    source_version,
    sha256,
    retrieved_at,
    copyright_access_class,
    extraction_status,
    parser_version,
    metadata
  )
  values(
    v_provider,
    v_identity,
    'https://cbseacademic.nic.in/governance-test-pending.pdf',
    'marking_scheme',
    null,
    null,
    null,
    'public_official',
    'pending',
    null,
    '{}'::jsonb
  )
  returning id into v_document;

  perform public._t(
    'pending scheme metadata may be incomplete before review',
    v_document is not null
  );

  -- Ready without policy/provenance must be rejected.
  v_blocked := false;
  begin
    insert into public.scheme_document(
      provider_id,
      assessment_identity_id,
      source_url,
      source_kind,
      source_version,
      sha256,
      retrieved_at,
      copyright_access_class,
      extraction_status,
      parser_version,
      metadata
    )
    values(
      v_provider,
      v_identity,
      'https://cbseacademic.nic.in/governance-test-unclassified.pdf',
      'marking_scheme',
      'v1',
      repeat('a',64),
      now(),
      'public_official',
      'ready',
      'test-parser',
      '{}'::jsonb
    );
  exception
    when check_violation then v_blocked := true;
  end;
  perform public._t(
    'ready scheme without policy is rejected',
    v_blocked
  );

  -- Host mismatch must be rejected even with the CBSE policy.
  v_blocked := false;
  begin
    insert into public.scheme_document(
      provider_id,
      assessment_identity_id,
      policy_id,
      source_url,
      source_kind,
      source_version,
      sha256,
      retrieved_at,
      copyright_access_class,
      extraction_status,
      parser_version,
      metadata
    )
    values(
      v_provider,
      v_identity,
      v_policy,
      'https://example.com/governance-test.pdf',
      'marking_scheme',
      'v2',
      repeat('b',64),
      now(),
      'public_official',
      'ready',
      'test-parser',
      '{}'::jsonb
    );
  exception
    when check_violation then v_blocked := true;
  end;
  perform public._t(
    'ready scheme source hostname must match policy',
    v_blocked
  );

  -- Access class must match the policy and cannot be metadata-only.
  v_blocked := false;
  begin
    insert into public.scheme_document(
      provider_id,
      assessment_identity_id,
      policy_id,
      source_url,
      source_kind,
      source_version,
      sha256,
      retrieved_at,
      copyright_access_class,
      extraction_status,
      parser_version,
      metadata
    )
    values(
      v_provider,
      v_identity,
      v_policy,
      'https://cbseacademic.nic.in/governance-test-wrong-class.pdf',
      'marking_scheme',
      'v3',
      repeat('c',64),
      now(),
      'metadata_only',
      'ready',
      'test-parser',
      '{}'::jsonb
    );
  exception
    when check_violation then v_blocked := true;
  end;
  perform public._t(
    'metadata-only scheme cannot become ready',
    v_blocked
  );

  -- Complete policy-backed provenance is accepted.
  insert into public.scheme_document(
    provider_id,
    assessment_identity_id,
    policy_id,
    source_url,
    source_kind,
    source_version,
    sha256,
    retrieved_at,
    copyright_access_class,
    extraction_status,
    parser_version,
    metadata
  )
  values(
    v_provider,
    v_identity,
    v_policy,
    'https://cbseacademic.nic.in/governance-test-valid.pdf',
    'marking_scheme',
    'v4',
    repeat('d',64),
    now(),
    'public_official',
    'ready',
    'test-parser',
    '{}'::jsonb
  )
  returning id into v_document;

  perform public._t(
    'ready CBSE scheme with complete permitted provenance is accepted',
    v_document is not null
  );

  -- Revoked content cannot remain retrieval-ready.
  v_blocked := false;
  begin
    update public.scheme_document
    set revoked_at=now(),
        revocation_reason='test revocation'
    where id=v_document;
  exception
    when check_violation then v_blocked := true;
  end;
  perform public._t(
    'revoked scheme cannot remain ready',
    v_blocked
  );

  -- Inactive policy cannot authorize new ready documents.
  update public.scheme_source_policy
  set active=false
  where id=v_policy;

  v_blocked := false;
  begin
    insert into public.scheme_document(
      provider_id,
      assessment_identity_id,
      policy_id,
      source_url,
      source_kind,
      source_version,
      sha256,
      retrieved_at,
      copyright_access_class,
      extraction_status,
      parser_version,
      metadata
    )
    values(
      v_provider,
      v_identity,
      v_policy,
      'https://cbseacademic.nic.in/governance-test-inactive-policy.pdf',
      'marking_scheme',
      'v5',
      repeat('e',64),
      now(),
      'public_official',
      'ready',
      'test-parser',
      '{}'::jsonb
    );
  exception
    when check_violation then v_blocked := true;
  end;
  perform public._t(
    'inactive source policy cannot authorize ready scheme',
    v_blocked
  );
end;
$$;

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail
from public._r
where not passed
order by seq;

rollback;
