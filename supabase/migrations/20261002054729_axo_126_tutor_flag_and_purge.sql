-- AXO-126 / AXO-39: Tutor internal stage.
--
-- 1. A per-guardian feature flag, `tutor_enabled`, default off. mastery-api asks the database
--    (as the signed-in user) before it forwards a Tutor request, so the Tutor is reachable only
--    for guardians someone has switched on. Nothing a client can write changes it.
--
-- 2. Deletion parity. The Tutor keeps provenance rows in its own D1 database (ai_trace and the
--    claim and evidence rows hanging off it, keyed by paper_id). When a paper is deleted, or a
--    student is erased, those rows must go too. tutor_purge is the queue: a trigger writes one
--    row per paper, and the sweep worker calls axon-intelligence to purge them, then stamps the
--    row. Same shape as r2_deletion.

create table if not exists public.guardian_feature_flag (
  guardian_id uuid not null references public.guardian(id) on delete cascade,
  flag        text not null check (flag in ('tutor_enabled')),
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (guardian_id, flag)
);
alter table public.guardian_feature_flag enable row level security;
revoke all on public.guardian_feature_flag from anon, authenticated;

create or replace function public.tutor_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select f.enabled
      from public.guardian_feature_flag f
      join public.guardian g on g.id = f.guardian_id
     where g.auth_user_id = (select auth.uid())
       and f.flag = 'tutor_enabled'
  ), false);
$$;
revoke all on function public.tutor_enabled() from public, anon;
grant execute on function public.tutor_enabled() to authenticated;

create table if not exists public.tutor_purge (
  id         bigint generated always as identity primary key,
  paper_id   uuid not null unique,
  created_at timestamptz not null default now(),
  attempts   integer not null default 0,
  done_at    timestamptz,
  error      text
);
alter table public.tutor_purge enable row level security;
revoke all on public.tutor_purge from anon, authenticated;
create index if not exists tutor_purge_pending_idx on public.tutor_purge (created_at) where done_at is null;

create or replace function private.enqueue_tutor_purge_for_paper()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tutor_purge (paper_id) values (old.id) on conflict (paper_id) do nothing;
  return old;
end;
$$;
revoke all on function private.enqueue_tutor_purge_for_paper() from public, anon, authenticated;

drop trigger if exists paper_tutor_purge on public.paper;
create trigger paper_tutor_purge
  before delete on public.paper
  for each row execute function private.enqueue_tutor_purge_for_paper();

-- Erasing a student without deleting their papers still has to reach the Tutor's rows.
create or replace function private.enqueue_tutor_purge_for_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.tutor_purge (paper_id)
    select p.id from public.paper p where p.student_id = new.id
    on conflict (paper_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_tutor_purge_for_student() from public, anon, authenticated;

drop trigger if exists student_tutor_purge on public.student;
create trigger student_tutor_purge
  after update of deleted_at on public.student
  for each row execute function private.enqueue_tutor_purge_for_student();

create or replace function public.claim_tutor_purges(p_limit integer default 20)
returns table (id bigint, paper_id uuid, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.tutor_purge d
     set attempts = d.attempts + 1
   where d.id in (
     select c.id from public.tutor_purge c
      where c.done_at is null and c.attempts < 20
      order by c.created_at
      for update skip locked
      limit greatest(p_limit, 1))
  returning d.id, d.paper_id, d.attempts;
end;
$$;
revoke all on function public.claim_tutor_purges(integer) from public, anon, authenticated;
grant execute on function public.claim_tutor_purges(integer) to service_role;

create or replace function public.finish_tutor_purge(p_id bigint, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tutor_purge
     set done_at = case when p_error is null then now() else null end,
         error = left(p_error, 200)
   where id = p_id;
$$;
revoke all on function public.finish_tutor_purge(bigint, text) from public, anon, authenticated;
grant execute on function public.finish_tutor_purge(bigint, text) to service_role;
