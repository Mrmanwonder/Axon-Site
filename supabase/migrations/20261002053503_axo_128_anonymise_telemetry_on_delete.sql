-- AXO-128: deleting a paper or a student must not leave identifiers behind in
-- model telemetry.
--
-- model_call and eval_result carry no foreign keys to paper or student (they are
-- operational logs and must outlive a failed run), so deleting a student or a
-- paper left their ids, region ids and R2 image keys sitting in those tables.
-- The owner decision is to anonymise, not cascade: the operational facts (which
-- stage, which model, tokens, cost, latency, whether it worked) are kept so cost
-- and reliability stay measurable; everything that points at a person or their
-- page is removed.
--
-- Removed from a row: student_id, paper_id, region_id, run_id, image_keys,
-- error_detail, tool_calls (may hold a search query built from printed question
-- text) and verification_failures (may quote content). Kept: stage, model,
-- prompt_version, token and cost columns, latency, attempt, ok, error_code,
-- http_status, flags and created_at.

create or replace function private.anonymise_model_telemetry(p_student uuid, p_paper uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.model_call
     set student_id = null, paper_id = null, region_id = null, run_id = null,
         image_keys = '{}', error_detail = null,
         tool_calls = '[]'::jsonb, verification_failures = '[]'::jsonb
   where (p_paper is not null and paper_id = p_paper)
      or (p_student is not null and student_id = p_student);

  update public.eval_result
     set paper_id = null, run_id = null
   where p_paper is not null and paper_id = p_paper;
end; $$;

revoke all on function private.anonymise_model_telemetry(uuid, uuid) from public, anon, authenticated;

create or replace function private.anonymise_on_paper_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.anonymise_model_telemetry(null, old.id);
  return old;
end; $$;

revoke all on function private.anonymise_on_paper_delete() from public, anon, authenticated;

-- BEFORE DELETE, so the paper id is still findable; it also fires for rows
-- removed by a cascade from the student.
create trigger paper_anonymise_telemetry
  before delete on public.paper
  for each row execute function private.anonymise_on_paper_delete();

create or replace function private.anonymise_on_student_erase()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' or (new.deleted_at is not null and old.deleted_at is null) then
    -- Calls with no paper (tutor) carry only the student id.
    perform private.anonymise_model_telemetry(old.id, null);
    perform private.anonymise_model_telemetry(null, p.id) from public.paper p where p.student_id = old.id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end; $$;

revoke all on function private.anonymise_on_student_erase() from public, anon, authenticated;

create trigger student_anonymise_telemetry_on_delete
  before delete on public.student
  for each row execute function private.anonymise_on_student_erase();

create trigger student_anonymise_telemetry_on_soft_delete
  after update of deleted_at on public.student
  for each row execute function private.anonymise_on_student_erase();

-- Backfill: rows already orphaned by earlier deletions.
update public.model_call mc
   set student_id = null, paper_id = null, region_id = null, run_id = null,
       image_keys = '{}', error_detail = null,
       tool_calls = '[]'::jsonb, verification_failures = '[]'::jsonb
 where (mc.paper_id is not null and not exists (select 1 from public.paper p where p.id = mc.paper_id))
    or (mc.student_id is not null and not exists (select 1 from public.student s where s.id = mc.student_id));

update public.eval_result er
   set paper_id = null, run_id = null
 where er.paper_id is not null and not exists (select 1 from public.paper p where p.id = er.paper_id);
