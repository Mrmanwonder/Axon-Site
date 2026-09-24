-- Retire compatibility aliases now that the live Cambridge catalog is present.
-- Historical student_subject rows may keep referencing these offerings; they are
-- only excluded from new selection/search.

update public.subject_offering so
set availability='retired', updated_at=now()
from public.curriculum_programme pr
where so.programme_id=pr.id
  and pr.key='cambridge_igcse'
  and so.display_name in (
    'Additional Mathematics',
    'Combined Science',
    'English — First Language',
    'English Literature',
    'English as a Second Language',
    'ICT'
  )
  and so.external_code in ('0606','0653','0500','0475','0510','0417')
  and so.availability='active';

update public.subject_offering so
set availability='retired', updated_at=now()
from public.curriculum_programme pr
where so.programme_id=pr.id
  and pr.key in ('cambridge_as','cambridge_a_level')
  and (
    (so.display_name='Further Mathematics' and so.external_code='9231')
    or
    (so.display_name='English Literature' and so.external_code='9695')
  )
  and so.availability='active';

create unique index if not exists subject_offering_active_code_unique
  on public.subject_offering(programme_id, stage_id, external_code)
  where availability='active' and external_code is not null;
