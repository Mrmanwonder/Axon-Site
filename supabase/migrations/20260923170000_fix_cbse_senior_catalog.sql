-- Correct the 2026-27 CBSE importer stage boundary and seed senior-secondary academics.
-- The original parser matched "XI-XII" as "Class X" before its senior branch.

update public.subject_offering so
set availability='retired', updated_at=now()
from public.curriculum_stage st, public.curriculum_programme pr
where so.stage_id=st.id
  and so.programme_id=pr.id
  and st.key='cbse_10'
  and pr.key='cbse_secondary'
  and coalesce(so.metadata->>'group','') <> 'skill'
  and so.display_name <> all(array['Arabic','Assamese','Bahasa Melayu','Bengali','Bhoti','Bhutia','Bodo','English - Language and Literature','English Communicative','French','German','Gujarati','Gurung','Hindi Course-A','Hindi Course-B','Japanese','Kannada','Kashmiri','Kokborok','Lepcha','Limboo','Malayalam','Manipuri','Marathi','Mizo','Nepali','Odia','Persian','Punjabi','Rai','Russian','Sanskrit','Sanskrit Communiucative','Sindhi','Spanish','Sherpa','Tamang','Tamil','Tangkhul','Telugu AP','Telugu Telangana','Tibetan','Thai','Urdu','Mathematics','Science','Social Science','Carnatic Music (Vocal)','Carnatic Music (Melodic Instruments)','Carnatic Music (Percussion Instruments)','Hindustani Music (Vocal)','Hindustani Music (Melodic Instruments)','Hindustani Music (Percussion Instruments)','Painting','Home Science','National Cadet Corps (NCC)','Computer Applications','Elements of Business','Elements of Book Keeping and Accountancy','Health and Physical Education','Work Experience','Art Education']);


with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Arabic','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Arabic')),
 'Arabic',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Assamese','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Assamese')),
 'Assamese',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bengali','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bengali')),
 'Bengali',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bhoti','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhoti')),
 'Bhoti',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bhutia','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhutia')),
 'Bhutia',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bodo','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bodo')),
 'Bodo',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'French','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='French')),
 'French',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'German','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='German')),
 'German',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Gujarati','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Gujarati')),
 'Gujarati',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindi Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Core')),
 'Hindi Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindi Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Elective')),
 'Hindi Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'English Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English Core')),
 'English Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'English Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English Elective')),
 'English Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Japanese','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Japanese')),
 'Japanese',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Kannada','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kannada')),
 'Kannada',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Kashmiri','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kashmiri')),
 'Kashmiri',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Kokborok','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kokborok')),
 'Kokborok',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Lepcha','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Lepcha')),
 'Lepcha',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Limboo','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Limboo')),
 'Limboo',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Malayalam','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Malayalam')),
 'Malayalam',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Manipuri','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Manipuri')),
 'Manipuri',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Marathi','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Marathi')),
 'Marathi',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Mizo','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mizo')),
 'Mizo',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Nepali','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Nepali')),
 'Nepali',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Odia','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Odia')),
 'Odia',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Persian','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Persian')),
 'Persian',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Punjabi','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Punjabi')),
 'Punjabi',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Russian','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Russian')),
 'Russian',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sanskrit Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit Core')),
 'Sanskrit Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sanskrit Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit Elective')),
 'Sanskrit Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sindhi','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sindhi')),
 'Sindhi',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Spanish','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Spanish')),
 'Spanish',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Tamil','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tamil')),
 'Tamil',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Tangkhul','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tangkhul')),
 'Tangkhul',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Telugu AP','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu AP')),
 'Telugu AP',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Telugu Telangana','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu Telangana')),
 'Telugu Telangana',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Tibetan','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tibetan')),
 'Tibetan',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Urdu Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu Core')),
 'Urdu Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Urdu Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu Elective')),
 'Urdu Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Accountancy','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Accountancy')),
 'Accountancy',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Biology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Biology')),
 'Biology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Biotechnology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Biotechnology')),
 'Biotechnology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Business Studies','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Business Studies')),
 'Business Studies',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Carnatic Melodic','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Melodic')),
 'Carnatic Melodic',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Carnatic Vocal','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Vocal')),
 'Carnatic Vocal',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Carnatic Percussion','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Percussion')),
 'Carnatic Percussion',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Chemistry','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Chemistry')),
 'Chemistry',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Computer Science','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Computer Science')),
 'Computer Science',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Economics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Economics')),
 'Economics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Engineering Graphics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Engineering Graphics')),
 'Engineering Graphics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Entrepreneurship','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Entrepreneurship')),
 'Entrepreneurship',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Fine Arts','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Fine Arts')),
 'Fine Arts',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Dance','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Dance')),
 'Dance',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Geography','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Geography')),
 'Geography',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindustani Melodic','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Melodic')),
 'Hindustani Melodic',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindustani Percussion','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Percussion')),
 'Hindustani Percussion',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindustani Vocal','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Vocal')),
 'Hindustani Vocal',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'History','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='History')),
 'History',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Home Science','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Home Science')),
 'Home Science',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Infomatics Practices','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Infomatics Practices')),
 'Infomatics Practices',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Knowledge Tradition - Practices India','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Knowledge Tradition - Practices India')),
 'Knowledge Tradition - Practices India',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Legal Studies','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Legal Studies')),
 'Legal Studies',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Mathematics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mathematics')),
 'Mathematics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Applied Mathematics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Applied Mathematics')),
 'Applied Mathematics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'NCC','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='NCC')),
 'NCC',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Physical Education','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Physical Education')),
 'Physical Education',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Physics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Physics')),
 'Physics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Political Science','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Political Science')),
 'Political Science',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Psychology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Psychology')),
 'Psychology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sociology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sociology')),
 'Sociology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Health and Physical Education','internal' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Health and Physical Education')),
 'Health and Physical Education',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','internal')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Work Experience','internal' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Work Experience')),
 'Work Experience',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','internal')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'General Studies','internal' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='General Studies')),
 'General Studies',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','internal')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_11'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Arabic','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Arabic')),
 'Arabic',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Assamese','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Assamese')),
 'Assamese',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bengali','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bengali')),
 'Bengali',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bhoti','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhoti')),
 'Bhoti',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bhutia','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bhutia')),
 'Bhutia',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Bodo','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Bodo')),
 'Bodo',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'French','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='French')),
 'French',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'German','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='German')),
 'German',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Gujarati','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Gujarati')),
 'Gujarati',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindi Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Core')),
 'Hindi Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindi Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindi Elective')),
 'Hindi Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'English Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English Core')),
 'English Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'English Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='English Elective')),
 'English Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Japanese','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Japanese')),
 'Japanese',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Kannada','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kannada')),
 'Kannada',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Kashmiri','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kashmiri')),
 'Kashmiri',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Kokborok','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Kokborok')),
 'Kokborok',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Lepcha','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Lepcha')),
 'Lepcha',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Limboo','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Limboo')),
 'Limboo',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Malayalam','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Malayalam')),
 'Malayalam',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Manipuri','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Manipuri')),
 'Manipuri',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Marathi','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Marathi')),
 'Marathi',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Mizo','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mizo')),
 'Mizo',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Nepali','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Nepali')),
 'Nepali',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Odia','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Odia')),
 'Odia',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Persian','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Persian')),
 'Persian',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Punjabi','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Punjabi')),
 'Punjabi',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Russian','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Russian')),
 'Russian',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sanskrit Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit Core')),
 'Sanskrit Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sanskrit Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sanskrit Elective')),
 'Sanskrit Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sindhi','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sindhi')),
 'Sindhi',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Spanish','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Spanish')),
 'Spanish',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Tamil','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tamil')),
 'Tamil',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Tangkhul','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tangkhul')),
 'Tangkhul',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Telugu AP','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu AP')),
 'Telugu AP',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Telugu Telangana','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Telugu Telangana')),
 'Telugu Telangana',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Tibetan','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Tibetan')),
 'Tibetan',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Urdu Core','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu Core')),
 'Urdu Core',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Urdu Elective','language' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Urdu Elective')),
 'Urdu Elective',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','language')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Accountancy','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Accountancy')),
 'Accountancy',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Biology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Biology')),
 'Biology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Biotechnology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Biotechnology')),
 'Biotechnology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Business Studies','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Business Studies')),
 'Business Studies',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Carnatic Melodic','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Melodic')),
 'Carnatic Melodic',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Carnatic Vocal','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Vocal')),
 'Carnatic Vocal',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Carnatic Percussion','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Carnatic Percussion')),
 'Carnatic Percussion',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Chemistry','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Chemistry')),
 'Chemistry',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Computer Science','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Computer Science')),
 'Computer Science',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Economics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Economics')),
 'Economics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Engineering Graphics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Engineering Graphics')),
 'Engineering Graphics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Entrepreneurship','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Entrepreneurship')),
 'Entrepreneurship',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Fine Arts','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Fine Arts')),
 'Fine Arts',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Dance','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Dance')),
 'Dance',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Geography','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Geography')),
 'Geography',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindustani Melodic','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Melodic')),
 'Hindustani Melodic',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindustani Percussion','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Percussion')),
 'Hindustani Percussion',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Hindustani Vocal','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Hindustani Vocal')),
 'Hindustani Vocal',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'History','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='History')),
 'History',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Home Science','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Home Science')),
 'Home Science',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Infomatics Practices','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Infomatics Practices')),
 'Infomatics Practices',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Knowledge Tradition - Practices India','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Knowledge Tradition - Practices India')),
 'Knowledge Tradition - Practices India',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Legal Studies','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Legal Studies')),
 'Legal Studies',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Mathematics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Mathematics')),
 'Mathematics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Applied Mathematics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Applied Mathematics')),
 'Applied Mathematics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'NCC','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='NCC')),
 'NCC',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Physical Education','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Physical Education')),
 'Physical Education',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Physics','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Physics')),
 'Physics',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Political Science','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Political Science')),
 'Political Science',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Psychology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Psychology')),
 'Psychology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Sociology','elective' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Sociology')),
 'Sociology',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','elective')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Health and Physical Education','internal' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Health and Physical Education')),
 'Health and Physical Education',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','internal')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'Work Experience','internal' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='Work Experience')),
 'Work Experience',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','internal')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name,group_key)
 select cp.id,'General Studies','internal' from public.curriculum_provider cp where cp.key='cbse'
 on conflict(provider_id,canonical_name) do update set group_key=excluded.group_key,active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cbse' and cs.canonical_name='General Studies')),
 'General Studies',null,null,array[]::text[],'',array[]::text[],
 'https://cbseacademic.nic.in/curriculum_2027.html','2026-27',now(),jsonb_build_object('group','internal')
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cbse_12'
where pr.key='cbse_senior_secondary'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

-- Exact-name legacy backfill only. "English" intentionally remains unresolved at
-- senior secondary because the official catalog has English Core and English Elective.
update public.student_subject ss
set subject_offering_id=so.id,
    display_name_snapshot=coalesce(ss.display_name_snapshot,ss.subject),
    external_code_snapshot=coalesce(ss.external_code_snapshot,so.external_code)
from public.student s, public.subject_offering so
where ss.student_id=s.id
  and ss.subject_offering_id is null
  and so.programme_id=s.programme_id
  and so.stage_id=s.stage_id
  and so.availability='active'
  and lower(so.display_name)=lower(ss.subject);
