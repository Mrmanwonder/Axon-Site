-- AXO-191: evidence-backed, versioned intrinsic question difficulty.
-- A rating is about the canonical question, never the student's ability.
-- Only privileged ingestion writes ratings. Users can read ratings for questions
-- in their currently authorized student scope; no global question catalog leaks.
create table public.canonical_question_difficulty (
  id uuid primary key default gen_random_uuid(),
  canonical_question_id uuid not null references public.canonical_question(id) on delete cascade,
  source text not null check (source in
    ('official_board_statistics','structural_estimate','anonymized_historical','model_estimate')),
  band smallint not null check (band between 1 and 5),
  normalized_score numeric(4,3) not null check (normalized_score between 0 and 1),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  method_version text not null check (length(method_version) between 1 and 64),
  source_reference text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (canonical_question_id, source, method_version),
  constraint official_difficulty_needs_source check
    (source <> 'official_board_statistics' or nullif(btrim(source_reference),'') is not null)
);
create index canonical_question_difficulty_lookup_idx
  on public.canonical_question_difficulty(canonical_question_id, source, created_at desc);
alter table public.canonical_question_difficulty enable row level security;
create policy canonical_question_difficulty_read_scoped on public.canonical_question_difficulty
  for select to authenticated using (
    exists (select 1 from public.student_attempt a
      where a.canonical_question_id = canonical_question_difficulty.canonical_question_id
        and a.student_id = (select private.current_student_scope_id()))
  );
revoke all on public.canonical_question_difficulty from anon, authenticated;
grant select on public.canonical_question_difficulty to authenticated;
-- No INSERT/UPDATE/DELETE grants to authenticated. Model fallback cannot
-- silently replace official evidence or inflate confidence.

create or replace view public.canonical_question_difficulty_current
with (security_invoker = true) as
select distinct on (canonical_question_id)
  id, canonical_question_id, source, band, normalized_score,
  confidence, method_version, source_reference, created_at
from public.canonical_question_difficulty
order by canonical_question_id,
  case source
    when 'official_board_statistics' then 1
    when 'structural_estimate' then 2
    when 'anonymized_historical' then 3
    else 4
  end asc,
  confidence desc, created_at desc;
grant select on public.canonical_question_difficulty_current to authenticated;

-- A deliberately conservative *estimated* seed. Marks and the initial
-- command word are weak structural clues, never official difficulty evidence.
-- It does not parse student work and never writes back to marks.
create or replace function private.structural_question_band(p_marks smallint, p_question text)
returns smallint language sql immutable set search_path = '' as $$
  select least(5, greatest(
    case when p_marks <= 1 then 1 when p_marks <= 3 then 2
         when p_marks <= 5 then 3 when p_marks <= 8 then 4 else 5 end,
    case when coalesce(p_question, '') ~* '^\\s*(evaluate|assess|justify|discuss|analyse|analyze)\\b' then 4
         when coalesce(p_question, '') ~* '^\\s*(explain|compare|derive|prove)\\b' then 3
         else 1 end
  ))::smallint;
$$;
create or replace function private.seed_canonical_question_difficulty()
returns trigger language plpgsql set search_path = '' as $$
declare v_band smallint;
begin
  if new.max_marks is null or new.max_marks < 1 then return new; end if;
  v_band := private.structural_question_band(new.max_marks, new.question_text);
  insert into public.canonical_question_difficulty (
    canonical_question_id, source, band, normalized_score, confidence, method_version, evidence
  ) values (
    new.id, 'structural_estimate', v_band, (v_band - 1)::numeric / 4,
    0.280, 'structural-v1', jsonb_build_object('marks',new.max_marks,'method','marks-and-command-word')
  ) on conflict (canonical_question_id,source,method_version) do nothing;
  return new;
end;
$$;
create trigger axo_191_difficulty_seed
after insert on public.canonical_question
for each row execute function private.seed_canonical_question_difficulty();
-- Backfill same stable estimate for existing canonical records. One row per
-- canonical question/method; further recomputations require a NEW version.
insert into public.canonical_question_difficulty
  (canonical_question_id,source,band,normalized_score,confidence,method_version,evidence)
select q.id, 'structural_estimate',
  private.structural_question_band(q.max_marks,q.question_text),
  (private.structural_question_band(q.max_marks,q.question_text)-1)::numeric / 4,
  0.280, 'structural-v1',
  jsonb_build_object('marks',q.max_marks,'method','marks-and-command-word')
from public.canonical_question q where q.max_marks >= 1
on conflict (canonical_question_id,source,method_version) do nothing;

-- Snapshot the *method/version* used when a question is saved, so a later
-- approved better rating cannot silently rewrite the historical interpretation.
create table public.attempt_question_difficulty_snapshot (
  attempt_id uuid primary key references public.student_attempt(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  difficulty_id uuid not null references public.canonical_question_difficulty(id),
  created_at timestamptz not null default now()
);
create index attempt_question_difficulty_student_idx
  on public.attempt_question_difficulty_snapshot(student_id);
alter table public.attempt_question_difficulty_snapshot enable row level security;
create policy attempt_question_difficulty_read_scoped
  on public.attempt_question_difficulty_snapshot
  for select to authenticated using (
    student_id = (select private.current_student_scope_id())
    and exists (select 1 from public.student_attempt a
      where a.id = attempt_id and a.student_id = attempt_question_difficulty_snapshot.student_id)
  );
revoke all on public.attempt_question_difficulty_snapshot from anon, authenticated;
grant select on public.attempt_question_difficulty_snapshot to authenticated;

create or replace function private.snapshot_question_difficulty()
returns trigger language plpgsql set search_path = '' as $$
declare v_difficulty uuid;
begin
  if new.canonical_question_id is null then return new; end if;
  select id into v_difficulty from public.canonical_question_difficulty
    where canonical_question_id = new.canonical_question_id
    order by case source
      when 'official_board_statistics' then 1 when 'structural_estimate' then 2
      when 'anonymized_historical' then 3 else 4 end, confidence desc, created_at desc
    limit 1;
  if v_difficulty is not null then
    insert into public.attempt_question_difficulty_snapshot(attempt_id,student_id,difficulty_id)
      values(new.id,new.student_id,v_difficulty)
      on conflict (attempt_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger axo_191_snapshot_attempt_difficulty
after insert or update of canonical_question_id on public.student_attempt
for each row execute function private.snapshot_question_difficulty();
-- Snapshot existing attempts once. Never mutate an existing snapshot.
insert into public.attempt_question_difficulty_snapshot (attempt_id,student_id,difficulty_id)
select a.id,a.student_id,d.id
from public.student_attempt a
join public.canonical_question_difficulty_current d on d.canonical_question_id = a.canonical_question_id
where a.canonical_question_id is not null
on conflict (attempt_id) do nothing;

create or replace view public.question_difficulty_analytics
with (security_invoker = true) as
select a.id as attempt_id, a.student_id, a.paper_id,
  d.band, d.normalized_score, d.confidence, d.source, d.method_version,
  a.max_marks, a.marks_awarded
from public.attempt_analytics a
join public.attempt_question_difficulty_snapshot s on s.attempt_id = a.id
join public.canonical_question_difficulty d on d.id = s.difficulty_id;
grant select on public.question_difficulty_analytics to authenticated;
comment on table public.canonical_question_difficulty is
  'Intrinsic canonical difficulty with confidence, evidence hierarchy and version history; never a student judgement.';
