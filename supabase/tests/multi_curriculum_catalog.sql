-- Multi-curriculum reference integrity.
-- The production catalog is generated from first-party sources; these guards
-- make a future parser/seed regression fail CI instead of silently shrinking
-- onboarding back to a curated subset.

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

select public._t('three curriculum providers exist',
  (select count(*) = 3 from public.curriculum_provider
   where key in ('cambridge','cbse','ib') and active));

select public._t('all required programmes exist',
  (select count(*) = 6 from public.curriculum_programme
   where key in ('cambridge_igcse','cambridge_as','cambridge_a_level',
                 'cbse_secondary','cbse_senior_secondary','ibdp')
     and active));

select public._t('all required stages exist',
  (select count(*) = 10 from public.curriculum_stage
   where key in ('cambridge_igcse_y10','cambridge_igcse_y11',
                 'cambridge_as','cambridge_a_level',
                 'cbse_9','cbse_10','cbse_11','cbse_12','ibdp_1','ibdp_2')
     and active));

select public._t('Cambridge IGCSE is not a curated subset',
  (select count(*) >= 70
   from public.subject_offering so
   join public.curriculum_programme pr on pr.id=so.programme_id
   join public.curriculum_stage st on st.id=so.stage_id
   where pr.key='cambridge_igcse' and st.key='cambridge_igcse_y10'
     and so.availability='active'));

select public._t('Cambridge active offerings preserve syllabus codes',
  not exists (
    select 1
    from public.subject_offering so
    join public.curriculum_programme pr on pr.id=so.programme_id
    where pr.key like 'cambridge_%' and so.availability='active'
      and (so.external_code is null or so.external_code_kind <> 'syllabus_code')
  ));

select public._t('CBSE IX through XII each have broad official catalogs',
  not exists (
    select 1 from (
      select st.key, count(so.id) n
      from public.curriculum_stage st
      join public.curriculum_programme pr on pr.id=st.programme_id
      left join public.subject_offering so on so.stage_id=st.id and so.availability='active'
      where st.key in ('cbse_9','cbse_10','cbse_11','cbse_12')
      group by st.key
    ) x where x.n < 50
  ));

select public._t('IBDP catalog is coded and level-aware',
  not exists (
    select 1
    from public.subject_offering so
    join public.curriculum_programme pr on pr.id=so.programme_id
    where pr.key='ibdp' and so.availability='active'
      and (
        so.external_code is null
        or so.external_code_kind <> 'ib_subject_code'
        or cardinality(so.levels_supported)=0
        or not (so.levels_supported <@ array['SL','HL']::text[])
      )
  ));

select public._t('IB DP1 and DP2 expose the same canonical offering count',
  (select count(*) from public.subject_offering so
   join public.curriculum_stage st on st.id=so.stage_id
   where st.key='ibdp_1' and so.availability='active')
  =
  (select count(*) from public.subject_offering so
   join public.curriculum_stage st on st.id=so.stage_id
   where st.key='ibdp_2' and so.availability='active'));

select public._t('every offering has first-party source provenance',
  not exists (
    select 1 from public.subject_offering so
    where so.source_url is null
       or so.source_version is null
       or so.source_checked_at is null
       or so.source_url !~ '^https://'
  ));

select public._t('restricted assessment provenance has an explicit access class',
  not exists (
    select 1 from public.scheme_document
    where copyright_access_class not in
      ('public_official','licensed_official','metadata_only','not_ingestible')
  ));

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
