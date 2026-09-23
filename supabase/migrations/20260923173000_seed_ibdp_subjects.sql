-- Complete 2026 IB Diploma Programme selectable subject seed from the official
-- "All Diploma Programme (DP) subjects" PDF. DP/CP core items are not inserted as student subjects.

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'AFRIKAANS A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='AFRIKAANS A: Literature')),
       'AFRIKAANS A: Literature','112826','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'AFRIKAANS A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='AFRIKAANS A: Literature')),
       'AFRIKAANS A: Literature','112826','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ALBANIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ALBANIAN A: Literature')),
       'ALBANIAN A: Literature','112815','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ALBANIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ALBANIAN A: Literature')),
       'ALBANIAN A: Literature','112815','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'AMHARIC A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='AMHARIC A: Literature')),
       'AMHARIC A: Literature','112766','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'AMHARIC A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='AMHARIC A: Literature')),
       'AMHARIC A: Literature','112766','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC A Language and Literature')),
       'ARABIC A Language and Literature','112739','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC A Language and Literature')),
       'ARABIC A Language and Literature','112739','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC A: Literature')),
       'ARABIC A: Literature','112721','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC A: Literature')),
       'ARABIC A: Literature','112721','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARMENIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARMENIAN A: Literature')),
       'ARMENIAN A: Literature','112813','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARMENIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARMENIAN A: Literature')),
       'ARMENIAN A: Literature','112813','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'AZERBAIJANI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='AZERBAIJANI A: Literature')),
       'AZERBAIJANI A: Literature','112903','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'AZERBAIJANI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='AZERBAIJANI A: Literature')),
       'AZERBAIJANI A: Literature','112903','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BELARUSIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BELARUSIAN A: Literature')),
       'BELARUSIAN A: Literature','112875','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BELARUSIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BELARUSIAN A: Literature')),
       'BELARUSIAN A: Literature','112875','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BEMBA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BEMBA A: Literature')),
       'BEMBA A: Literature','112897','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BEMBA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BEMBA A: Literature')),
       'BEMBA A: Literature','112897','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BENGALI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BENGALI A: Literature')),
       'BENGALI A: Literature','112831','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BENGALI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BENGALI A: Literature')),
       'BENGALI A: Literature','112831','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BOSNIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BOSNIAN A: Literature')),
       'BOSNIAN A: Literature','112758','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BOSNIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BOSNIAN A: Literature')),
       'BOSNIAN A: Literature','112758','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BULGARIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BULGARIAN A: Literature')),
       'BULGARIAN A: Literature','112775','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BULGARIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BULGARIAN A: Literature')),
       'BULGARIAN A: Literature','112775','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BURMESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BURMESE A: Literature')),
       'BURMESE A: Literature','112814','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BURMESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BURMESE A: Literature')),
       'BURMESE A: Literature','112814','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CATALAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CATALAN A: Literature')),
       'CATALAN A: Literature','112764','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CATALAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CATALAN A: Literature')),
       'CATALAN A: Literature','112764','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHICHEWA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHICHEWA A: Literature')),
       'CHICHEWA A: Literature','112910','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHICHEWA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHICHEWA A: Literature')),
       'CHICHEWA A: Literature','112910','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE A Language and Literature')),
       'CHINESE A Language and Literature','112740','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE A Language and Literature')),
       'CHINESE A Language and Literature','112740','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE A: Literature')),
       'CHINESE A: Literature','112724','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE A: Literature')),
       'CHINESE A: Literature','112724','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CROATIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CROATIAN A: Literature')),
       'CROATIAN A: Literature','112761','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CROATIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CROATIAN A: Literature')),
       'CROATIAN A: Literature','112761','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CZECH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CZECH A: Literature')),
       'CZECH A: Literature','112725','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CZECH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CZECH A: Literature')),
       'CZECH A: Literature','112725','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANISH A: Literature')),
       'DANISH A: Literature','112755','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANISH A: Literature')),
       'DANISH A: Literature','112755','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH A Language and Literature')),
       'DUTCH A Language and Literature','112738','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH A Language and Literature')),
       'DUTCH A Language and Literature','112738','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH A: Literature')),
       'DUTCH A: Literature','112720','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH A: Literature')),
       'DUTCH A: Literature','112720','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DZONGKHA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DZONGKHA A: Literature')),
       'DZONGKHA A: Literature','112879','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DZONGKHA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DZONGKHA A: Literature')),
       'DZONGKHA A: Literature','112879','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH A Language and Literature')),
       'ENGLISH A Language and Literature','112733','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH A Language and Literature')),
       'ENGLISH A Language and Literature','112733','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH A: Literature')),
       'ENGLISH A: Literature','112711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH A: Literature')),
       'ENGLISH A: Literature','112711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ESTONIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ESTONIAN A: Literature')),
       'ESTONIAN A: Literature','112859','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ESTONIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ESTONIAN A: Literature')),
       'ESTONIAN A: Literature','112859','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FILIPINO A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FILIPINO A: Literature')),
       'FILIPINO A: Literature','116711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FILIPINO A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FILIPINO A: Literature')),
       'FILIPINO A: Literature','116711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FINNISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FINNISH A: Literature')),
       'FINNISH A: Literature','112726','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FINNISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FINNISH A: Literature')),
       'FINNISH A: Literature','112726','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH A Language and Literature')),
       'FRENCH A Language and Literature','112734','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH A Language and Literature')),
       'FRENCH A Language and Literature','112734','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH A: Literature')),
       'FRENCH A: Literature','112750','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH A: Literature')),
       'FRENCH A: Literature','112750','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GEORGIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GEORGIAN A: Literature')),
       'GEORGIAN A: Literature','112877','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GEORGIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GEORGIAN A: Literature')),
       'GEORGIAN A: Literature','112877','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN A Language and Literature')),
       'GERMAN A Language and Literature','112735','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN A Language and Literature')),
       'GERMAN A Language and Literature','112735','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN A: Literature')),
       'GERMAN A: Literature','112751','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN A: Literature')),
       'GERMAN A: Literature','112751','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GUARANI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GUARANI A: Literature')),
       'GUARANI A: Literature','175712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GUARANI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GUARANI A: Literature')),
       'GUARANI A: Literature','175712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HEBREW A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HEBREW A: Literature')),
       'HEBREW A: Literature','112722','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HEBREW A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HEBREW A: Literature')),
       'HEBREW A: Literature','112722','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HINDI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HINDI A: Literature')),
       'HINDI A: Literature','112747','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HINDI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HINDI A: Literature')),
       'HINDI A: Literature','112747','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HUNGARIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HUNGARIAN A: Literature')),
       'HUNGARIAN A: Literature','112748','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HUNGARIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HUNGARIAN A: Literature')),
       'HUNGARIAN A: Literature','112748','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ICELANDIC A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ICELANDIC A: Literature')),
       'ICELANDIC A: Literature','112883','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ICELANDIC A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ICELANDIC A: Literature')),
       'ICELANDIC A: Literature','112883','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN A: Lang and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN A: Lang and Literature')),
       'INDONESIAN A: Lang and Literature','125711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN A: Lang and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN A: Lang and Literature')),
       'INDONESIAN A: Lang and Literature','125711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN A: Literature')),
       'INDONESIAN A: Literature','112749','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN A: Literature')),
       'INDONESIAN A: Literature','112749','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN A Language and Literature')),
       'ITALIAN A Language and Literature','112838','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN A Language and Literature')),
       'ITALIAN A Language and Literature','112838','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN A: Literature')),
       'ITALIAN A: Literature','112753','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN A: Literature')),
       'ITALIAN A: Literature','112753','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE A Language and Literature')),
       'JAPANESE A Language and Literature','128711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE A Language and Literature')),
       'JAPANESE A Language and Literature','128711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE A: Literature')),
       'JAPANESE A: Literature','112743','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE A: Literature')),
       'JAPANESE A: Literature','112743','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KAZAKH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KAZAKH A: Literature')),
       'KAZAKH A: Literature','112804','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KAZAKH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KAZAKH A: Literature')),
       'KAZAKH A: Literature','112804','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KHMER A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KHMER A: Literature')),
       'KHMER A: Literature','112896','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KHMER A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KHMER A: Literature')),
       'KHMER A: Literature','112896','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KINYARWANDA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KINYARWANDA A: Literature')),
       'KINYARWANDA A: Literature','115711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KINYARWANDA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KINYARWANDA A: Literature')),
       'KINYARWANDA A: Literature','115711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KISWAHILI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KISWAHILI A: Literature')),
       'KISWAHILI A: Literature','178713','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KISWAHILI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KISWAHILI A: Literature')),
       'KISWAHILI A: Literature','178713','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KOREAN A: Lang and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KOREAN A: Lang and Literature')),
       'KOREAN A: Lang and Literature','115715','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KOREAN A: Lang and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KOREAN A: Lang and Literature')),
       'KOREAN A: Lang and Literature','115715','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KOREAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KOREAN A: Literature')),
       'KOREAN A: Literature','112744','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KOREAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KOREAN A: Literature')),
       'KOREAN A: Literature','112744','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LAO A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LAO A: Literature')),
       'LAO A: Literature','112881','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LAO A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LAO A: Literature')),
       'LAO A: Literature','112881','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LATVIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LATVIAN A: Literature')),
       'LATVIAN A: Literature','112723','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LATVIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LATVIAN A: Literature')),
       'LATVIAN A: Literature','112723','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'Literature and Performance','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='Literature and Performance')),
       'Literature and Performance','112845','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'Literature and Performance','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='Literature and Performance')),
       'Literature and Performance','112845','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LITHUANIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LITHUANIAN A: Literature')),
       'LITHUANIAN A: Literature','112765','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LITHUANIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LITHUANIAN A: Literature')),
       'LITHUANIAN A: Literature','112765','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LUGANDA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LUGANDA A: Literature')),
       'LUGANDA A: Literature','112841','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LUGANDA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LUGANDA A: Literature')),
       'LUGANDA A: Literature','112841','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MACEDONIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MACEDONIAN A: Literature')),
       'MACEDONIAN A: Literature','112712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MACEDONIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MACEDONIAN A: Literature')),
       'MACEDONIAN A: Literature','112712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAGASY A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAGASY A: Literature')),
       'MALAGASY A: Literature','155711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAGASY A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAGASY A: Literature')),
       'MALAGASY A: Literature','155711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAY A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAY A: Literature')),
       'MALAY A: Literature','112745','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAY A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAY A: Literature')),
       'MALAY A: Literature','112745','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAYALAM A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAYALAM A: Literature')),
       'MALAYALAM A: Literature','112867','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAYALAM A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAYALAM A: Literature')),
       'MALAYALAM A: Literature','112867','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MODERN GREEK A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MODERN GREEK A Language and Literature')),
       'MODERN GREEK A Language and Literature','112732','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MODERN GREEK A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MODERN GREEK A Language and Literature')),
       'MODERN GREEK A Language and Literature','112732','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MODERN GREEK A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MODERN GREEK A: Literature')),
       'MODERN GREEK A: Literature','112727','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MODERN GREEK A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MODERN GREEK A: Literature')),
       'MODERN GREEK A: Literature','112727','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MONGOLIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MONGOLIAN A: Literature')),
       'MONGOLIAN A: Literature','112882','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MONGOLIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MONGOLIAN A: Literature')),
       'MONGOLIAN A: Literature','112882','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NDEBELE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NDEBELE A: Literature')),
       'NDEBELE A: Literature','112819','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NDEBELE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NDEBELE A: Literature')),
       'NDEBELE A: Literature','112819','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NEPALI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NEPALI A: Literature')),
       'NEPALI A: Literature','112763','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NEPALI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NEPALI A: Literature')),
       'NEPALI A: Literature','112763','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NORWEGIAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NORWEGIAN A Language and Literature')),
       'NORWEGIAN A Language and Literature','112840','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NORWEGIAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NORWEGIAN A Language and Literature')),
       'NORWEGIAN A Language and Literature','112840','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NORWEGIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NORWEGIAN A: Literature')),
       'NORWEGIAN A: Literature','112756','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NORWEGIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NORWEGIAN A: Literature')),
       'NORWEGIAN A: Literature','112756','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PERSIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PERSIAN A: Literature')),
       'PERSIAN A: Literature','112746','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PERSIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PERSIAN A: Literature')),
       'PERSIAN A: Literature','112746','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'POLISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='POLISH A: Literature')),
       'POLISH A: Literature','112717','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'POLISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='POLISH A: Literature')),
       'POLISH A: Literature','112717','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PORTUGUESE A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PORTUGUESE A Language and Literature')),
       'PORTUGUESE A Language and Literature','112730','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PORTUGUESE A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PORTUGUESE A Language and Literature')),
       'PORTUGUESE A Language and Literature','112730','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PORTUGUESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PORTUGUESE A: Literature')),
       'PORTUGUESE A: Literature','112718','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PORTUGUESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PORTUGUESE A: Literature')),
       'PORTUGUESE A: Literature','112718','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PUNJABI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PUNJABI A: Literature')),
       'PUNJABI A: Literature','112801','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PUNJABI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PUNJABI A: Literature')),
       'PUNJABI A: Literature','112801','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ROMANIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ROMANIAN A: Literature')),
       'ROMANIAN A: Literature','112886','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ROMANIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ROMANIAN A: Literature')),
       'ROMANIAN A: Literature','112886','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN A Language and Literature')),
       'RUSSIAN A Language and Literature','112839','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN A Language and Literature')),
       'RUSSIAN A Language and Literature','112839','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN A: Literature')),
       'RUSSIAN A: Literature','112754','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN A: Literature')),
       'RUSSIAN A: Literature','112754','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SERBIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SERBIAN A: Literature')),
       'SERBIAN A: Literature','112759','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SERBIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SERBIAN A: Literature')),
       'SERBIAN A: Literature','112759','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SESOTHO A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SESOTHO A: Literature')),
       'SESOTHO A: Literature','112762','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SESOTHO A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SESOTHO A: Literature')),
       'SESOTHO A: Literature','112762','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SHONA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SHONA A: Literature')),
       'SHONA A: Literature','112832','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SHONA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SHONA A: Literature')),
       'SHONA A: Literature','112832','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SINHALA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SINHALA A: Literature')),
       'SINHALA A: Literature','177711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SINHALA A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SINHALA A: Literature')),
       'SINHALA A: Literature','177711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SISWATI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SISWATI A: Literature')),
       'SISWATI A: Literature','112880','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SISWATI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SISWATI A: Literature')),
       'SISWATI A: Literature','112880','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SLOVAK A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SLOVAK A: Literature')),
       'SLOVAK A: Literature','112760','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SLOVAK A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SLOVAK A: Literature')),
       'SLOVAK A: Literature','112760','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SLOVENE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SLOVENE A: Literature')),
       'SLOVENE A: Literature','112741','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SLOVENE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SLOVENE A: Literature')),
       'SLOVENE A: Literature','112741','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SOMALI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SOMALI A: Literature')),
       'SOMALI A: Literature','112800','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SOMALI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SOMALI A: Literature')),
       'SOMALI A: Literature','112800','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH A Language and Literature')),
       'SPANISH A Language and Literature','112736','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH A Language and Literature')),
       'SPANISH A Language and Literature','112736','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH A: Literature')),
       'SPANISH A: Literature','112752','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH A: Literature')),
       'SPANISH A: Literature','112752','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH A Language and Literature')),
       'SWEDISH A Language and Literature','112737','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH A Language and Literature')),
       'SWEDISH A Language and Literature','112737','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH A: Literature')),
       'SWEDISH A: Literature','112757','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH A: Literature')),
       'SWEDISH A: Literature','112757','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TAJIK A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TAJIK A: Literature')),
       'TAJIK A: Literature','112878','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TAJIK A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TAJIK A: Literature')),
       'TAJIK A: Literature','112878','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TAMIL A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TAMIL A: Literature')),
       'TAMIL A: Literature','112810','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TAMIL A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TAMIL A: Literature')),
       'TAMIL A: Literature','112810','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TELUGU A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TELUGU A: Literature')),
       'TELUGU A: Literature','112901','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TELUGU A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TELUGU A: Literature')),
       'TELUGU A: Literature','112901','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'THAI A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='THAI A Language and Literature')),
       'THAI A Language and Literature','112731','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'THAI A Language and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='THAI A Language and Literature')),
       'THAI A Language and Literature','112731','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'THAI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='THAI A: Literature')),
       'THAI A: Literature','112713','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'THAI A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='THAI A: Literature')),
       'THAI A: Literature','112713','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TIBETAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TIBETAN A: Literature')),
       'TIBETAN A: Literature','112835','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TIBETAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TIBETAN A: Literature')),
       'TIBETAN A: Literature','112835','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TURKISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TURKISH A: Literature')),
       'TURKISH A: Literature','112714','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TURKISH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TURKISH A: Literature')),
       'TURKISH A: Literature','112714','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'UKRAINIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='UKRAINIAN A: Literature')),
       'UKRAINIAN A: Literature','112802','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'UKRAINIAN A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='UKRAINIAN A: Literature')),
       'UKRAINIAN A: Literature','112802','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'URDU A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='URDU A: Literature')),
       'URDU A: Literature','112885','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'URDU A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='URDU A: Literature')),
       'URDU A: Literature','112885','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'UYGHUR A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='UYGHUR A: Literature')),
       'UYGHUR A: Literature','180711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'UYGHUR A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='UYGHUR A: Literature')),
       'UYGHUR A: Literature','180711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'VIETNAMESE A: Lang and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='VIETNAMESE A: Lang and Literature')),
       'VIETNAMESE A: Lang and Literature','174711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'VIETNAMESE A: Lang and Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='VIETNAMESE A: Lang and Literature')),
       'VIETNAMESE A: Lang and Literature','174711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'VIETNAMESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='VIETNAMESE A: Literature')),
       'VIETNAMESE A: Literature','112884','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'VIETNAMESE A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='VIETNAMESE A: Literature')),
       'VIETNAMESE A: Literature','112884','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'WELSH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='WELSH A: Literature')),
       'WELSH A: Literature','112715','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'WELSH A: Literature','Studies in language and literature'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='WELSH A: Literature')),
       'WELSH A: Literature','112715','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Studies in language and literature')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC Ab Initio')),
       'ARABIC Ab Initio','100052','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC Ab Initio')),
       'ARABIC Ab Initio','100052','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC B')),
       'ARABIC B','100053','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ARABIC B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ARABIC B')),
       'ARABIC B','100053','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE B - CANTONESE','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE B - CANTONESE')),
       'CHINESE B - CANTONESE','117712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE B - CANTONESE','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE B - CANTONESE')),
       'CHINESE B - CANTONESE','117712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE B - MANDARIN','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE B - MANDARIN')),
       'CHINESE B - MANDARIN','117711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHINESE B - MANDARIN','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHINESE B - MANDARIN')),
       'CHINESE B - MANDARIN','117711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CLASSIC GREEK AND ROMAN STUDIES','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CLASSIC GREEK AND ROMAN STUDIES')),
       'CLASSIC GREEK AND ROMAN STUDIES','100128','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CLASSIC GREEK AND ROMAN STUDIES','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CLASSIC GREEK AND ROMAN STUDIES')),
       'CLASSIC GREEK AND ROMAN STUDIES','100128','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CLASSIC GREEK','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CLASSIC GREEK')),
       'CLASSIC GREEK','100129','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CLASSIC GREEK','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CLASSIC GREEK')),
       'CLASSIC GREEK','100129','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANISH Ab Initio')),
       'DANISH Ab Initio','162711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANISH Ab Initio')),
       'DANISH Ab Initio','162711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANISH B')),
       'DANISH B','100144','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANISH B')),
       'DANISH B','100144','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH Ab Initio')),
       'DUTCH Ab Initio','167711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH Ab Initio')),
       'DUTCH Ab Initio','167711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH B')),
       'DUTCH B','100157','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DUTCH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DUTCH B')),
       'DUTCH B','100157','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH Ab Initio')),
       'ENGLISH Ab Initio','100704','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH Ab Initio')),
       'ENGLISH Ab Initio','100704','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH B')),
       'ENGLISH B','100179','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENGLISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENGLISH B')),
       'ENGLISH B','100179','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FINNISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FINNISH B')),
       'FINNISH B','100204','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FINNISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FINNISH B')),
       'FINNISH B','100204','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH Ab Initio')),
       'FRENCH Ab Initio','100213','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH Ab Initio')),
       'FRENCH Ab Initio','100213','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH B')),
       'FRENCH B','100214','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FRENCH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FRENCH B')),
       'FRENCH B','100214','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN Ab Initio')),
       'GERMAN Ab Initio','100230','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN Ab Initio')),
       'GERMAN Ab Initio','100230','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN B')),
       'GERMAN B','100231','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GERMAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GERMAN B')),
       'GERMAN B','100231','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HEBREW B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HEBREW B')),
       'HEBREW B','100246','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HEBREW B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HEBREW B')),
       'HEBREW B','100246','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HINDI B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HINDI B')),
       'HINDI B','100252','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HINDI B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HINDI B')),
       'HINDI B','100252','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN Ab Initio')),
       'INDONESIAN Ab Initio','100283','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN Ab Initio')),
       'INDONESIAN Ab Initio','100283','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN B')),
       'INDONESIAN B','100284','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'INDONESIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='INDONESIAN B')),
       'INDONESIAN B','100284','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN Ab Initio')),
       'ITALIAN Ab Initio','100298','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN Ab Initio')),
       'ITALIAN Ab Initio','100298','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN B')),
       'ITALIAN B','100299','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ITALIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ITALIAN B')),
       'ITALIAN B','100299','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE Ab Initio')),
       'JAPANESE Ab Initio','100307','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE Ab Initio')),
       'JAPANESE Ab Initio','100307','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE B')),
       'JAPANESE B','100308','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'JAPANESE B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='JAPANESE B')),
       'JAPANESE B','100308','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KISWAHILI Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KISWAHILI Ab Initio')),
       'KISWAHILI Ab Initio','178714','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KISWAHILI Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KISWAHILI Ab Initio')),
       'KISWAHILI Ab Initio','178714','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KISWAHILI B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KISWAHILI B')),
       'KISWAHILI B','178712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KISWAHILI B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KISWAHILI B')),
       'KISWAHILI B','178712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KOREAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KOREAN B')),
       'KOREAN B','100334','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'KOREAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='KOREAN B')),
       'KOREAN B','100334','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LATIN','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LATIN')),
       'LATIN','100340','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LATIN','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LATIN')),
       'LATIN','100340','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAY B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAY B')),
       'MALAY B','100367','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MALAY B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MALAY B')),
       'MALAY B','100367','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MANDARIN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MANDARIN Ab Initio')),
       'MANDARIN Ab Initio','100375','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MANDARIN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MANDARIN Ab Initio')),
       'MANDARIN Ab Initio','100375','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NORWEGIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NORWEGIAN B')),
       'NORWEGIAN B','100424','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'NORWEGIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='NORWEGIAN B')),
       'NORWEGIAN B','100424','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PORTUGUESE B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PORTUGUESE B')),
       'PORTUGUESE B','100472','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PORTUGUESE B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PORTUGUESE B')),
       'PORTUGUESE B','100472','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN Ab Initio')),
       'RUSSIAN Ab Initio','100492','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN Ab Initio')),
       'RUSSIAN Ab Initio','100492','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN B')),
       'RUSSIAN B','100493','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'RUSSIAN B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='RUSSIAN B')),
       'RUSSIAN B','100493','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH Ab Initio')),
       'SPANISH Ab Initio','100542','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH Ab Initio')),
       'SPANISH Ab Initio','100542','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH B')),
       'SPANISH B','100543','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPANISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPANISH B')),
       'SPANISH B','100543','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH Ab Initio')),
       'SWEDISH Ab Initio','162712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH Ab Initio','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH Ab Initio')),
       'SWEDISH Ab Initio','162712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH B')),
       'SWEDISH B','100559','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SWEDISH B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SWEDISH B')),
       'SWEDISH B','100559','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TAMIL B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TAMIL B')),
       'TAMIL B','100563','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TAMIL B','Language acquisition'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TAMIL B')),
       'TAMIL B','100563','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Language acquisition')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ART HISTORY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ART HISTORY')),
       'ART HISTORY','100058','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ART HISTORY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ART HISTORY')),
       'ART HISTORY','100058','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ASTRONOMY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ASTRONOMY')),
       'ASTRONOMY','100068','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ASTRONOMY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ASTRONOMY')),
       'ASTRONOMY','100068','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BRAZILIAN SOCIAL STUDIES','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BRAZILIAN SOCIAL STUDIES')),
       'BRAZILIAN SOCIAL STUDIES','101711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BRAZILIAN SOCIAL STUDIES','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BRAZILIAN SOCIAL STUDIES')),
       'BRAZILIAN SOCIAL STUDIES','101711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BUSINESS MANAGEMENT','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BUSINESS MANAGEMENT')),
       'BUSINESS MANAGEMENT','147712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BUSINESS MANAGEMENT','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BUSINESS MANAGEMENT')),
       'BUSINESS MANAGEMENT','147712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DIGITAL SOCIETIES','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DIGITAL SOCIETIES')),
       'DIGITAL SOCIETIES','179711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DIGITAL SOCIETIES','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DIGITAL SOCIETIES')),
       'DIGITAL SOCIETIES','179711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ECONOMICS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ECONOMICS')),
       'ECONOMICS','100164','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ECONOMICS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ECONOMICS')),
       'ECONOMICS','100164','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GLOBAL POLITICS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GLOBAL POLITICS')),
       'GLOBAL POLITICS','123711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GLOBAL POLITICS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GLOBAL POLITICS')),
       'GLOBAL POLITICS','123711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY')),
       'HISTORY','100680','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY')),
       'HISTORY','100680','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY AFRICA AND MIDDLE EAST','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY AFRICA AND MIDDLE EAST')),
       'HISTORY AFRICA AND MIDDLE EAST','149713','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY AFRICA AND MIDDLE EAST','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY AFRICA AND MIDDLE EAST')),
       'HISTORY AFRICA AND MIDDLE EAST','149713','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY AMERICAS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY AMERICAS')),
       'HISTORY AMERICAS','149711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY AMERICAS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY AMERICAS')),
       'HISTORY AMERICAS','149711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY ASIA AND OCEANIA','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY ASIA AND OCEANIA')),
       'HISTORY ASIA AND OCEANIA','149714','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY ASIA AND OCEANIA','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY ASIA AND OCEANIA')),
       'HISTORY ASIA AND OCEANIA','149714','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY EUROPE','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY EUROPE')),
       'HISTORY EUROPE','149712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'HISTORY EUROPE','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='HISTORY EUROPE')),
       'HISTORY EUROPE','149712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MODERN HISTORY OF KAZAKHSTAN','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MODERN HISTORY OF KAZAKHSTAN')),
       'MODERN HISTORY OF KAZAKHSTAN','158712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MODERN HISTORY OF KAZAKHSTAN','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MODERN HISTORY OF KAZAKHSTAN')),
       'MODERN HISTORY OF KAZAKHSTAN','158712','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PHILOSOPHY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PHILOSOPHY')),
       'PHILOSOPHY','100449','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PHILOSOPHY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PHILOSOPHY')),
       'PHILOSOPHY','100449','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PSYCHOLOGY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PSYCHOLOGY')),
       'PSYCHOLOGY','100474','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PSYCHOLOGY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PSYCHOLOGY')),
       'PSYCHOLOGY','100474','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SOCIAL AND CULTURAL ANTHROPOLOGY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SOCIAL AND CULTURAL ANTHROPOLOGY')),
       'SOCIAL AND CULTURAL ANTHROPOLOGY','100532','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SOCIAL AND CULTURAL ANTHROPOLOGY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SOCIAL AND CULTURAL ANTHROPOLOGY')),
       'SOCIAL AND CULTURAL ANTHROPOLOGY','100532','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TURKEY IN THE 20TH CENTURY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TURKEY IN THE 20TH CENTURY')),
       'TURKEY IN THE 20TH CENTURY','107711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'TURKEY IN THE 20TH CENTURY','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='TURKEY IN THE 20TH CENTURY')),
       'TURKEY IN THE 20TH CENTURY','107711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'WORLD ARTS AND CULTURES','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='WORLD ARTS AND CULTURES')),
       'WORLD ARTS AND CULTURES','108714','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'WORLD ARTS AND CULTURES','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='WORLD ARTS AND CULTURES')),
       'WORLD ARTS AND CULTURES','108714','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'WORLD RELIGIONS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='WORLD RELIGIONS')),
       'WORLD RELIGIONS','100619','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'WORLD RELIGIONS','Individuals and societies'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='WORLD RELIGIONS')),
       'WORLD RELIGIONS','100619','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Individuals and societies')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BIOLOGY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BIOLOGY')),
       'BIOLOGY','100088','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'BIOLOGY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='BIOLOGY')),
       'BIOLOGY','100088','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHEMISTRY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHEMISTRY')),
       'CHEMISTRY','100113','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'CHEMISTRY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='CHEMISTRY')),
       'CHEMISTRY','100113','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'COMPUTER SCIENCE','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='COMPUTER SCIENCE')),
       'COMPUTER SCIENCE','100132','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'COMPUTER SCIENCE','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='COMPUTER SCIENCE')),
       'COMPUTER SCIENCE','100132','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DESIGN TECHNOLOGY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DESIGN TECHNOLOGY')),
       'DESIGN TECHNOLOGY','100146','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DESIGN TECHNOLOGY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DESIGN TECHNOLOGY')),
       'DESIGN TECHNOLOGY','100146','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FOOD SCIENCE AND TECHNOLOGY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FOOD SCIENCE AND TECHNOLOGY')),
       'FOOD SCIENCE AND TECHNOLOGY','158711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FOOD SCIENCE AND TECHNOLOGY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FOOD SCIENCE AND TECHNOLOGY')),
       'FOOD SCIENCE AND TECHNOLOGY','158711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GEOGRAPHY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GEOGRAPHY')),
       'GEOGRAPHY','100222','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'GEOGRAPHY','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='GEOGRAPHY')),
       'GEOGRAPHY','100222','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MARINE SCIENCE','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MARINE SCIENCE')),
       'MARINE SCIENCE','100671','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MARINE SCIENCE','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MARINE SCIENCE')),
       'MARINE SCIENCE','100671','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PHYSICS','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PHYSICS')),
       'PHYSICS','100452','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'PHYSICS','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='PHYSICS')),
       'PHYSICS','100452','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPORTS EXERCISE AND HEALTH SCIENCE','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPORTS EXERCISE AND HEALTH SCIENCE')),
       'SPORTS EXERCISE AND HEALTH SCIENCE','100546','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'SPORTS EXERCISE AND HEALTH SCIENCE','Sciences'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='SPORTS EXERCISE AND HEALTH SCIENCE')),
       'SPORTS EXERCISE AND HEALTH SCIENCE','100546','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Sciences')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MATHEMATICS ANALYSIS AND APPROACHES','Mathematics'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MATHEMATICS ANALYSIS AND APPROACHES')),
       'MATHEMATICS ANALYSIS AND APPROACHES','166711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Mathematics')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MATHEMATICS ANALYSIS AND APPROACHES','Mathematics'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MATHEMATICS ANALYSIS AND APPROACHES')),
       'MATHEMATICS ANALYSIS AND APPROACHES','166711','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Mathematics')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MATHEMATICS APPLICATIONS AND INTERPRETATION','Mathematics'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MATHEMATICS APPLICATIONS AND INTERPRETATION')),
       'MATHEMATICS APPLICATIONS AND INTERPRETATION','166712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Mathematics')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MATHEMATICS APPLICATIONS AND INTERPRETATION','Mathematics'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MATHEMATICS APPLICATIONS AND INTERPRETATION')),
       'MATHEMATICS APPLICATIONS AND INTERPRETATION','166712','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Mathematics')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANCE','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANCE')),
       'DANCE','100140','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'DANCE','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='DANCE')),
       'DANCE','100140','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FILM','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FILM')),
       'FILM','100200','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'FILM','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='FILM')),
       'FILM','100200','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LITERARY ART','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LITERARY ART')),
       'LITERARY ART','182711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LITERARY ART','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LITERARY ART')),
       'LITERARY ART','182711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MUSIC','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MUSIC')),
       'MUSIC','100402','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'MUSIC','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='MUSIC')),
       'MUSIC','100402','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'THEATRE','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='THEATRE')),
       'THEATRE','100575','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'THEATRE','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='THEATRE')),
       'THEATRE','100575','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'VISUAL ARTS','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='VISUAL ARTS')),
       'VISUAL ARTS','100608','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'VISUAL ARTS','Arts'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='VISUAL ARTS')),
       'VISUAL ARTS','100608','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Arts')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENVIRONMENTAL SYSTEMS AND SOCIETIES','Interdisciplinary'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENVIRONMENTAL SYSTEMS AND SOCIETIES')),
       'ENVIRONMENTAL SYSTEMS AND SOCIETIES','100673','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Interdisciplinary')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'ENVIRONMENTAL SYSTEMS AND SOCIETIES','Interdisciplinary'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='ENVIRONMENTAL SYSTEMS AND SOCIETIES')),
       'ENVIRONMENTAL SYSTEMS AND SOCIETIES','100673','ib_subject_code',
       array['SL','HL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Interdisciplinary')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LANGUAGE AND CULTURE','Interdisciplinary'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LANGUAGE AND CULTURE')),
       'LANGUAGE AND CULTURE','184711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Interdisciplinary')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'LANGUAGE AND CULTURE','Interdisciplinary'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='LANGUAGE AND CULTURE')),
       'LANGUAGE AND CULTURE','184711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Interdisciplinary')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'Nature of Science','Interdisciplinary'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='Nature of Science')),
       'Nature of Science','150711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Interdisciplinary')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_1'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();

with subj as (
  insert into public.curriculum_subject(provider_id,canonical_name,group_key)
  select cp.id,'Nature of Science','Interdisciplinary'
  from public.curriculum_provider cp where cp.key='ib'
  on conflict(provider_id,canonical_name) do update
    set group_key=excluded.group_key, active=true, updated_at=now()
  returning id
)
insert into public.subject_offering(
  programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,
  levels_supported,variant,aliases,source_url,source_version,source_checked_at,metadata
)
select pr.id,st.id,
       coalesce((select id from subj),(select cs.id from public.curriculum_subject cs join public.curriculum_provider cp on cp.id=cs.provider_id where cp.key='ib' and cs.canonical_name='Nature of Science')),
       'Nature of Science','150711','ib_subject_code',
       array['SL']::text[],'',array[]::text[],
       'https://ibo.org/globalassets/new-structure/programmes/dp/pdfs/all-dp-subjects-list-en.pdf',
       '2026',now(),jsonb_build_object('subject_group','Interdisciplinary')
from public.curriculum_programme pr
join public.curriculum_stage st on st.key='ibdp_2'
where pr.key='ibdp'
on conflict(programme_id,stage_id,subject_id,external_code,variant)
do update set display_name=excluded.display_name, levels_supported=excluded.levels_supported,
  availability='active',source_url=excluded.source_url,source_version=excluded.source_version,
  source_checked_at=excluded.source_checked_at,metadata=excluded.metadata,updated_at=now();
