-- ══════════════════════════════════════════════════════════════════════════
-- Insights evidence columns (2026-10-04)
-- ══════════════════════════════════════════════════════════════════════════
-- Hard rule 3: aggregation reads attempt_analytics and mark_loss_analytics,
-- never the base tables. The explain stage has been writing per-question
-- evidence for weeks (command word, the per-mark loss breakdown, topic tags,
-- which earlier part an answer depended on) but none of it was exposed through
-- the analytics views, so Insights rendered "not ready yet" for modules whose
-- data already existed. This migration exposes those columns through the same
-- boundary. It changes no row filter: what is eligible for aggregation is
-- exactly what it was.
--
-- `create or replace view` may only append columns, so every existing column
-- is restated in its live order and the new ones go on the end.
--
-- attempt_analytics gains:
--   question_order  order_index of the committed question region, so pacing
--                   ("blank questions at the end of a paper") can be read in
--                   paper order rather than label order.
--   answer_blank    true when no answer text and no answer lines were read.
--                   Exposed as a boolean so the Insights read does not ship
--                   every answer just to test for emptiness.
--
-- mark_loss_analytics gains: command_word, concepts, loss_reasons,
-- depends_on_parts — all written by the explain stage, none of them marks.

create or replace view public.attempt_analytics with (security_invoker = true) as
select
  a.id,
  a.student_id,
  a.paper_id,
  a.paper_tier,
  a.canonical_question_id,
  a.question_label,
  a.question_text,
  a.student_answer,
  a.marks_awarded,
  a.max_marks,
  a.marks_source,
  a.teacher_remark,
  a.extraction_confidence,
  a.student_confirmed_at,
  a.created_at,
  a.updated_at,
  (
    select q.order_index
    from public.question_region q
    where q.committed_attempt_id = a.id
    order by q.created_at desc
    limit 1
  ) as question_order,
  (
    nullif(btrim(coalesce(a.student_answer, '')), '') is null
    and (
      a.answer_block is null
      or jsonb_typeof(a.answer_block -> 'lines') is distinct from 'array'
      or jsonb_array_length(a.answer_block -> 'lines') = 0
    )
  ) as answer_blank
from public.student_attempt a
where a.extraction_confidence <> 'unsure' or a.student_confirmed_at is not null;

comment on view public.attempt_analytics is
  'Attempts eligible for aggregation. An unsure extraction is excluded until the student confirms it, so one bad read cannot compound into a confidently wrong conclusion. question_order and answer_blank support the pacing read without shipping answers.';

create or replace view public.mark_loss_analytics with (security_invoker = true) as
select
  m.id,
  m.attempt_id,
  m.student_id,
  m.cause,
  m.marks_lost,
  m.ai_explanation,
  m.do_this_next,
  m.confidence,
  m.student_confirmed_at,
  m.student_rejected_at,
  m.created_at,
  m.command_word,
  m.concepts,
  m.loss_reasons,
  m.depends_on_parts
from public.mark_loss_event m
join public.attempt_analytics a on a.id = m.attempt_id
where (m.confidence <> 'unsure' or m.student_confirmed_at is not null)
  and m.student_rejected_at is null;

comment on view public.mark_loss_analytics is
  'Loss events eligible for aggregation: not unsure-and-unconfirmed, not rejected by the student, and hanging off an attempt that is itself eligible. Carries the explain stage''s command word, per-mark loss breakdown, topic tags and part dependencies for Insights.';

grant select on public.attempt_analytics, public.mark_loss_analytics to authenticated;

-- question_order is a lookup by committed_attempt_id per row; it is served by
-- the existing question_region_committed_attempt_idx.
