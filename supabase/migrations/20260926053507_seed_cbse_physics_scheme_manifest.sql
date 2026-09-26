-- Seed the first reviewed official-scheme registry manifest without storing
-- protected/content-bearing question text. The official CBSE 2026-27 Physics
-- SQP/MS pair was verified by axon-backend Actions run 36221046663 using the
-- strict cbse-sqp-ms-v1 parser before this migration was authored.
--
-- Verification:
--   subject code: 042
--   class: XII
--   session: 2026-27
--   exam year: 2027
--   paired coverage: 30/33 base questions (90.909%)
--   canonical question records prepared by parser: 31
--   SQP SHA-256: ab406f5a98544cbef94c467a8e45b6471a7b206ee8ad31188eb165412f68e556
--   MS  SHA-256: 7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80
--
-- The scheme_document remains pending. It is intentionally not retrieval-ready
-- until the service-role ingestion path writes verified canonical questions.

do $$
declare
  v_provider uuid;
  v_programme uuid;
  v_stage uuid;
  v_offering uuid;
  v_policy uuid;
  v_identity uuid;
  v_existing_document public.scheme_document;
begin
  select cp.id
    into strict v_provider
  from public.curriculum_provider cp
  where cp.key='cbse';

  select pr.id
    into strict v_programme
  from public.curriculum_programme pr
  where pr.key='cbse_senior_secondary';

  select st.id
    into strict v_stage
  from public.curriculum_stage st
  where st.programme_id=v_programme
    and st.key='cbse_12';

  select so.id
    into strict v_offering
  from public.subject_offering so
  where so.programme_id=v_programme
    and so.stage_id=v_stage
    and lower(so.display_name)='physics'
    and so.availability='active';

  if exists (
    select 1
    from public.subject_offering so
    where so.programme_id=v_programme
      and so.stage_id=v_stage
      and so.external_code='042'
      and so.id<>v_offering
  ) then
    raise exception 'CBSE XII subject code 042 is already assigned to another offering';
  end if;

  update public.subject_offering
  set external_code='042',
      external_code_kind='cbse_subject_code',
      source_checked_at=timestamptz '2026-09-26T05:31:48.698Z',
      metadata=coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'registry_verified_code', true,
          'registry_verification_run_id', '36221046663'
        ),
      updated_at=now()
  where id=v_offering
    and external_code is null;

  if exists (
    select 1
    from public.subject_offering
    where id=v_offering
      and external_code is distinct from '042'
  ) then
    raise exception 'CBSE XII Physics external code conflicts with verified official code 042';
  end if;

  select ssp.id
    into strict v_policy
  from public.scheme_source_policy ssp
  where ssp.provider_id=v_provider
    and ssp.source_kind='marking_scheme'
    and ssp.hostname='cbseacademic.nic.in'
    and ssp.active
    and ssp.reproduction_permitted
    and ssp.copyright_access_class='public_official';

  select ai.id
    into v_identity
  from public.assessment_identity ai
  where ai.programme_id=v_programme
    and ai.subject_offering_id=v_offering
    and ai.level is null
    and ai.exam_year=2027
    and ai.session='2026-27'
    and ai.paper_code is null
    and ai.component_code is null
    and ai.variant is null
    and ai.zone is null
    and ai.assessment_route='sample_paper';

  if v_identity is null then
    insert into public.assessment_identity(
      programme_id,
      subject_offering_id,
      level,
      exam_year,
      session,
      paper_code,
      component_code,
      variant,
      zone,
      assessment_route,
      title,
      official_source_url,
      source_document_version,
      metadata
    )
    values(
      v_programme,
      v_offering,
      null,
      2027,
      '2026-27',
      null,
      null,
      null,
      null,
      'sample_paper',
      'Physics Sample Question Paper 2026-27',
      'https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-SQP.pdf',
      '2026-27:ab406f5a98544cbe',
      jsonb_build_object(
        'provider', 'cbse',
        'class_level', 12,
        'subject_code', '042',
        'sqp_sha256', 'ab406f5a98544cbef94c467a8e45b6471a7b206ee8ad31188eb165412f68e556',
        'source_kind', 'sample_question_paper',
        'verified_at', '2026-09-26T05:31:48.698Z',
        'verification_run_id', '36221046663',
        'verified_coverage', 0.9090909090909091,
        'prepared_canonical_questions', 31
      )
    )
    returning id into v_identity;
  else
    update public.assessment_identity
    set title='Physics Sample Question Paper 2026-27',
        official_source_url='https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-SQP.pdf',
        source_document_version='2026-27:ab406f5a98544cbe',
        metadata=coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'provider', 'cbse',
            'class_level', 12,
            'subject_code', '042',
            'sqp_sha256', 'ab406f5a98544cbef94c467a8e45b6471a7b206ee8ad31188eb165412f68e556',
            'source_kind', 'sample_question_paper',
            'verified_at', '2026-09-26T05:31:48.698Z',
            'verification_run_id', '36221046663',
            'verified_coverage', 0.9090909090909091,
            'prepared_canonical_questions', 31
          ),
        updated_at=now()
    where id=v_identity;
  end if;

  select sd.*
    into v_existing_document
  from public.scheme_document sd
  where sd.provider_id=v_provider
    and sd.sha256='7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80'
    and sd.source_kind='marking_scheme';

  if found and v_existing_document.assessment_identity_id<>v_identity then
    raise exception 'Verified CBSE Physics marking-scheme hash is already bound to another assessment identity';
  end if;

  if not found then
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
      revoked_at,
      revocation_reason,
      metadata
    )
    values(
      v_provider,
      v_identity,
      v_policy,
      'https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-MS.pdf',
      'marking_scheme',
      '2026-27:7aec844a3c6f4c4d',
      '7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80',
      timestamptz '2026-09-26T05:31:48.698Z',
      'public_official',
      'pending',
      'cbse-sqp-ms-v1',
      null,
      null,
      jsonb_build_object(
        'subject_code', '042',
        'class_level', 12,
        'session', '2026-27',
        'coverage', 0.9090909090909091,
        'parsed', jsonb_build_object(
          'sqpBlocks', 39,
          'msBlocks', 39,
          'coveredBaseQuestions', 30,
          'expectedQuestions', 33
        ),
        'prepared_canonical_questions', 31,
        'verification_run_id', '36221046663',
        'verification_status', 'source_verified_write_blocked_missing_service_role',
        'terms_url', 'https://www.cbse.gov.in/cbsenew/documents/WEBSITE_POLICY_U.pdf',
        'policy_version', 'verified-2026-09-24'
      )
    );
  else
    update public.scheme_document
    set assessment_identity_id=v_identity,
        policy_id=v_policy,
        source_url='https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-MS.pdf',
        source_version='2026-27:7aec844a3c6f4c4d',
        retrieved_at=timestamptz '2026-09-26T05:31:48.698Z',
        copyright_access_class='public_official',
        extraction_status=case
          when extraction_status in ('ready','complete','extracted') then extraction_status
          else 'pending'
        end,
        parser_version='cbse-sqp-ms-v1',
        metadata=coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'subject_code', '042',
            'class_level', 12,
            'session', '2026-27',
            'coverage', 0.9090909090909091,
            'parsed', jsonb_build_object(
              'sqpBlocks', 39,
              'msBlocks', 39,
              'coveredBaseQuestions', 30,
              'expectedQuestions', 33
            ),
            'prepared_canonical_questions', 31,
            'verification_run_id', '36221046663',
            'verification_status', 'source_verified_write_blocked_missing_service_role',
            'terms_url', 'https://www.cbse.gov.in/cbsenew/documents/WEBSITE_POLICY_U.pdf',
            'policy_version', 'verified-2026-09-24'
          )
    where id=v_existing_document.id;
  end if;
end;
$$;
