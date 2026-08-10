-- ============================================================================
-- 0005 · Move internal helpers out of the exposed API schema
-- ============================================================================
-- Anything in `public` is reachable as a PostgREST RPC endpoint. That made the
-- SECURITY DEFINER helpers callable directly, and two of them took arbitrary
-- ids — so a signed-in user could ask
--
--     POST /rest/v1/rpc/consent_is_granted {guardian, student, purpose}
--
-- about a family that is not theirs. The function bypasses RLS by design, so it
-- answered. Small leak, but consent state across accounts is exactly the kind of
-- thing that should be unreachable rather than merely unadvertised.
--
-- PostgREST only exposes the schemas it is configured with (`public` by
-- default), so relocating these to `private` removes the endpoints entirely
-- while policies and triggers keep working. search_path is pinned on every one.
--
-- The client never needed those RPCs: it reads its own consent state through the
-- RLS-scoped view added at the end of this file.
-- ============================================================================

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ── helpers, relocated ─────────────────────────────────────────────────────

create or replace function private.current_guardian_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select g.id from public.guardian g where g.auth_user_id = (select auth.uid());
$$;

create or replace function private.consent_is_granted(p_guardian uuid, p_student uuid, p_purpose text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select ce.granted from public.consent_event ce
      where ce.guardian_id = p_guardian and ce.purpose = p_purpose and ce.student_id = p_student
      order by ce.seq desc limit 1),
    (select ce.granted from public.consent_event ce
      where ce.guardian_id = p_guardian and ce.purpose = p_purpose and ce.student_id is null
      order by ce.seq desc limit 1),
    false);
$$;

create or replace function private.all_required_consents_granted(p_guardian uuid, p_student uuid default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select not exists (
    select 1 from public.consent_purpose cp
    where cp.is_required and not private.consent_is_granted(p_guardian, p_student, cp.purpose));
$$;

create or replace function private.owns_storage_student_prefix(object_name text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.student s
    where s.guardian_id = private.current_guardian_id()
      and s.id::text = (storage.foldername(object_name))[1]);
$$;

-- ── trigger functions, relocated and search_path pinned ────────────────────
-- These were also RPC-callable. A trigger function invoked directly returns an
-- error rather than doing damage, but there is no reason for the endpoint to
-- exist, and an unpinned search_path on a SECURITY DEFINER function is a
-- hijacking vector.

create or replace function private.consent_event_is_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception
    'consent_event is append-only: % is not permitted. Record a withdrawal as a new row with granted = false.', tg_op
    using errcode = '42501';
end;
$$;

create or replace function private.enforce_student_consent_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.all_required_consents_granted(new.guardian_id, new.id) then
    raise exception 'cannot write student data: guardian % has not granted all required purposes', new.guardian_id
      using errcode = '42501', hint = 'Record consent_event rows for every required purpose first.';
  end if;
  return new;
end;
$$;

create or replace function private.enforce_paper_consent_gate()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_guardian uuid;
begin
  select s.guardian_id into v_guardian from public.student s where s.id = new.student_id;
  if v_guardian is null then
    raise exception 'unknown student %', new.student_id using errcode = '23503';
  end if;
  if not private.consent_is_granted(v_guardian, new.student_id, 'store_papers') then
    raise exception 'cannot store a paper: store_papers consent is not currently granted for student %', new.student_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.check_marks_lost_total()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare bad record;
begin
  select a.id as aid, a.max_marks - a.marks_awarded as forgone, sum(m.marks_lost) as claimed
    into bad
  from public.student_attempt a
  join public.mark_loss_event m on m.attempt_id = a.id
  where a.id in (select attempt_id from changed)
  group by a.id, a.max_marks, a.marks_awarded
  having sum(m.marks_lost) > a.max_marks - a.marks_awarded
  limit 1;
  if bad.aid is not null then
    raise exception 'mark_loss_event total (%) exceeds marks forgone (%) on attempt %', bad.claimed, bad.forgone, bad.aid
      using errcode = '23514';
  end if;
  return null;
end;
$$;

grant execute on function
  private.current_guardian_id(),
  private.consent_is_granted(uuid, uuid, text),
  private.all_required_consents_granted(uuid, uuid),
  private.owns_storage_student_prefix(text)
to authenticated;

-- ── repoint triggers ───────────────────────────────────────────────────────

drop trigger if exists consent_event_no_update on public.consent_event;
drop trigger if exists consent_event_no_delete on public.consent_event;
drop trigger if exists student_consent_gate     on public.student;
drop trigger if exists paper_consent_gate       on public.paper;
drop trigger if exists mark_loss_total_insert   on public.mark_loss_event;
drop trigger if exists mark_loss_total_update   on public.mark_loss_event;

create trigger consent_event_no_update before update on public.consent_event
  for each row execute function private.consent_event_is_append_only();
create trigger consent_event_no_delete before delete on public.consent_event
  for each row execute function private.consent_event_is_append_only();
create trigger student_consent_gate before insert on public.student
  for each row execute function private.enforce_student_consent_gate();
create trigger paper_consent_gate before insert on public.paper
  for each row execute function private.enforce_paper_consent_gate();
create trigger mark_loss_total_insert after insert on public.mark_loss_event
  referencing new table as changed for each statement execute function private.check_marks_lost_total();
create trigger mark_loss_total_update after update on public.mark_loss_event
  referencing new table as changed for each statement execute function private.check_marks_lost_total();

-- ── repoint policies ───────────────────────────────────────────────────────

drop policy if exists student_select_own          on public.student;
drop policy if exists student_insert_own          on public.student;
drop policy if exists student_update_own          on public.student;
drop policy if exists student_delete_own          on public.student;
drop policy if exists student_subject_all_own     on public.student_subject;
drop policy if exists consent_event_select_own    on public.consent_event;
drop policy if exists consent_event_insert_own    on public.consent_event;
drop policy if exists paper_all_own               on public.paper;
drop policy if exists attempt_all_own             on public.student_attempt;
drop policy if exists loss_all_own                on public.mark_loss_event;
drop policy if exists page_unreadable_all_own     on public.page_unreadable;
drop policy if exists attempt_concept_all_own     on public.attempt_concept;
drop policy if exists papers_select_own           on storage.objects;
drop policy if exists papers_insert_own           on storage.objects;
drop policy if exists papers_update_own           on storage.objects;
drop policy if exists papers_delete_own           on storage.objects;

create policy student_select_own on public.student for select to authenticated
  using (guardian_id = private.current_guardian_id());
create policy student_insert_own on public.student for insert to authenticated
  with check (guardian_id = private.current_guardian_id());
create policy student_update_own on public.student for update to authenticated
  using (guardian_id = private.current_guardian_id()) with check (guardian_id = private.current_guardian_id());
create policy student_delete_own on public.student for delete to authenticated
  using (guardian_id = private.current_guardian_id());

create policy student_subject_all_own on public.student_subject for all to authenticated
  using (exists (select 1 from public.student s where s.id = student_subject.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s where s.id = student_subject.student_id and s.guardian_id = private.current_guardian_id()));

create policy consent_event_select_own on public.consent_event for select to authenticated
  using (guardian_id = private.current_guardian_id());
create policy consent_event_insert_own on public.consent_event for insert to authenticated
  with check (guardian_id = private.current_guardian_id() and (student_id is null or exists (
    select 1 from public.student s where s.id = consent_event.student_id and s.guardian_id = private.current_guardian_id())));

create policy paper_all_own on public.paper for all to authenticated
  using (exists (select 1 from public.student s where s.id = paper.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s where s.id = paper.student_id and s.guardian_id = private.current_guardian_id()));

create policy attempt_all_own on public.student_attempt for all to authenticated
  using (exists (select 1 from public.student s where s.id = student_attempt.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s where s.id = student_attempt.student_id and s.guardian_id = private.current_guardian_id()));

create policy loss_all_own on public.mark_loss_event for all to authenticated
  using (exists (select 1 from public.student s where s.id = mark_loss_event.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s where s.id = mark_loss_event.student_id and s.guardian_id = private.current_guardian_id()));

create policy page_unreadable_all_own on public.page_unreadable for all to authenticated
  using (exists (select 1 from public.student s where s.id = page_unreadable.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s where s.id = page_unreadable.student_id and s.guardian_id = private.current_guardian_id()));

create policy attempt_concept_all_own on public.attempt_concept for all to authenticated
  using (exists (select 1 from public.student s where s.id = attempt_concept.student_id and s.guardian_id = private.current_guardian_id()))
  with check (exists (select 1 from public.student s where s.id = attempt_concept.student_id and s.guardian_id = private.current_guardian_id()));

create policy papers_select_own on storage.objects for select to authenticated
  using (bucket_id = 'papers' and private.owns_storage_student_prefix(name));
create policy papers_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and private.owns_storage_student_prefix(name)
    and private.consent_is_granted(private.current_guardian_id(), ((storage.foldername(name))[1])::uuid, 'store_papers'));
create policy papers_update_own on storage.objects for update to authenticated
  using (bucket_id = 'papers' and private.owns_storage_student_prefix(name))
  with check (bucket_id = 'papers' and private.owns_storage_student_prefix(name));
create policy papers_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'papers' and private.owns_storage_student_prefix(name));

-- ── drop the exposed originals ─────────────────────────────────────────────

drop function if exists public.current_guardian_id();
drop function if exists public.consent_is_granted(uuid, uuid, text);
drop function if exists public.all_required_consents_granted(uuid, uuid);
drop function if exists public.owns_storage_student_prefix(text);
drop function if exists public.consent_event_is_append_only();
drop function if exists public.enforce_student_consent_gate();
drop function if exists public.enforce_paper_consent_gate();
drop function if exists public.check_marks_lost_total();

-- ── what the client reads instead ──────────────────────────────────────────
-- Current consent state, RLS-scoped, so the UI can read authoritative consent
-- without an RPC that accepts someone else's ids. security_invoker keeps the
-- caller's RLS in force; without it a view is a hole straight through RLS.

create or replace view public.consent_current with (security_invoker = true) as
select distinct on (guardian_id, student_id, purpose)
  guardian_id, student_id, purpose, granted, notice_version, method, seq, created_at
from public.consent_event
order by guardian_id, student_id, purpose, seq desc;

comment on view public.consent_current is
  'Latest consent decision per (guardian, student, purpose) for the signed-in guardian only. Read authoritatively — never cached optimistically.';

grant select on public.consent_current to authenticated;
