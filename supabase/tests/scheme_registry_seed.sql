-- The reviewed CBSE Physics manifest must remain unique and auditable.

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql
as $$ insert into public._r(name, passed, detail) values (n, p, d); $$;

select public._t(
  'CBSE XII Physics has verified official code 042',
  (
    select count(*) = 1
    from public.subject_offering so
    join public.curriculum_stage st on st.id=so.stage_id
    join public.curriculum_programme pr on pr.id=so.programme_id
    where pr.key='cbse_senior_secondary'
      and st.key='cbse_12'
      and lower(so.display_name)='physics'
      and so.external_code='042'
      and so.external_code_kind='cbse_subject_code'
      and so.availability='active'
  )
);

select public._t(
  'Physics 2026-27 sample paper resolves to exactly one assessment identity',
  (
    select count(*) = 1
    from public.assessment_identity ai
    join public.subject_offering so on so.id=ai.subject_offering_id
    join public.curriculum_stage st on st.id=so.stage_id
    where st.key='cbse_12'
      and so.external_code='042'
      and ai.exam_year=2027
      and ai.session='2026-27'
      and ai.assessment_route='sample_paper'
      and ai.official_source_url='https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-SQP.pdf'
      and ai.metadata->>'sqp_sha256'='ab406f5a98544cbef94c467a8e45b6471a7b206ee8ad31188eb165412f68e556'
  )
);

select public._t(
  'verified Physics marking-scheme hash maps to one policy-backed document',
  (
    select count(*) = 1
    from public.scheme_document sd
    join public.scheme_source_policy sp on sp.id=sd.policy_id
    join public.curriculum_provider cp on cp.id=sd.provider_id
    where cp.key='cbse'
      and sd.sha256='7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80'
      and sd.source_url='https://cbseacademic.nic.in/web_material/SQP/ClassXII_2026_27/Physics-MS.pdf'
      and sd.source_version='2026-27:7aec844a3c6f4c4d'
      and sd.parser_version='cbse-sqp-ms-v1'
      and sd.copyright_access_class='public_official'
      and sp.hostname='cbseacademic.nic.in'
      and sp.active
      and sp.reproduction_permitted
  )
);

select public._t(
  'Physics scheme cannot be retrieval-ready without stored canonical evidence',
  not exists (
    select 1
    from public.scheme_document sd
    where sd.sha256='7aec844a3c6f4c4dbec23daed6553e5ea6e9e61624cce6a8cc5c2dd86d4b8f80'
      and sd.extraction_status in ('ready','complete','extracted')
      and not exists (
        select 1
        from public.canonical_question cq
        where cq.assessment_identity_id=sd.assessment_identity_id
          and cq.scheme_document_id=sd.id
      )
  )
);

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail
from public._r
where not passed
order by seq;

rollback;
