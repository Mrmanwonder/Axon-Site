-- A single, consistent snapshot for Insights. Invoker security preserves all
-- existing RLS and analytics eligibility rules. No service credentials or base
-- student-attempt/mark-loss tables are used. JSON aggregation avoids the
-- PostgREST row cap silently truncating students with more than 1,000 attempts.
create or replace function public.insight_snapshot(p_student_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
with attempts as (select id,paper_id,question_label,question_text,max_marks,marks_awarded,question_order,answer_blank from public.attempt_analytics where student_id = p_student_id),
losses as (select id,attempt_id,cause,marks_lost,do_this_next,command_word,concepts,loss_reasons,depends_on_parts,created_at from public.mark_loss_analytics where student_id = p_student_id),
felt as (select paper_id,rating,responded_at from public.paper_difficulty_analytics where student_id = p_student_id),
difficulty as (select attempt_id,paper_id,band,normalized_score,confidence,source,method_version,max_marks,marks_awarded from public.question_difficulty_analytics where student_id = p_student_id),
subjects as (select subject,subject_offering_id,display_name_snapshot,external_code_snapshot from public.student_subject where student_id = p_student_id),
links as (select subject_offering_id,document_id from public.subject_offering_syllabus where subject_offering_id in (select subject_offering_id from subjects)),
documents as (select id,provider_key,syllabus_code,title,version_label,valid_from_year,valid_to_year,source_url,fetched_at from public.syllabus_document where id in (select document_id from links)),
topics as (select id,document_id,parent_id,code,kind,title,objective_text,notes_text,group_title,qualification_scope,sort_order from public.syllabus_topic where document_id in (select id from documents)),
evidence as (select attempt_id,paper_id,topic_id,document_id,is_primary,max_marks,marks_awarded from public.topic_evidence where student_id = p_student_id and document_id in (select id from documents))
select jsonb_build_object(
'evidence', jsonb_build_object(
'attempts', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from attempts r),
'losses', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from losses r),
'felt', (select coalesce(jsonb_agg(to_jsonb(r) order by r.paper_id), '[]'::jsonb) from felt r),
'difficulty', (select coalesce(jsonb_agg(to_jsonb(r) order by r.attempt_id), '[]'::jsonb) from difficulty r)),
'syllabus', jsonb_build_object(
'subjects', (select coalesce(jsonb_agg(to_jsonb(r) order by r.subject_offering_id), '[]'::jsonb) from subjects r),
'links', (select coalesce(jsonb_agg(to_jsonb(r) order by r.document_id,r.subject_offering_id), '[]'::jsonb) from links r),
'documents', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from documents r),
'topics', (select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order,r.id), '[]'::jsonb) from topics r),
'evidence', (select coalesce(jsonb_agg(to_jsonb(r) order by r.attempt_id,r.topic_id), '[]'::jsonb) from evidence r)));
$$;
revoke all on function public.insight_snapshot(uuid) from public, anon;
grant execute on function public.insight_snapshot(uuid) to authenticated;
