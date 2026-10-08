-- AXO-190: optional perceived difficulty is a student's impression, never a mark.
-- All writes are scoped to the currently authorised student and the same paper.
create table if not exists public.paper_perceived_difficulty (
  paper_id uuid primary key references public.paper(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  rating smallint,
  skipped boolean not null default false,
  prompt_version text not null default 'v1',
  responded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paper_perceived_difficulty_choice_check
    check ((rating is not null and rating between 1 and 5 and not skipped) or (rating is null and skipped)),
  constraint paper_perceived_difficulty_version_check
    check (length(prompt_version) between 1 and 32)
);
create index if not exists paper_perceived_difficulty_student_idx
  on public.paper_perceived_difficulty(student_id);
alter table public.paper_perceived_difficulty enable row level security;

create policy paper_perceived_difficulty_select
  on public.paper_perceived_difficulty for select to authenticated
  using (
    student_id = (select private.current_student_scope_id())
    and exists (select 1 from public.paper p
      where p.id = paper_id and p.student_id = paper_perceived_difficulty.student_id)
  );
create policy paper_perceived_difficulty_insert
  on public.paper_perceived_difficulty for insert to authenticated
  with check (
    private.student_scope_allows(student_id)
    and exists (select 1 from public.paper p
      where p.id = paper_id and p.student_id = paper_perceived_difficulty.student_id)
  );
create policy paper_perceived_difficulty_update
  on public.paper_perceived_difficulty for update to authenticated
  using (
    private.student_scope_allows(student_id)
    and exists (select 1 from public.paper p
      where p.id = paper_id and p.student_id = paper_perceived_difficulty.student_id)
  )
  with check (
    private.student_scope_allows(student_id)
    and exists (select 1 from public.paper p
      where p.id = paper_id and p.student_id = paper_perceived_difficulty.student_id)
  );
revoke all on public.paper_perceived_difficulty from anon;
grant select, insert, update on public.paper_perceived_difficulty to authenticated;

-- Insights reads the secure analytics boundary, not raw student work.
create or replace view public.paper_difficulty_analytics with (security_invoker = true) as
  select paper_id, student_id, rating, skipped, responded_at
  from public.paper_perceived_difficulty
  where not skipped;
grant select on public.paper_difficulty_analytics to authenticated;
comment on table public.paper_perceived_difficulty is
  'AXO-190: a student-reported feeling about one paper. Not used to grade or modify marks.';
