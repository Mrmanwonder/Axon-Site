-- ============================================================================
-- 0008 · Fix account erasure for accounts with student-scoped consent
-- ============================================================================
-- delete_my_account() could not delete a student that any consent_event
-- referenced, because consent_event.student_id is ON DELETE RESTRICT — and that
-- is every account which ever recorded a student-scoped decision, such as
-- toggling the weekly digest. Erasure therefore failed outright for real
-- accounts. Caught by testing with a withdrawal present.
--
-- Fixed the way the guardian already worked: strip the personal data and keep
-- the row as a tombstone, so the append-only ledger keeps its referent.
-- Changing the FK to SET NULL would not work either — that is an UPDATE, which
-- the append-only trigger correctly refuses — and it would erase the scope of
-- the recorded decision, which is part of the evidence.

alter table public.student add column if not exists deleted_at timestamptz;

comment on column public.student.deleted_at is
  'Set when the account is erased. The row is retained without personal data so consent_event keeps its referent; it is unreachable because its guardian has released auth_user_id.';

create or replace function public.delete_my_account()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_auth     uuid := (select auth.uid());
  v_guardian uuid;
  v_students int;
begin
  if v_auth is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select g.id into v_guardian from public.guardian g where g.auth_user_id = v_auth;
  if v_guardian is null then raise exception 'no account for this session' using errcode = '42501'; end if;

  -- Papers first. Cascades paper_page, student_attempt, mark_loss_event,
  -- page_unreadable and attempt_concept — all of the actual content.
  delete from public.paper
   where student_id in (select id from public.student where guardian_id = v_guardian);

  delete from public.student_subject
   where student_id in (select id from public.student where guardian_id = v_guardian);

  update public.student
     set first_name = '[erased]', deleted_at = now(), updated_at = now()
   where guardian_id = v_guardian and deleted_at is null;
  get diagnostics v_students = row_count;

  delete from public.app_preference where guardian_id = v_guardian;

  update public.guardian
     set name = '[erased]', contact = '[erased]',
         verified_at = null, verification_method = null, verification_ref = null,
         auth_user_id = null, deleted_at = now(), updated_at = now()
   where id = v_guardian;

  -- Releasing the auth row ends access. Last, because auth.uid() is needed above.
  delete from auth.users where id = v_auth;

  return jsonb_build_object(
    'erased', true,
    'students_erased', v_students,
    'guardian_retained_as_tombstone', v_guardian);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
