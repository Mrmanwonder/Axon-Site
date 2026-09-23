-- Full live Cambridge IGCSE and International AS/A Level catalogs, reconciled
-- against Cambridge's official subject pages on 23 September 2026.

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Accounting' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
 'Accounting','0452','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Accounting' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
 'Accounting','0452','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Accounting (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting (9-1)')),
 'Accounting (9-1)','0985','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Accounting (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting (9-1)')),
 'Accounting (9-1)','0985','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Afrikaans - Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Afrikaans - Second Language')),
 'Afrikaans - Second Language','0548','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Afrikaans - Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Afrikaans - Second Language')),
 'Afrikaans - Second Language','0548','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Agriculture' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Agriculture')),
 'Agriculture','0600','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Agriculture' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Agriculture')),
 'Agriculture','0600','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic - First Language')),
 'Arabic - First Language','0508','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic - First Language')),
 'Arabic - First Language','0508','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic - First Language (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic - First Language (9-1)')),
 'Arabic - First Language (9-1)','7184','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic - First Language (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic - First Language (9-1)')),
 'Arabic - First Language (9-1)','7184','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic - Foreign Language')),
 'Arabic - Foreign Language','0544','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic - Foreign Language')),
 'Arabic - Foreign Language','0544','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic (9-1)')),
 'Arabic (9-1)','7180','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic (9-1)')),
 'Arabic (9-1)','7180','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Art & Design' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Art & Design')),
 'Art & Design','0400','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Art & Design' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Art & Design')),
 'Art & Design','0400','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Art & Design (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Art & Design (9-1)')),
 'Art & Design (9-1)','0989','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Art & Design (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Art & Design (9-1)')),
 'Art & Design (9-1)','0989','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Bahasa Indonesia' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Bahasa Indonesia')),
 'Bahasa Indonesia','0538','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Bahasa Indonesia' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Bahasa Indonesia')),
 'Bahasa Indonesia','0538','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
 'Biology','0610','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
 'Biology','0610','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biology (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology (9-1)')),
 'Biology (9-1)','0970','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biology (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology (9-1)')),
 'Biology (9-1)','0970','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business')),
 'Business','0264','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business')),
 'Business','0264','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business (9-1)')),
 'Business (9-1)','0774','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business (9-1)')),
 'Business (9-1)','0774','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business Studies')),
 'Business Studies','0450','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business Studies')),
 'Business Studies','0450','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business Studies (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business Studies (9-1)')),
 'Business Studies (9-1)','0986','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business Studies (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business Studies (9-1)')),
 'Business Studies (9-1)','0986','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chemistry' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
 'Chemistry','0620','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chemistry' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
 'Chemistry','0620','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chemistry (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry (9-1)')),
 'Chemistry (9-1)','0971','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chemistry (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry (9-1)')),
 'Chemistry (9-1)','0971','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese - First Language')),
 'Chinese - First Language','0509','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese - First Language')),
 'Chinese - First Language','0509','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese - Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese - Second Language')),
 'Chinese - Second Language','0523','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese - Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese - Second Language')),
 'Chinese - Second Language','0523','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese (Mandarin) - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese (Mandarin) - Foreign Language')),
 'Chinese (Mandarin) - Foreign Language','0547','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese (Mandarin) - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese (Mandarin) - Foreign Language')),
 'Chinese (Mandarin) - Foreign Language','0547','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Commerce' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Commerce')),
 'Commerce','0715','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Commerce' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Commerce')),
 'Commerce','0715','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Computer Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
 'Computer Science','0478','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Computer Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
 'Computer Science','0478','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Computer Science (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science (9-1)')),
 'Computer Science (9-1)','0984','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Computer Science (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science (9-1)')),
 'Computer Science (9-1)','0984','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Design & Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Design & Technology')),
 'Design & Technology','0445','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Design & Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Design & Technology')),
 'Design & Technology','0445','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Design & Technology (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Design & Technology (9-1)')),
 'Design & Technology (9-1)','0979','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Design & Technology (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Design & Technology (9-1)')),
 'Design & Technology (9-1)','0979','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Drama' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Drama')),
 'Drama','0411','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Drama' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Drama')),
 'Drama','0411','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Drama (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Drama (9-1)')),
 'Drama (9-1)','0994','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Drama (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Drama (9-1)')),
 'Drama (9-1)','0994','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Economics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
 'Economics','0455','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Economics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
 'Economics','0455','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Economics (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics (9-1)')),
 'Economics (9-1)','0987','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Economics (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics (9-1)')),
 'Economics (9-1)','0987','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - First Language')),
 'English - First Language','0500','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - First Language')),
 'English - First Language','0500','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - First Language (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - First Language (9-1)')),
 'English - First Language (9-1)','0990','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - First Language (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - First Language (9-1)')),
 'English - First Language (9-1)','0990','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - First Language (US)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - First Language (US)')),
 'English - First Language (US)','0524','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - First Language (US)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - First Language (US)')),
 'English - First Language (US)','0524','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - Literature in English' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - Literature in English')),
 'English - Literature in English','0475','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - Literature in English' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - Literature in English')),
 'English - Literature in English','0475','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - Literature in English (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - Literature in English (9-1)')),
 'English - Literature in English (9-1)','0992','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - Literature in English (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - Literature in English (9-1)')),
 'English - Literature in English (9-1)','0992','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English (as an Additional Language)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English (as an Additional Language)')),
 'English (as an Additional Language)','0472','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English (as an Additional Language)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English (as an Additional Language)')),
 'English (as an Additional Language)','0472','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English (as an Additional Language) (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English (as an Additional Language) (9-1)')),
 'English (as an Additional Language) (9-1)','0772','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English (as an Additional Language) (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English (as an Additional Language) (9-1)')),
 'English (as an Additional Language) (9-1)','0772','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English (Core) as a Second Language (Egypt)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English (Core) as a Second Language (Egypt)')),
 'English (Core) as a Second Language (Egypt)','0465','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English (Core) as a Second Language (Egypt)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English (Core) as a Second Language (Egypt)')),
 'English (Core) as a Second Language (Egypt)','0465','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Count-in speaking)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Count-in speaking)')),
 'English as a Second Language (Count-in speaking)','0511','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Count-in speaking)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Count-in speaking)')),
 'English as a Second Language (Count-in speaking)','0511','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Count-in Speaking) (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Count-in Speaking) (9-1)')),
 'English as a Second Language (Count-in Speaking) (9-1)','0991','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Count-in Speaking) (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Count-in Speaking) (9-1)')),
 'English as a Second Language (Count-in Speaking) (9-1)','0991','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Speaking endorsement)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Speaking endorsement)')),
 'English as a Second Language (Speaking endorsement)','0510','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Speaking endorsement)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Speaking endorsement)')),
 'English as a Second Language (Speaking endorsement)','0510','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Speaking Endorsement) (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Speaking Endorsement) (9-1)')),
 'English as a Second Language (Speaking Endorsement) (9-1)','0993','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English as a Second Language (Speaking Endorsement) (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English as a Second Language (Speaking Endorsement) (9-1)')),
 'English as a Second Language (Speaking Endorsement) (9-1)','0993','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Enterprise' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Enterprise')),
 'Enterprise','0454','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Enterprise' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Enterprise')),
 'Enterprise','0454','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Environmental Management' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Environmental Management')),
 'Environmental Management','0680','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Environmental Management' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Environmental Management')),
 'Environmental Management','0680','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Food & Nutrition' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Food & Nutrition')),
 'Food & Nutrition','0648','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Food & Nutrition' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Food & Nutrition')),
 'Food & Nutrition','0648','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French - First Language')),
 'French - First Language','0501','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French - First Language')),
 'French - First Language','0501','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French - Foreign Language')),
 'French - Foreign Language','0520','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French - Foreign Language')),
 'French - Foreign Language','0520','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French (9-1)')),
 'French (9-1)','7156','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French (9-1)')),
 'French (9-1)','7156','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Geography' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
 'Geography','0460','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Geography' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
 'Geography','0460','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Geography (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography (9-1)')),
 'Geography (9-1)','0976','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Geography (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography (9-1)')),
 'Geography (9-1)','0976','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German - First Language')),
 'German - First Language','0505','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German - First Language')),
 'German - First Language','0505','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German - Foreign Language')),
 'German - Foreign Language','0525','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German - Foreign Language')),
 'German - Foreign Language','0525','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German (9-1)')),
 'German (9-1)','7159','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German (9-1)')),
 'German (9-1)','7159','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Global Perspectives' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Global Perspectives')),
 'Global Perspectives','0457','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Global Perspectives' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Global Perspectives')),
 'Global Perspectives','0457','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Hindi as a Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Hindi as a Second Language')),
 'Hindi as a Second Language','0549','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Hindi as a Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Hindi as a Second Language')),
 'Hindi as a Second Language','0549','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
 'History','0470','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
 'History','0470','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History - American (US)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History - American (US)')),
 'History - American (US)','0409','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History - American (US)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History - American (US)')),
 'History - American (US)','0409','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History (9-1)')),
 'History (9-1)','0977','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History (9-1)')),
 'History (9-1)','0977','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Information and Communication Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Information and Communication Technology')),
 'Information and Communication Technology','0417','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Information and Communication Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Information and Communication Technology')),
 'Information and Communication Technology','0417','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Information and Communication Technology (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Information and Communication Technology (9-1)')),
 'Information and Communication Technology (9-1)','0983','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Information and Communication Technology (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Information and Communication Technology (9-1)')),
 'Information and Communication Technology (9-1)','0983','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'IsiZulu as a Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='IsiZulu as a Second Language')),
 'IsiZulu as a Second Language','0531','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'IsiZulu as a Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='IsiZulu as a Second Language')),
 'IsiZulu as a Second Language','0531','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Islamiyat' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Islamiyat')),
 'Islamiyat','0493','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Islamiyat' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Islamiyat')),
 'Islamiyat','0493','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Italian - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Italian - Foreign Language')),
 'Italian - Foreign Language','0535','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Italian - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Italian - Foreign Language')),
 'Italian - Foreign Language','0535','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Italian (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Italian (9-1)')),
 'Italian (9-1)','7164','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Italian (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Italian (9-1)')),
 'Italian (9-1)','7164','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Japanese - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Japanese - Foreign Language')),
 'Japanese - Foreign Language','0716','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Japanese - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Japanese - Foreign Language')),
 'Japanese - Foreign Language','0716','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Latin' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Latin')),
 'Latin','0480','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Latin' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Latin')),
 'Latin','0480','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Malay - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Malay - First Language')),
 'Malay - First Language','0696','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Malay - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Malay - First Language')),
 'Malay - First Language','0696','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Malay - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Malay - Foreign Language')),
 'Malay - Foreign Language','0546','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Malay - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Malay - Foreign Language')),
 'Malay - Foreign Language','0546','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Marine Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Marine Science')),
 'Marine Science','0697','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Marine Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Marine Science')),
 'Marine Science','0697','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
 'Mathematics','0580','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
 'Mathematics','0580','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics - Additional' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics - Additional')),
 'Mathematics - Additional','0606','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics - Additional' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics - Additional')),
 'Mathematics - Additional','0606','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics - International' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics - International')),
 'Mathematics - International','0607','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics - International' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics - International')),
 'Mathematics - International','0607','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics (9-1)')),
 'Mathematics (9-1)','0980','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics (9-1)')),
 'Mathematics (9-1)','0980','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics (US)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics (US)')),
 'Mathematics (US)','0444','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics (US)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics (US)')),
 'Mathematics (US)','0444','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Music' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Music')),
 'Music','0410','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Music' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Music')),
 'Music','0410','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Music (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Music (9-1)')),
 'Music (9-1)','0978','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Music (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Music (9-1)')),
 'Music (9-1)','0978','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Pakistan Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Pakistan Studies')),
 'Pakistan Studies','0448','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Pakistan Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Pakistan Studies')),
 'Pakistan Studies','0448','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physical Education' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physical Education')),
 'Physical Education','0413','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physical Education' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physical Education')),
 'Physical Education','0413','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physical Education (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physical Education (9-1)')),
 'Physical Education (9-1)','0995','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physical Education (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physical Education (9-1)')),
 'Physical Education (9-1)','0995','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physical Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physical Science')),
 'Physical Science','0652','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physical Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physical Science')),
 'Physical Science','0652','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
 'Physics','0625','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
 'Physics','0625','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physics (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics (9-1)')),
 'Physics (9-1)','0972','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physics (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics (9-1)')),
 'Physics (9-1)','0972','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Portuguese - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Portuguese - First Language')),
 'Portuguese - First Language','0504','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Portuguese - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Portuguese - First Language')),
 'Portuguese - First Language','0504','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Psychology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Psychology')),
 'Psychology','0266','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Psychology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Psychology')),
 'Psychology','0266','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Religious Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Religious Studies')),
 'Religious Studies','0490','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Religious Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Religious Studies')),
 'Religious Studies','0490','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sanskrit' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sanskrit')),
 'Sanskrit','0499','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sanskrit' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sanskrit')),
 'Sanskrit','0499','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Science - Combined' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Science - Combined')),
 'Science - Combined','0653','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Science - Combined' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Science - Combined')),
 'Science - Combined','0653','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sciences - Co-ordinated (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sciences - Co-ordinated (9-1)')),
 'Sciences - Co-ordinated (9-1)','0973','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sciences - Co-ordinated (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sciences - Co-ordinated (9-1)')),
 'Sciences - Co-ordinated (9-1)','0973','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sciences - Co-ordinated (Double)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sciences - Co-ordinated (Double)')),
 'Sciences - Co-ordinated (Double)','0654','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sciences - Co-ordinated (Double)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sciences - Co-ordinated (Double)')),
 'Sciences - Co-ordinated (Double)','0654','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Setswana - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Setswana - First Language')),
 'Setswana - First Language','0698','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Setswana - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Setswana - First Language')),
 'Setswana - First Language','0698','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sociology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sociology')),
 'Sociology','0495','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sociology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sociology')),
 'Sociology','0495','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish - First Language')),
 'Spanish - First Language','0502','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish - First Language')),
 'Spanish - First Language','0502','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish - Foreign Language')),
 'Spanish - Foreign Language','0530','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish - Foreign Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish - Foreign Language')),
 'Spanish - Foreign Language','0530','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish - Literature in Spanish' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish - Literature in Spanish')),
 'Spanish - Literature in Spanish','0474','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish - Literature in Spanish' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish - Literature in Spanish')),
 'Spanish - Literature in Spanish','0474','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish (9-1)')),
 'Spanish (9-1)','7160','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish (9-1)' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish (9-1)')),
 'Spanish (9-1)','7160','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Statistics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Statistics')),
 'Statistics','0479','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Statistics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Statistics')),
 'Statistics','0479','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Swahili' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Swahili')),
 'Swahili','0262','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Swahili' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Swahili')),
 'Swahili','0262','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Thai - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Thai - First Language')),
 'Thai - First Language','0518','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Thai - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Thai - First Language')),
 'Thai - First Language','0518','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Travel & Tourism' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Travel & Tourism')),
 'Travel & Tourism','0471','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Travel & Tourism' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Travel & Tourism')),
 'Travel & Tourism','0471','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Turkish - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Turkish - First Language')),
 'Turkish - First Language','0513','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Turkish - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Turkish - First Language')),
 'Turkish - First Language','0513','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Urdu as a Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Urdu as a Second Language')),
 'Urdu as a Second Language','0539','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Urdu as a Second Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Urdu as a Second Language')),
 'Urdu as a Second Language','0539','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Vietnamese - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Vietnamese - First Language')),
 'Vietnamese - First Language','0695','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Vietnamese - First Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Vietnamese - First Language')),
 'Vietnamese - First Language','0695','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'World Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='World Literature')),
 'World Literature','0408','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y10'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'World Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='World Literature')),
 'World Literature','0408','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_igcse_y11'
where pr.key='cambridge_igcse'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Accounting' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
 'Accounting','9706','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Accounting' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Accounting')),
 'Accounting','9706','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Afrikaans - Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Afrikaans - Language')),
 'Afrikaans - Language','8679','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic')),
 'Arabic','9680','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic')),
 'Arabic','9680','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic')),
 'Arabic','9865','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic')),
 'Arabic','9865','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Arabic - Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Arabic - Language')),
 'Arabic - Language','8680','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Art & Design' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Art & Design')),
 'Art & Design','9479','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Art & Design' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Art & Design')),
 'Art & Design','9479','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biblical Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biblical Studies')),
 'Biblical Studies','9484','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biblical Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biblical Studies')),
 'Biblical Studies','9484','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
 'Biology','9700','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Biology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Biology')),
 'Biology','9700','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business')),
 'Business','9609','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Business' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Business')),
 'Business','9609','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chemistry' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
 'Chemistry','9701','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chemistry' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chemistry')),
 'Chemistry','9701','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese - Language & Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese - Language & Literature')),
 'Chinese - Language & Literature','9868','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Chinese Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Chinese Language')),
 'Chinese Language','8238','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Classical Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Classical Studies')),
 'Classical Studies','9274','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Classical Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Classical Studies')),
 'Classical Studies','9274','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Computer Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
 'Computer Science','9618','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Computer Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Computer Science')),
 'Computer Science','9618','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Design & Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Design & Technology')),
 'Design & Technology','9705','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Design & Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Design & Technology')),
 'Design & Technology','9705','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Digital Media & Design' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Digital Media & Design')),
 'Digital Media & Design','9481','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Digital Media & Design' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Digital Media & Design')),
 'Digital Media & Design','9481','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Drama' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Drama')),
 'Drama','9482','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Drama' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Drama')),
 'Drama','9482','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Economics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
 'Economics','9708','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Economics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Economics')),
 'Economics','9708','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - Language and Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - Language and Literature')),
 'English - Language and Literature','8695','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - Literature')),
 'English - Literature','9695','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English - Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English - Literature')),
 'English - Literature','9695','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English General Paper' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English General Paper')),
 'English General Paper','8021','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Language')),
 'English Language','9093','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'English Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='English Language')),
 'English Language','9093','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Environmental Management' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Environmental Management')),
 'Environmental Management','8291','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'European History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='European History')),
 'European History','9981','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'European History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='European History')),
 'European History','9981','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French Language & Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French Language & Literature')),
 'French Language & Literature','9898','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French Language & Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French Language & Literature')),
 'French Language & Literature','9898','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'French Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='French Language')),
 'French Language','8028','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Geography' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
 'Geography','9696','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Geography' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Geography')),
 'Geography','9696','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German - Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German - Language')),
 'German - Language','8027','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'German Language & Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='German Language & Literature')),
 'German Language & Literature','9897','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Global Perspectives & Research' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Global Perspectives & Research')),
 'Global Perspectives & Research','9239','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Global Perspectives & Research' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Global Perspectives & Research')),
 'Global Perspectives & Research','9239','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Hinduism' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Hinduism')),
 'Hinduism','9487','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Hinduism' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Hinduism')),
 'Hinduism','9487','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
 'History','9489','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='History')),
 'History','9489','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Information Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Information Technology')),
 'Information Technology','9626','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Information Technology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Information Technology')),
 'Information Technology','9626','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'International History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='International History')),
 'International History','9982','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'International History' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='International History')),
 'International History','9982','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Islamic Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Islamic Studies')),
 'Islamic Studies','9488','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Islamic Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Islamic Studies')),
 'Islamic Studies','9488','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Law' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Law')),
 'Law','9084','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Law' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Law')),
 'Law','9084','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Marine Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Marine Science')),
 'Marine Science','9693','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Marine Science' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Marine Science')),
 'Marine Science','9693','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
 'Mathematics','9709','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics')),
 'Mathematics','9709','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics - Further' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics - Further')),
 'Mathematics - Further','9231','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Mathematics - Further' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Mathematics - Further')),
 'Mathematics - Further','9231','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Media Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Media Studies')),
 'Media Studies','9607','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Media Studies' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Media Studies')),
 'Media Studies','9607','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Music' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Music')),
 'Music','9483','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Music' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Music')),
 'Music','9483','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
 'Physics','9702','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Physics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Physics')),
 'Physics','9702','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Portuguese - Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Portuguese - Language')),
 'Portuguese - Language','8684','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Portuguese' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Portuguese')),
 'Portuguese','9718','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Psychology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Psychology')),
 'Psychology','9990','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Psychology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Psychology')),
 'Psychology','9990','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sociology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sociology')),
 'Sociology','9699','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sociology' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sociology')),
 'Sociology','9699','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish - Language & Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish - Language & Literature')),
 'Spanish - Language & Literature','9844','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Spanish Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Spanish Language')),
 'Spanish Language','8022','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Sport & Physical Education' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Sport & Physical Education')),
 'Sport & Physical Education','8386','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Tamil' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Tamil')),
 'Tamil','9689','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Tamil - Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Tamil - Language')),
 'Tamil - Language','8689','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Thinking Skills' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Thinking Skills')),
 'Thinking Skills','9694','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Thinking Skills' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Thinking Skills')),
 'Thinking Skills','9694','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Travel & Tourism' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Travel & Tourism')),
 'Travel & Tourism','9395','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Travel & Tourism' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Travel & Tourism')),
 'Travel & Tourism','9395','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Urdu - Language' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Urdu - Language')),
 'Urdu - Language','8686','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Urdu - Pakistan only' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Urdu - Pakistan only')),
 'Urdu - Pakistan only','9686','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'Urdu Language & Literature' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='Urdu Language & Literature')),
 'Urdu Language & Literature','9866','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'US Government and Politics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='US Government and Politics')),
 'US Government and Politics','8293','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'US Government and Politics' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='US Government and Politics')),
 'US Government and Politics','8293','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'US History since 1877' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='US History since 1877')),
 'US History since 1877','8102','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'US History since 1877' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='US History since 1877')),
 'US History since 1877','8102','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'US History to 1877' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='US History to 1877')),
 'US History to 1877','8101','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_as'
where pr.key='cambridge_as'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();

with subj as (
 insert into public.curriculum_subject(provider_id,canonical_name)
 select cp.id,'US History to 1877' from public.curriculum_provider cp where cp.key='cambridge'
 on conflict(provider_id,canonical_name) do update set active=true,updated_at=now()
 returning id
)
insert into public.subject_offering(
 programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
 levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
 coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='cambridge' and cs.canonical_name='US History to 1877')),
 'US History to 1877','8101','syllabus_code',array[]::text[],'',array[]::text[],
 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/subjects/','2026-live',now(),'{}'::jsonb
from public.curriculum_programme pr join public.curriculum_stage st on st.key='cambridge_a_level'
where pr.key='cambridge_a_level'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name,availability='active',source_url=excluded.source_url,
source_version=excluded.source_version,source_checked_at=excluded.source_checked_at,updated_at=now();
