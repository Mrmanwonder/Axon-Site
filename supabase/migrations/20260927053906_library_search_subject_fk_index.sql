-- AXO-49 follow-up: cover the canonical subject foreign key for FK maintenance.
-- The existing (student_id, subject_offering_id, date_taken) index serves
-- per-student Library browsing but cannot efficiently service operations that
-- begin from subject_offering_id itself.

create index if not exists paper_subject_offering_idx
  on public.paper(subject_offering_id);
