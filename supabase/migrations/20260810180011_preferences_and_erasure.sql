-- ============================================================================
-- 0006 · Settings persistence and account erasure
-- ============================================================================

-- ── guardian tombstone ─────────────────────────────────────────────────────
-- Erasure removes personal data but must not remove the consent ledger: that
-- log is the compliance evidence, and it references guardian. So the guardian
-- row survives as a tombstone carrying no personal data, and auth_user_id is
-- released so the person can never sign back into it.

alter table public.guardian
  add column if not exists deleted_at timestamptz;

alter table public.guardian
  alter column auth_user_id drop not null;

alter table public.guardian
  drop constraint if exists guardian_auth_user_id_fkey;

alter table public.guardian
  add constraint guardian_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users (id) on delete set null;

comment on column public.guardian.deleted_at is
  'Set when the account is erased. The row is retained without personal data so consent_event keeps its referent; auth_user_id is released so the account cannot be signed into.';

-- ── preferences ────────────────────────────────────────────────────────────
-- Device-affecting display settings are stored per guardian so they follow the
-- account, and mirrored into localStorage by the client so a cold start paints
-- the right theme before the network answers.
--
-- Note what is NOT here: the weekly parent digest and extraction-improvement
-- toggles are consent decisions, not preferences. They are written to
-- consent_event so that turning one off is a recorded withdrawal.

create table if not exists public.app_preference (
  guardian_id            uuid primary key references public.guardian (id) on delete cascade,
  theme                  text        not null default 'dark'   check (theme in ('light', 'dark', 'system')),
  text_size              text        not null default 'm'      check (text_size in ('s', 'm', 'l')),
  reduce_motion          boolean     not null default false,
  always_show_reasoning  boolean     not null default false,
  notify_paper_ready     boolean     not null default true,
  notify_correction      boolean     not null default true,
  updated_at             timestamptz not null default now()
);

comment on table public.app_preference is
  'Display and notification preferences. Consent-bearing switches live in consent_event instead, so withdrawing one is recorded.';

alter table public.app_preference enable row level security;

create policy app_preference_all_own on public.app_preference for all to authenticated
  using (guardian_id = private.current_guardian_id())
  with check (guardian_id = private.current_guardian_id());

-- ── account erasure ────────────────────────────────────────────────────────
-- Takes no arguments and derives the account from the session, so there is no
-- id to tamper with. SECURITY DEFINER because it must reach auth.users.
--
-- Storage objects are NOT removed here: Supabase's protect_delete() trigger
-- refuses direct SQL deletes on storage.objects, so the client clears the
-- student's path prefix through the Storage API before calling this. The
-- function reports how many students it erased so the caller can verify.

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth     uuid := (select auth.uid());
  v_guardian uuid;
  v_students int;
begin
  if v_auth is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select g.id into v_guardian from public.guardian g where g.auth_user_id = v_auth;
  if v_guardian is null then
    raise exception 'no account for this session' using errcode = '42501';
  end if;

  -- Cascades through paper, student_attempt, mark_loss_event, page_unreadable,
  -- attempt_concept and student_subject.
  delete from public.student where guardian_id = v_guardian;
  get diagnostics v_students = row_count;

  delete from public.app_preference where guardian_id = v_guardian;

  -- Strip personal data, keep the row so the consent ledger keeps its referent.
  update public.guardian
     set name                = '[erased]',
         contact             = '[erased]',
         verified_at         = null,
         verification_method = null,
         verification_ref    = null,
         auth_user_id        = null,
         deleted_at          = now(),
         updated_at          = now()
   where id = v_guardian;

  -- Releasing the auth row is what actually ends access. Done last, because
  -- auth.uid() is needed above.
  delete from auth.users where id = v_auth;

  return jsonb_build_object(
    'erased', true,
    'students_erased', v_students,
    'guardian_retained_as_tombstone', v_guardian);
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account is
  'Erases the signed-in account: student data is deleted, guardian personal data is stripped, the auth row is released. The consent ledger is deliberately retained as compliance evidence. Storage objects must be cleared by the caller first via the Storage API.';
