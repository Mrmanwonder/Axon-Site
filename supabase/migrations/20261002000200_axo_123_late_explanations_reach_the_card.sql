-- AXO-123: an explanation that finishes after its run was committed must still reach the card.
--
-- The question screen reads mark_loss_event. commit_extraction_run is the only thing that wrote
-- it, copying region_explanation as it stood at commit. Since AXO-124 a run may commit while an
-- explanation has failed, and a student can retry it later. The retry produced a
-- region_explanation row that nothing ever copied across: the region read `done` and the card
-- showed "we don't have an explanation for this one yet". Found by running the production retry
-- on runs 89c8d7a9 / e36ca484 (4 regions explained, 0 mark_loss_event rows).
--
-- This trigger does the same copy as commit_extraction_run, for a region that already has a
-- committed attempt. Before commit it does nothing (commit copies it). It updates the live
-- (non-rejected) row if there is one, and inserts one only when the attempt has no row at all. A
-- changed explanation clears the student's confirmation of the old one, so they are never shown as
-- confirming text they have not seen. A row the student rejected is left alone and nothing is added
-- beside it: the database refuses a second row whose marks lost would exceed the marks forgone, and
-- a rejected cause is the student's word.

create or replace function private.sync_explanation_to_loss_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.question_region;
  v_conf public.confidence;
begin
  select * into r from public.question_region where id = new.region_id;
  if r.id is null or r.committed_attempt_id is null then
    return new;
  end if;
  if new.cause is null or new.marks_lost is null
     or r.marks_awarded is null or r.marks_available is null
     or new.marks_lost > r.marks_available - r.marks_awarded then
    return new;
  end if;

  v_conf := case when r.confidence_tier = 'confident' then 'likely'::public.confidence
                 else 'unsure'::public.confidence end;

  update public.mark_loss_event m
     set cause = new.cause,
         marks_lost = new.marks_lost,
         ai_explanation = new.body,
         do_this_next = new.do_this_next,
         concepts = coalesce(new.concepts, '{}'),
         command_word = new.command_word,
         command_word_note = new.command_word_note,
         model_answer = new.model_answer,
         loss_reasons = coalesce(new.loss_reasons, '[]'::jsonb),
         grounding_status = new.grounding_status,
         model_answer_source = new.model_answer_source,
         depends_on_parts = coalesce(new.depends_on_parts, '{}'),
         unresolved_parts = coalesce(new.unresolved_parts, '{}'),
         confidence = v_conf,
         student_confirmed_at = case when m.ai_explanation is distinct from new.body
                                     then null else m.student_confirmed_at end
   where m.attempt_id = r.committed_attempt_id
     and m.student_rejected_at is null;

  if not found
     and not exists (select 1 from public.mark_loss_event m where m.attempt_id = r.committed_attempt_id) then
    insert into public.mark_loss_event (
      attempt_id, student_id, cause, marks_lost, ai_explanation, do_this_next, confidence,
      concepts, command_word, command_word_note, model_answer, loss_reasons,
      grounding_status, model_answer_source, depends_on_parts, unresolved_parts)
    values (
      r.committed_attempt_id, new.student_id, new.cause, new.marks_lost, new.body, new.do_this_next, v_conf,
      coalesce(new.concepts, '{}'), new.command_word, new.command_word_note, new.model_answer,
      coalesce(new.loss_reasons, '[]'::jsonb),
      new.grounding_status, new.model_answer_source,
      coalesce(new.depends_on_parts, '{}'), coalesce(new.unresolved_parts, '{}'));
  end if;
  return new;
end;
$$;

revoke all on function private.sync_explanation_to_loss_event() from public, anon, authenticated;

drop trigger if exists region_explanation_sync_loss_event on public.region_explanation;
create trigger region_explanation_sync_loss_event
  after insert or update on public.region_explanation
  for each row execute function private.sync_explanation_to_loss_event();

-- One-off: explanations that already exist for committed attempts but never reached the card.
update public.region_explanation e
   set run_id = e.run_id
 where exists (select 1 from public.question_region q
                where q.id = e.region_id and q.committed_attempt_id is not null);
