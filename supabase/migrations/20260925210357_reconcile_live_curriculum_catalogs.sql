-- Reconcile live Cambridge/CBSE catalog drift verified against first-party
-- sources on 24 September 2026. Additive: preserve manually maintained
-- CBSE internal-assessment rows and upgrade existing Class IX identities in place.

-- Cambridge IGCSE Computer Science 0265 is a current first-party syllabus.
with subject_row as (
  insert into public.curriculum_subject(provider_id, canonical_name)
  select cp.id, 'Computer Science'
  from public.curriculum_provider cp
  where cp.key='cambridge'
  on conflict(provider_id, canonical_name)
  do update set active=true, updated_at=now()
  returning id
), resolved_subject as (
  select id from subject_row
  union all
  select cs.id
  from public.curriculum_subject cs
  join public.curriculum_provider cp on cp.id=cs.provider_id
  where cp.key='cambridge' and cs.canonical_name='Computer Science'
  limit 1
)
insert into public.subject_offering(
  programme_id, stage_id, subject_id, display_name, external_code, external_code_kind,
  levels_supported, variant, aliases, source_url, source_version, source_checked_at, metadata
)
select pr.id, st.id, (select id from resolved_subject),
       'Computer Science', '0265', 'syllabus_code',
       array[]::text[], '', array[]::text[],
       'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse-computer-science-0265/',
       '2026-live', now(), jsonb_build_object('group', null)
from public.curriculum_programme pr
join public.curriculum_stage st on st.programme_id=pr.id
where pr.key='cambridge_igcse'
  and st.key in ('cambridge_igcse_y10','cambridge_igcse_y11')
on conflict(programme_id, stage_id, subject_id, external_code, variant)
do update set display_name=excluded.display_name,
              availability='active',
              source_url=excluded.source_url,
              source_version=excluded.source_version,
              source_checked_at=excluded.source_checked_at,
              metadata=excluded.metadata,
              updated_at=now();

-- Home Science is present in the current CBSE Class IX optional and Class X
-- academic-elective catalogs.
with subject_row as (
  insert into public.curriculum_subject(provider_id, canonical_name, group_key)
  select cp.id, 'Home Science', 'elective'
  from public.curriculum_provider cp
  where cp.key='cbse'
  on conflict(provider_id, canonical_name)
  do update set active=true,
                group_key=coalesce(public.curriculum_subject.group_key, excluded.group_key),
                updated_at=now()
  returning id
), resolved_subject as (
  select id from subject_row
  union all
  select cs.id
  from public.curriculum_subject cs
  join public.curriculum_provider cp on cp.id=cs.provider_id
  where cp.key='cbse' and cs.canonical_name='Home Science'
  limit 1
)
insert into public.subject_offering(
  programme_id, stage_id, subject_id, display_name, external_code, external_code_kind,
  levels_supported, variant, aliases, source_url, source_version, source_checked_at, metadata
)
select pr.id, st.id, (select id from resolved_subject),
       'Home Science', null, null,
       array[]::text[], '', array[]::text[],
       'https://cbseacademic.nic.in/curriculum_2027.html',
       '2026-27', now(), jsonb_build_object('group','elective')
from public.curriculum_programme pr
join public.curriculum_stage st on st.programme_id=pr.id
where pr.key='cbse_secondary'
  and st.key in ('cbse_9','cbse_10')
  and not exists (
    select 1
    from public.subject_offering existing
    where existing.programme_id=pr.id
      and existing.stage_id=st.id
      and existing.subject_id=(select id from resolved_subject)
      and existing.variant=''
  );

-- The Class IX skill catalog supplies the official subject codes for these
-- existing selectable names. Update them rather than creating duplicates.
update public.subject_offering so
set external_code = case lower(so.display_name)
      when 'retail' then '401'
      when 'information technology' then '402'
      when 'front office operations' then '410'
      when 'marketing and sales' then '412'
      when 'artificial intelligence' then '417'
    end,
    external_code_kind='cbse_subject_code',
    source_url='https://cbseacademic.nic.in/skill-education-curriculum.html',
    source_version='2026-27',
    source_checked_at=now(),
    metadata=jsonb_build_object('group','skill'),
    updated_at=now()
from public.curriculum_stage st
join public.curriculum_programme pr on pr.id=st.programme_id
where so.stage_id=st.id
  and so.programme_id=pr.id
  and pr.key='cbse_secondary'
  and st.key='cbse_9'
  and lower(so.display_name) in (
    'retail',
    'information technology',
    'front office operations',
    'marketing and sales',
    'artificial intelligence'
  );
