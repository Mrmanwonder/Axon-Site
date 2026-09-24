-- Versioned catalog seed generated from first-party 2026 sources.
-- Cambridge rows below preserve the currently verified production subset; the importer
-- committed beside this migration is the required path for full Cambridge reconciliation.

with p(key,name,source_url) as (
  values
  ('cambridge','Cambridge International Education','https://www.cambridgeinternational.org/'),
  ('cbse','Central Board of Secondary Education','https://cbseacademic.nic.in/'),
  ('ib','International Baccalaureate','https://ibo.org/')
)
insert into public.curriculum_provider(key,name,source_url)
select * from p on conflict(key) do update set name=excluded.name, source_url=excluded.source_url, updated_at=now();

with rows(provider_key,key,label) as (
 values
 ('cambridge','cambridge_igcse','Cambridge IGCSE'),
 ('cambridge','cambridge_as','Cambridge International AS Level'),
 ('cambridge','cambridge_a_level','Cambridge International A Level'),
 ('cbse','cbse_secondary','CBSE Secondary'),
 ('cbse','cbse_senior_secondary','CBSE Senior Secondary'),
 ('ib','ibdp','IB Diploma Programme')
)
insert into public.curriculum_programme(provider_id,key,label)
select p.id,r.key,r.label from rows r join public.curriculum_provider p on p.key=r.provider_key
on conflict(key) do update set label=excluded.label, updated_at=now();

with rows(programme_key,key,label,school_year,legacy_class,sort_order) as (
 values
 ('cambridge_igcse','cambridge_igcse_y10','IGCSE','Year 10',9,10),
 ('cambridge_igcse','cambridge_igcse_y11','IGCSE','Year 11',10,20),
 ('cambridge_as','cambridge_as','AS Level','Year 12',11,30),
 ('cambridge_a_level','cambridge_a_level','A Level','Year 13',12,40),
 ('cbse_secondary','cbse_9','Class 9','Class 9',9,10),
 ('cbse_secondary','cbse_10','Class 10','Class 10',10,20),
 ('cbse_senior_secondary','cbse_11','Class 11','Class 11',11,30),
 ('cbse_senior_secondary','cbse_12','Class 12','Class 12',12,40),
 ('ibdp','ibdp_1','DP1','DP1',null,10),
 ('ibdp','ibdp_2','DP2','DP2',null,20)
)
insert into public.curriculum_stage(programme_id,key,label,school_year_label,legacy_class_level,sort_order)
select p.id,r.key,r.label,r.school_year,r.legacy_class,r.sort_order from rows r join public.curriculum_programme p on p.key=r.programme_key
on conflict(key) do update set label=excluded.label, school_year_label=excluded.school_year_label, legacy_class_level=excluded.legacy_class_level, sort_order=excluded.sort_order, updated_at=now();

with s(provider_key,source_type,url,publication_year,version_label,parser_version) as (
 values
 ('cambridge','subject_catalog','https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/',2026,'2026-live','catalog-v1'),
 ('cambridge','subject_catalog','https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/',2026,'2026-live','catalog-v1'),
 ('cbse','curriculum_index','https://cbseacademic.nic.in/curriculum_2027.html',2026,'2026-27','catalog-v1'),
 ('cbse','skill_curriculum','https://cbseacademic.nic.in/skill-education-curriculum.html',2026,'2026-27','catalog-v1'),
 ('ib','subject_catalog_pdf','https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',2026,'2026','catalog-v1')
)
insert into public.curriculum_source(provider_id,source_type,url,publication_year,version_label,parser_version)
select p.id,s.source_type,s.url,s.publication_year,s.version_label,s.parser_version from s join public.curriculum_provider p on p.key=s.provider_key
on conflict(provider_id,url,version_label) do update set fetched_at=now(), parser_version=excluded.parser_version, active=true;


with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
       'Mathematics', '0580', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
       'Mathematics', '0580', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Additional Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Additional Mathematics')),
       'Additional Mathematics', '0606', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Additional Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Additional Mathematics')),
       'Additional Mathematics', '0606', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Physics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
       'Physics', '0625', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Physics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
       'Physics', '0625', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Chemistry', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
       'Chemistry', '0620', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Chemistry', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
       'Chemistry', '0620', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Biology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
       'Biology', '0610', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Biology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
       'Biology', '0610', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Combined Science', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Combined Science')),
       'Combined Science', '0653', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Combined Science', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Combined Science')),
       'Combined Science', '0653', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computer Science', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
       'Computer Science', '0478', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computer Science', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
       'Computer Science', '0478', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Economics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
       'Economics', '0455', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Economics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
       'Economics', '0455', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Business Studies', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business Studies')),
       'Business Studies', '0450', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Business Studies', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business Studies')),
       'Business Studies', '0450', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Accounting', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
       'Accounting', '0452', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Accounting', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
       'Accounting', '0452', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English — First Language', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English — First Language')),
       'English — First Language', '0500', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English — First Language', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English — First Language')),
       'English — First Language', '0500', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English as a Second Language', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language')),
       'English as a Second Language', '0510', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English as a Second Language', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language')),
       'English as a Second Language', '0510', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Literature', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Literature')),
       'English Literature', '0475', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Literature', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Literature')),
       'English Literature', '0475', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Geography', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
       'Geography', '0460', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Geography', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
       'Geography', '0460', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'History', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
       'History', '0470', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'History', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
       'History', '0470', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ICT', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='ICT')),
       'ICT', '0417', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ICT', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='ICT')),
       'ICT', '0417', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
       'Mathematics', '9709', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Further Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Further Mathematics')),
       'Further Mathematics', '9231', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Physics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
       'Physics', '9702', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Chemistry', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
       'Chemistry', '9701', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Biology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
       'Biology', '9700', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computer Science', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
       'Computer Science', '9618', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Economics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
       'Economics', '9708', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Business', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business')),
       'Business', '9609', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Accounting', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
       'Accounting', '9706', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Language', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Language')),
       'English Language', '9093', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Literature', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Literature')),
       'English Literature', '9695', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Psychology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Psychology')),
       'Psychology', '9990', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Geography', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
       'Geography', '9696', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'History', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
       'History', '9489', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sociology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sociology')),
       'Sociology', '9699', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
       'Mathematics', '9709', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Further Mathematics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Further Mathematics')),
       'Further Mathematics', '9231', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Physics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
       'Physics', '9702', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Chemistry', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
       'Chemistry', '9701', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Biology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
       'Biology', '9700', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computer Science', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
       'Computer Science', '9618', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Economics', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
       'Economics', '9708', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Business', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business')),
       'Business', '9609', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Accounting', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
       'Accounting', '9706', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Language', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Language')),
       'English Language', '9093', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Literature', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Literature')),
       'English Literature', '9695', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Psychology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Psychology')),
       'Psychology', '9990', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Geography', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
       'Geography', '9696', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'History', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
       'History', '9489', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sociology', null from public.curriculum_provider p where p.key='cambridge'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sociology')),
       'Sociology', '9699', 'syllabus_code', array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026', now(), '{"group":null}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Arabic', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Arabic')),
       'Arabic', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Assamese', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Assamese')),
       'Assamese', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bahasa Melayu', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bahasa Melayu')),
       'Bahasa Melayu', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bengali', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bengali')),
       'Bengali', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bhoti', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhoti')),
       'Bhoti', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bhutia', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhutia')),
       'Bhutia', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bodo', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bodo')),
       'Bodo', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Dogri', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Dogri')),
       'Dogri', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English')),
       'English', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'French', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='French')),
       'French', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'German', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='German')),
       'German', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Gujarati', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Gujarati')),
       'Gujarati', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Gurung', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Gurung')),
       'Gurung', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindi', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi')),
       'Hindi', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Japanese', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Japanese')),
       'Japanese', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Kannada', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kannada')),
       'Kannada', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Kashmiri', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kashmiri')),
       'Kashmiri', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Kokborok', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kokborok')),
       'Kokborok', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Konkani', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Konkani')),
       'Konkani', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Lepcha', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Lepcha')),
       'Lepcha', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Limboo', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Limboo')),
       'Limboo', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Malayalam', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Malayalam')),
       'Malayalam', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Manipuri', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Manipuri')),
       'Manipuri', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Marathi', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Marathi')),
       'Marathi', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Maithili', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Maithili')),
       'Maithili', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mizo', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mizo')),
       'Mizo', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Nepali', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Nepali')),
       'Nepali', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Odia', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Odia')),
       'Odia', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Persian', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Persian')),
       'Persian', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Punjabi', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Punjabi')),
       'Punjabi', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Rai', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Rai')),
       'Rai', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Russian', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Russian')),
       'Russian', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sanskrit', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit')),
       'Sanskrit', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Santhali', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Santhali')),
       'Santhali', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sindhi', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sindhi')),
       'Sindhi', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Spanish', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Spanish')),
       'Spanish', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sherpa', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sherpa')),
       'Sherpa', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tamang', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tamang')),
       'Tamang', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tamil', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tamil')),
       'Tamil', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tangkhul', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tangkhul')),
       'Tangkhul', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Telugu AP', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu AP')),
       'Telugu AP', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Telugu Telangana', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu Telangana')),
       'Telugu Telangana', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tibetan', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tibetan')),
       'Tibetan', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Thai', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Thai')),
       'Thai', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Urdu', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu')),
       'Urdu', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mathematics', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mathematics')),
       'Mathematics', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mathematics at Advanced Level', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mathematics at Advanced Level')),
       'Mathematics at Advanced Level', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Science', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Science')),
       'Science', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Science at Advanced Level', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Science at Advanced Level')),
       'Science at Advanced Level', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Social Science', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Social Science')),
       'Social Science', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Interdisciplinary Area', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Interdisciplinary Area')),
       'Interdisciplinary Area', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Vocational Education (Kaushal Vikas)', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Vocational Education (Kaushal Vikas)')),
       'Vocational Education (Kaushal Vikas)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computational Thinking & AI', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Computational Thinking & AI')),
       'Computational Thinking & AI', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Physical Education & Well Being', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Physical Education & Well Being')),
       'Physical Education & Well Being', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Art Education', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Art Education')),
       'Art Education', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Painting', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Painting')),
       'Painting', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'National Cadet Corps (NCC)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='National Cadet Corps (NCC)')),
       'National Cadet Corps (NCC)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computer Applications', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Computer Applications')),
       'Computer Applications', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Elements of Business', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Elements of Business')),
       'Elements of Business', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Elements of Book Keeping & Accountancy', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Elements of Book Keeping & Accountancy')),
       'Elements of Book Keeping & Accountancy', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Retail', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Retail')),
       'Retail', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Information Technology', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Information Technology')),
       'Information Technology', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Beauty & Wellness', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Beauty & Wellness')),
       'Beauty & Wellness', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Front Office Operations', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Front Office Operations')),
       'Front Office Operations', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Marketing and Sales', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Marketing and Sales')),
       'Marketing and Sales', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Artificial Intelligence', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Artificial Intelligence')),
       'Artificial Intelligence', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INTRODUCTION TO FINANCIAL MARKETS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INTRODUCTION TO FINANCIAL MARKETS')),
       'INTRODUCTION TO FINANCIAL MARKETS', '405', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INTRODUCTION TO TOURISM', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INTRODUCTION TO TOURISM')),
       'INTRODUCTION TO TOURISM', '406', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BEAUTY AND WELLNESS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BEAUTY AND WELLNESS')),
       'BEAUTY AND WELLNESS', '407', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_9'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Arabic', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Arabic')),
       'Arabic', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Assamese', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Assamese')),
       'Assamese', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bahasa Melayu', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bahasa Melayu')),
       'Bahasa Melayu', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bengali', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bengali')),
       'Bengali', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bhoti', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhoti')),
       'Bhoti', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bhutia', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhutia')),
       'Bhutia', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Bodo', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bodo')),
       'Bodo', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English - Language and Literature', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English - Language and Literature')),
       'English - Language and Literature', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Communicative', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English Communicative')),
       'English Communicative', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'French', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='French')),
       'French', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'German', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='German')),
       'German', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Gujarati', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Gujarati')),
       'Gujarati', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Gurung', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Gurung')),
       'Gurung', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindi Course-A', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Course-A')),
       'Hindi Course-A', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindi Course-B', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Course-B')),
       'Hindi Course-B', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Japanese', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Japanese')),
       'Japanese', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Kannada', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kannada')),
       'Kannada', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Kashmiri', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kashmiri')),
       'Kashmiri', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Kokborok', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kokborok')),
       'Kokborok', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Lepcha', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Lepcha')),
       'Lepcha', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Limboo', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Limboo')),
       'Limboo', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Malayalam', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Malayalam')),
       'Malayalam', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Manipuri', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Manipuri')),
       'Manipuri', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Marathi', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Marathi')),
       'Marathi', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mizo', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mizo')),
       'Mizo', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Nepali', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Nepali')),
       'Nepali', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Odia', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Odia')),
       'Odia', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Persian', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Persian')),
       'Persian', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Punjabi', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Punjabi')),
       'Punjabi', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Rai', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Rai')),
       'Rai', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Russian', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Russian')),
       'Russian', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sanskrit', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit')),
       'Sanskrit', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sanskrit Communiucative', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit Communiucative')),
       'Sanskrit Communiucative', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sindhi', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sindhi')),
       'Sindhi', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Spanish', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Spanish')),
       'Spanish', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sherpa', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sherpa')),
       'Sherpa', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tamang', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tamang')),
       'Tamang', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tamil', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tamil')),
       'Tamil', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tangkhul', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tangkhul')),
       'Tangkhul', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Telugu AP', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu AP')),
       'Telugu AP', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Telugu Telangana', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu Telangana')),
       'Telugu Telangana', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Tibetan', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tibetan')),
       'Tibetan', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Thai', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Thai')),
       'Thai', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Urdu', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu')),
       'Urdu', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Mathematics', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mathematics')),
       'Mathematics', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Science', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Science')),
       'Science', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Social Science', 'main' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Social Science')),
       'Social Science', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"main"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Carnatic Music (Vocal)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Music (Vocal)')),
       'Carnatic Music (Vocal)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Carnatic Music (Melodic Instruments)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Music (Melodic Instruments)')),
       'Carnatic Music (Melodic Instruments)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Carnatic Music (Percussion Instruments)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Music (Percussion Instruments)')),
       'Carnatic Music (Percussion Instruments)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindustani Music (Vocal)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Music (Vocal)')),
       'Hindustani Music (Vocal)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindustani Music (Melodic Instruments)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Music (Melodic Instruments)')),
       'Hindustani Music (Melodic Instruments)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindustani Music (Percussion Instruments)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Music (Percussion Instruments)')),
       'Hindustani Music (Percussion Instruments)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Painting', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Painting')),
       'Painting', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'National Cadet Corps (NCC)', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='National Cadet Corps (NCC)')),
       'National Cadet Corps (NCC)', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computer Applications', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Computer Applications')),
       'Computer Applications', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Elements of Business', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Elements of Business')),
       'Elements of Business', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Elements of Book Keeping and Accountancy', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Elements of Book Keeping and Accountancy')),
       'Elements of Book Keeping and Accountancy', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Health and Physical Education', 'internal' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Health and Physical Education')),
       'Health and Physical Education', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"internal"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Work Experience', 'internal' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Work Experience')),
       'Work Experience', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"internal"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Art Education', 'internal' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Art Education')),
       'Art Education', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"internal"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindi Core', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Core')),
       'Hindi Core', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindi Elective', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Elective')),
       'Hindi Elective', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Core', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English Core')),
       'English Core', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'English Elective', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English Elective')),
       'English Elective', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sanskrit Core', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit Core')),
       'Sanskrit Core', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sanskrit Elective', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit Elective')),
       'Sanskrit Elective', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Urdu Core', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu Core')),
       'Urdu Core', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Urdu Elective', 'language' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu Elective')),
       'Urdu Elective', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"language"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Accountancy', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Accountancy')),
       'Accountancy', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Biology', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Biology')),
       'Biology', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Biotechnology', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Biotechnology')),
       'Biotechnology', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Business Studies', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Business Studies')),
       'Business Studies', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Carnatic Melodic', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Melodic')),
       'Carnatic Melodic', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Carnatic Vocal', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Vocal')),
       'Carnatic Vocal', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Carnatic Percussion', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Percussion')),
       'Carnatic Percussion', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Chemistry', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Chemistry')),
       'Chemistry', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Computer Science', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Computer Science')),
       'Computer Science', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Economics', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Economics')),
       'Economics', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Engineering Graphics', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Engineering Graphics')),
       'Engineering Graphics', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Entrepreneurship', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Entrepreneurship')),
       'Entrepreneurship', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Fine Arts', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Fine Arts')),
       'Fine Arts', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Dance', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Dance')),
       'Dance', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Geography', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Geography')),
       'Geography', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindustani Melodic', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Melodic')),
       'Hindustani Melodic', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindustani Percussion', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Percussion')),
       'Hindustani Percussion', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Hindustani Vocal', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Vocal')),
       'Hindustani Vocal', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'History', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='History')),
       'History', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Infomatics Practices', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Infomatics Practices')),
       'Infomatics Practices', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Knowledge Tradition - Practices India', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Knowledge Tradition - Practices India')),
       'Knowledge Tradition - Practices India', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Legal Studies', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Legal Studies')),
       'Legal Studies', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Applied Mathematics', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Applied Mathematics')),
       'Applied Mathematics', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'NCC', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='NCC')),
       'NCC', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Physical Education', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Physical Education')),
       'Physical Education', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Physics', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Physics')),
       'Physics', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Political Science', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Political Science')),
       'Political Science', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Psychology', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Psychology')),
       'Psychology', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Sociology', 'elective' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sociology')),
       'Sociology', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"elective"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'General Studies', 'internal' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='General Studies')),
       'General Studies', null, null, array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html', '2026-27', now(), '{"group":"internal"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'RETAIL', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='RETAIL')),
       'RETAIL', '401', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INFORMATION TECHNOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INFORMATION TECHNOLOGY')),
       'INFORMATION TECHNOLOGY', '402', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'SECURITY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='SECURITY')),
       'SECURITY', '403', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AUTOMOTIVE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AUTOMOTIVE')),
       'AUTOMOTIVE', '404', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INTRODUCTION TO FINANCIAL MARKETS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INTRODUCTION TO FINANCIAL MARKETS')),
       'INTRODUCTION TO FINANCIAL MARKETS', '405', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INTRODUCTION TO TOURISM', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INTRODUCTION TO TOURISM')),
       'INTRODUCTION TO TOURISM', '406', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BEAUTY AND WELLNESS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BEAUTY AND WELLNESS')),
       'BEAUTY AND WELLNESS', '407', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AGRICULTURE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AGRICULTURE')),
       'AGRICULTURE', '408', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FOOD PRODUCTION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FOOD PRODUCTION')),
       'FOOD PRODUCTION', '409', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FRONT OFFICE OPERATIONS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FRONT OFFICE OPERATIONS')),
       'FRONT OFFICE OPERATIONS', '410', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BANKING AND INSURANCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BANKING AND INSURANCE')),
       'BANKING AND INSURANCE', '411', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MARKETING AND SALES', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MARKETING AND SALES')),
       'MARKETING AND SALES', '412', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'HEALTHCARE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='HEALTHCARE')),
       'HEALTHCARE', '413', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'APPAREL', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='APPAREL')),
       'APPAREL', '414', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MULTI-MEDIA', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MULTI-MEDIA')),
       'MULTI-MEDIA', '415', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MULTI SKILL FOUNDATION COURSE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MULTI SKILL FOUNDATION COURSE')),
       'MULTI SKILL FOUNDATION COURSE', '416', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ARTIFICIAL INTELLIGENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ARTIFICIAL INTELLIGENCE')),
       'ARTIFICIAL INTELLIGENCE', '417', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'PHYSICAL ACTIVITY TRAINER', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='PHYSICAL ACTIVITY TRAINER')),
       'PHYSICAL ACTIVITY TRAINER', '418', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'DATA SCIENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='DATA SCIENCE')),
       'DATA SCIENCE', '419', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ELECTRONICS & HARDWARE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ELECTRONICS & HARDWARE')),
       'ELECTRONICS & HARDWARE', '420', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Foundation Skills For Sciences (Pharmaceutical & Biotechnology)', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Foundation Skills For Sciences (Pharmaceutical & Biotechnology)')),
       'Foundation Skills For Sciences (Pharmaceutical & Biotechnology)', '421', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'DesignThinking', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='DesignThinking')),
       'DesignThinking', '422', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_10'
where pr.key='cbse_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'RETAIL', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='RETAIL')),
       'RETAIL', '801', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INFORMATION TECHOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INFORMATION TECHOLOGY')),
       'INFORMATION TECHOLOGY', '802', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'WEB APPLICATIONS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='WEB APPLICATIONS')),
       'WEB APPLICATIONS', '803', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AUTOMOTIVE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AUTOMOTIVE')),
       'AUTOMOTIVE', '804', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FINANCIAL MARKETS MANAGEMENT', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FINANCIAL MARKETS MANAGEMENT')),
       'FINANCIAL MARKETS MANAGEMENT', '805', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TOURISM', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TOURISM')),
       'TOURISM', '806', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BEAUTY AND WELLNESS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BEAUTY AND WELLNESS')),
       'BEAUTY AND WELLNESS', '807', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AGRICULTURE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AGRICULTURE')),
       'AGRICULTURE', '808', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FOOD PRODUCTION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FOOD PRODUCTION')),
       'FOOD PRODUCTION', '809', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FRONT OFFICE OPERATIONS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FRONT OFFICE OPERATIONS')),
       'FRONT OFFICE OPERATIONS', '810', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BANKING', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BANKING')),
       'BANKING', '811', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MARKETING', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MARKETING')),
       'MARKETING', '812', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'HEALTH CARE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='HEALTH CARE')),
       'HEALTH CARE', '813', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INSURANCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INSURANCE')),
       'INSURANCE', '814', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'HORTICULTURE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='HORTICULTURE')),
       'HORTICULTURE', '816', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TYPOGRAPHY AND COMPUTER APPLICATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TYPOGRAPHY AND COMPUTER APPLICATION')),
       'TYPOGRAPHY AND COMPUTER APPLICATION', '817', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'GEOSPATIAL TECHNOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='GEOSPATIAL TECHNOLOGY')),
       'GEOSPATIAL TECHNOLOGY', '818', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ELECTRICAL TECHNOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ELECTRICAL TECHNOLOGY')),
       'ELECTRICAL TECHNOLOGY', '819', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ELECTRONICS TECHNOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ELECTRONICS TECHNOLOGY')),
       'ELECTRONICS TECHNOLOGY', '820', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MULTI-MEDIA', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MULTI-MEDIA')),
       'MULTI-MEDIA', '821', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TAXATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TAXATION')),
       'TAXATION', '822', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'COST ACCOUNTING', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='COST ACCOUNTING')),
       'COST ACCOUNTING', '823', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'OFFICE PROCEDURES AND PRACTICES', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='OFFICE PROCEDURES AND PRACTICES')),
       'OFFICE PROCEDURES AND PRACTICES', '824', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'SHORTHAND ENGLISH', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='SHORTHAND ENGLISH')),
       'SHORTHAND ENGLISH', '825', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'SHORTHAND HINDI', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='SHORTHAND HINDI')),
       'SHORTHAND HINDI', '826', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AIR CONDITIONING AND REFRIGERATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AIR CONDITIONING AND REFRIGERATION')),
       'AIR CONDITIONING AND REFRIGERATION', '827', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MEDICAL DIAGNOSTICS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MEDICAL DIAGNOSTICS')),
       'MEDICAL DIAGNOSTICS', '828', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TEXTILE DESIGN', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TEXTILE DESIGN')),
       'TEXTILE DESIGN', '829', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'DESIGN', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='DESIGN')),
       'DESIGN', '830', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'SALESMANSHIP', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='SALESMANSHIP')),
       'SALESMANSHIP', '831', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BUSINESS ADMINISTRATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BUSINESS ADMINISTRATION')),
       'BUSINESS ADMINISTRATION', '833', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FOOD NUTRITION AND DIETETICS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FOOD NUTRITION AND DIETETICS')),
       'FOOD NUTRITION AND DIETETICS', '834', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MASS MEDIA STUDIES', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MASS MEDIA STUDIES')),
       'MASS MEDIA STUDIES', '835', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'LIBRARY AND INFORMATION SCIENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='LIBRARY AND INFORMATION SCIENCE')),
       'LIBRARY AND INFORMATION SCIENCE', '836', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FASHION STUDIES', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FASHION STUDIES')),
       'FASHION STUDIES', '837', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'YOGA', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='YOGA')),
       'YOGA', '841', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'EARLY CHILDHOOD CARE & EDUCATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='EARLY CHILDHOOD CARE & EDUCATION')),
       'EARLY CHILDHOOD CARE & EDUCATION', '842', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ARTIFICIAL INTELLIGENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ARTIFICIAL INTELLIGENCE')),
       'ARTIFICIAL INTELLIGENCE', '843', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'DATA SCIENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='DATA SCIENCE')),
       'DATA SCIENCE', '844', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'PHYSICAL ACTIVITY TRAINER', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='PHYSICAL ACTIVITY TRAINER')),
       'PHYSICAL ACTIVITY TRAINER', '845', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Land Transportation', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Land Transportation')),
       'Land Transportation', '846', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ELECTRONICS & HARDWARE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ELECTRONICS & HARDWARE')),
       'ELECTRONICS & HARDWARE', '847', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Design Thinking Innovation', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Design Thinking Innovation')),
       'Design Thinking Innovation', '848', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'RETAIL', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='RETAIL')),
       'RETAIL', '801', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INFORMATION TECHOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INFORMATION TECHOLOGY')),
       'INFORMATION TECHOLOGY', '802', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'WEB APPLICATIONS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='WEB APPLICATIONS')),
       'WEB APPLICATIONS', '803', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AUTOMOTIVE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AUTOMOTIVE')),
       'AUTOMOTIVE', '804', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FINANCIAL MARKETS MANAGEMENT', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FINANCIAL MARKETS MANAGEMENT')),
       'FINANCIAL MARKETS MANAGEMENT', '805', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TOURISM', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TOURISM')),
       'TOURISM', '806', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BEAUTY AND WELLNESS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BEAUTY AND WELLNESS')),
       'BEAUTY AND WELLNESS', '807', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AGRICULTURE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AGRICULTURE')),
       'AGRICULTURE', '808', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FOOD PRODUCTION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FOOD PRODUCTION')),
       'FOOD PRODUCTION', '809', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FRONT OFFICE OPERATIONS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FRONT OFFICE OPERATIONS')),
       'FRONT OFFICE OPERATIONS', '810', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BANKING', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BANKING')),
       'BANKING', '811', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MARKETING', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MARKETING')),
       'MARKETING', '812', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'HEALTH CARE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='HEALTH CARE')),
       'HEALTH CARE', '813', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'INSURANCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='INSURANCE')),
       'INSURANCE', '814', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'HORTICULTURE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='HORTICULTURE')),
       'HORTICULTURE', '816', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TYPOGRAPHY AND COMPUTER APPLICATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TYPOGRAPHY AND COMPUTER APPLICATION')),
       'TYPOGRAPHY AND COMPUTER APPLICATION', '817', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'GEOSPATIAL TECHNOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='GEOSPATIAL TECHNOLOGY')),
       'GEOSPATIAL TECHNOLOGY', '818', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ELECTRICAL TECHNOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ELECTRICAL TECHNOLOGY')),
       'ELECTRICAL TECHNOLOGY', '819', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ELECTRONICS TECHNOLOGY', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ELECTRONICS TECHNOLOGY')),
       'ELECTRONICS TECHNOLOGY', '820', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MULTI-MEDIA', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MULTI-MEDIA')),
       'MULTI-MEDIA', '821', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TAXATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TAXATION')),
       'TAXATION', '822', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'COST ACCOUNTING', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='COST ACCOUNTING')),
       'COST ACCOUNTING', '823', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'OFFICE PROCEDURES AND PRACTICES', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='OFFICE PROCEDURES AND PRACTICES')),
       'OFFICE PROCEDURES AND PRACTICES', '824', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'SHORTHAND ENGLISH', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='SHORTHAND ENGLISH')),
       'SHORTHAND ENGLISH', '825', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'SHORTHAND HINDI', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='SHORTHAND HINDI')),
       'SHORTHAND HINDI', '826', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'AIR CONDITIONING AND REFRIGERATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='AIR CONDITIONING AND REFRIGERATION')),
       'AIR CONDITIONING AND REFRIGERATION', '827', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MEDICAL DIAGNOSTICS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MEDICAL DIAGNOSTICS')),
       'MEDICAL DIAGNOSTICS', '828', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'TEXTILE DESIGN', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='TEXTILE DESIGN')),
       'TEXTILE DESIGN', '829', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'DESIGN', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='DESIGN')),
       'DESIGN', '830', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'SALESMANSHIP', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='SALESMANSHIP')),
       'SALESMANSHIP', '831', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'BUSINESS ADMINISTRATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='BUSINESS ADMINISTRATION')),
       'BUSINESS ADMINISTRATION', '833', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FOOD NUTRITION AND DIETETICS', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FOOD NUTRITION AND DIETETICS')),
       'FOOD NUTRITION AND DIETETICS', '834', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'MASS MEDIA STUDIES', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='MASS MEDIA STUDIES')),
       'MASS MEDIA STUDIES', '835', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'LIBRARY AND INFORMATION SCIENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='LIBRARY AND INFORMATION SCIENCE')),
       'LIBRARY AND INFORMATION SCIENCE', '836', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'FASHION STUDIES', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='FASHION STUDIES')),
       'FASHION STUDIES', '837', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'YOGA', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='YOGA')),
       'YOGA', '841', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'EARLY CHILDHOOD CARE & EDUCATION', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='EARLY CHILDHOOD CARE & EDUCATION')),
       'EARLY CHILDHOOD CARE & EDUCATION', '842', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ARTIFICIAL INTELLIGENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ARTIFICIAL INTELLIGENCE')),
       'ARTIFICIAL INTELLIGENCE', '843', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'DATA SCIENCE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='DATA SCIENCE')),
       'DATA SCIENCE', '844', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'PHYSICAL ACTIVITY TRAINER', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='PHYSICAL ACTIVITY TRAINER')),
       'PHYSICAL ACTIVITY TRAINER', '845', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Land Transportation', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Land Transportation')),
       'Land Transportation', '846', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'ELECTRONICS & HARDWARE', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='ELECTRONICS & HARDWARE')),
       'ELECTRONICS & HARDWARE', '847', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select p.id, 'Design Thinking Innovation', 'skill' from public.curriculum_provider p where p.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=coalesce(excluded.group_key,public.curriculum_subject.group_key), active=true, updated_at=now()
 returning id
)
insert into public.subject_offering(programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata)
select pr.id, st.id, coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Design Thinking Innovation')),
       'Design Thinking Innovation', '848', 'cbse_subject_code', array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/skill-education-curriculum.html', '2026-27', now(), '{"group":"skill"}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, external_code_kind=excluded.external_code_kind, levels_supported=excluded.levels_supported,
              aliases=excluded.aliases, availability='active', source_url=excluded.source_url, source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at, metadata=excluded.metadata, updated_at=now();

-- Deterministic backfill of current legacy Cambridge profiles.
update public.student s
set programme_id=p.id, stage_id=st.id, curriculum_version='legacy-backfill-2026'
from public.curriculum_programme p
join public.curriculum_stage st on st.programme_id=p.id
where s.programme_id is null
  and s.board in ('CAIE','IGCSE','AS_A_LEVEL')
  and (
    (s.class_level=9 and p.key='cambridge_igcse' and st.key='cambridge_igcse_y10') or
    (s.class_level=10 and p.key='cambridge_igcse' and st.key='cambridge_igcse_y11') or
    (s.class_level=11 and p.key='cambridge_as' and st.key='cambridge_as') or
    (s.class_level=12 and p.key='cambridge_a_level' and st.key='cambridge_a_level')
  );

update public.student s
set programme_id=p.id, stage_id=st.id, curriculum_version='legacy-backfill-2026'
from public.curriculum_programme p
join public.curriculum_stage st on st.programme_id=p.id
where s.programme_id is null and s.board='CBSE'
  and (
    (s.class_level=9 and p.key='cbse_secondary' and st.key='cbse_9') or
    (s.class_level=10 and p.key='cbse_secondary' and st.key='cbse_10') or
    (s.class_level=11 and p.key='cbse_senior_secondary' and st.key='cbse_11') or
    (s.class_level=12 and p.key='cbse_senior_secondary' and st.key='cbse_12')
  );

update public.student_subject ss
set subject_offering_id=so.id,
    display_name_snapshot=coalesce(ss.display_name_snapshot,ss.subject),
    external_code_snapshot=coalesce(ss.external_code_snapshot,ss.syllabus_code)
from public.student s
join public.subject_offering so on so.programme_id=s.programme_id and so.stage_id=s.stage_id
where ss.student_id=s.id
  and ss.subject_offering_id is null
  and (
    (ss.syllabus_code is not null and so.external_code=ss.syllabus_code)
    or (ss.syllabus_code is null and lower(so.display_name)=lower(ss.subject))
  );

comment on table public.curriculum_source is 'Versioned provenance for curriculum catalogs; source rows are never inferred from arbitrary mirrors.';
