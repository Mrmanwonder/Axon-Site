-- AXO-207 follow-up: cover student_exam_plan.location_key, flagged by the
-- Supabase performance advisor (unindexed foreign key) after 20261006100000.
create index if not exists student_exam_plan_location_idx on public.student_exam_plan (location_key);
