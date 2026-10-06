-- AXO-207 — "What's coming up": official exam dates for the student's own papers.
--
-- Reference data (read-only to clients, loaded by scripts/exams/ingest.py from
-- the checksummed manifest in curriculum/exams/sources.json):
--   exam_zone_location   Cambridge's own location → administrative-zone lookup
--   exam_timetable       one published timetable (series × zone × variant)
--   exam_sitting         one component's fixed date, or its test window
--   syllabus_paper_route the paper combinations a syllabus allows, per level,
--                        read from the syllabus's assessment overview
-- Student data (Student Mode scope, editable any time in Settings):
--   student_exam_plan    where the student sits and which series
--   student_exam_papers  the papers the student sits per syllabus
--
-- Nothing here is inferred. A date shown to a student comes from a timetable
-- row with its source; papers are either the ones every route requires
-- ("known") or the ones the student chose.

-- ── reference: zones ───────────────────────────────────────────────────────
create table public.exam_zone_location (
  location_key      text primary key check (length(btrim(location_key)) > 0),
  -- The value Cambridge's lookup uses; two places can share one.
  lookup_value      text not null check (length(btrim(lookup_value)) > 0),
  label             text not null check (length(btrim(label)) > 0),
  country           text not null check (length(btrim(country)) > 0),
  zone              smallint not null check (zone between 1 and 6),
  -- Cambridge publishes a separate timetable for UK centres (zone 3).
  timetable_variant text not null default '' check (timetable_variant in ('', 'uk')),
  source_url        text not null check (source_url ~ '^https://'),
  fetched_at        timestamptz not null
);

comment on table public.exam_zone_location is
  'Cambridge administrative zone for each location in Cambridge''s own zone lookup (one row per option it offers). Countries spanning zones have one row per city.';

-- ── reference: timetables ──────────────────────────────────────────────────
create table public.exam_timetable (
  id                uuid primary key default gen_random_uuid(),
  provider_key      text not null check (provider_key in ('cambridge', 'cbse', 'ib')),
  series_key        text not null check (series_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  series_label      text not null check (length(btrim(series_label)) > 0),
  zone              smallint check (zone between 1 and 6),
  timetable_variant text not null default '' check (timetable_variant in ('', 'uk')),
  status            text not null check (status in ('provisional', 'final')),
  version_label     text,
  source_url        text not null check (source_url ~ '^https://'),
  source_sha256     text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  fetched_at        timestamptz not null,
  -- Errors in the board's own document that the reader resolved, each
  -- confirmed by a second view of the same document. Shown with the source.
  errata            text[] not null default '{}',
  -- The first and last day anything in the timetable happens (dates and
  -- windows), so a finished series can be told apart without its rows.
  first_date        date not null,
  last_date         date not null check (last_date >= first_date),
  unique (provider_key, series_key, zone, timetable_variant),
  check (provider_key <> 'cambridge' or zone is not null)
);

comment on table public.exam_timetable is
  'One published exam timetable as fetched from the board, with provenance. A new version replaces the rows of the old one.';

create table public.exam_sitting (
  id               uuid primary key default gen_random_uuid(),
  timetable_id     uuid not null references public.exam_timetable (id) on delete cascade,
  qualification    text not null check (qualification in ('igcse', 'igcse_9_1', 'o_level', 'as', 'a_level')),
  syllabus_code    text not null check (syllabus_code ~ '^[0-9]{4}$'),
  component        text not null check (component ~ '^[0-9]{2}$'),
  -- Component 12 is paper 1, variant 2; component 03 is paper 3 (no variant).
  paper            smallint generated always as (
                     case when left(component, 1) = '0' then right(component, 1)::smallint
                          else left(component, 1)::smallint end) stored,
  title            text not null check (length(btrim(title)) > 0),
  exam_date        date,
  session          text check (session in ('AM', 'PM', 'EV')),
  duration_minutes smallint check (duration_minutes > 0),
  window_start     date,
  window_end       date,
  unique (timetable_id, syllabus_code, component),
  check (
    (exam_date is not null and session is not null and duration_minutes is not null
       and window_start is null and window_end is null)
    or (exam_date is null and session is null and duration_minutes is null
       and window_start is not null and window_end is not null and window_end >= window_start))
);

create index exam_sitting_lookup_idx on public.exam_sitting (syllabus_code, timetable_id);

comment on table public.exam_sitting is
  'One component in one timetable: a fixed date and session, or a test window the school schedules inside.';

-- ── reference: paper routes ────────────────────────────────────────────────
create table public.syllabus_paper_route (
  id             uuid primary key default gen_random_uuid(),
  provider_key   text not null check (provider_key = 'cambridge'),
  syllabus_code  text not null check (syllabus_code ~ '^[0-9]{4}$'),
  programme_key  text not null check (programme_key in ('cambridge_igcse', 'cambridge_as', 'cambridge_a_level')),
  -- 'whole': every paper in one series. 'complete': the second year of a
  -- staged A Level, after the AS papers were taken and carried forward.
  kind           text not null check (kind in ('whole', 'complete')),
  papers         smallint[] not null check (cardinality(papers) between 1 and 9 and papers <@ array[1,2,3,4,5,6,7,8,9]::smallint[]),
  source_url     text not null check (source_url ~ '^https://'),
  source_sha256  text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  unique (syllabus_code, programme_key, papers)
);

comment on table public.syllabus_paper_route is
  'Paper combinations a syllabus allows at one level, from the syllabus''s assessment overview. Papers in every route of a level are known; the rest the student chooses.';

-- ── student: plan and papers ───────────────────────────────────────────────
create table public.student_exam_plan (
  student_id   uuid primary key references public.student (id) on delete cascade,
  location_key text references public.exam_zone_location (location_key),
  series_key   text check (series_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  updated_at   timestamptz not null default now()
);

comment on table public.student_exam_plan is
  'Where the student sits Cambridge exams (picks the zone timetable) and the series they are preparing for. Set once from the Home card, editable in Settings.';

create table public.student_exam_papers (
  student_id    uuid not null references public.student (id) on delete cascade,
  syllabus_code text not null check (syllabus_code ~ '^[0-9]{4}$'),
  papers        smallint[] not null check (cardinality(papers) between 1 and 9 and papers <@ array[1,2,3,4,5,6,7,8,9]::smallint[]),
  updated_at    timestamptz not null default now(),
  primary key (student_id, syllabus_code)
);

comment on table public.student_exam_papers is
  'The papers the student sits for one syllabus in their series, as they chose them. Where the syllabus has published routes, the set must be one of them.';

create function private.check_student_exam_papers() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_programme text;
begin
  new.papers := (select array_agg(distinct p order by p) from unnest(new.papers) p);
  new.updated_at := now();
  if not exists (select 1 from public.student_subject ss
                  where ss.student_id = new.student_id and ss.syllabus_code = new.syllabus_code) then
    raise exception 'syllabus % is not one of this student''s subjects', new.syllabus_code using errcode = '23514';
  end if;
  select p.key into v_programme
    from public.student s join public.curriculum_programme p on p.id = s.programme_id
   where s.id = new.student_id;
  if exists (select 1 from public.syllabus_paper_route r
              where r.syllabus_code = new.syllabus_code and r.programme_key = v_programme)
     and not exists (select 1 from public.syllabus_paper_route r
              where r.syllabus_code = new.syllabus_code and r.programme_key = v_programme
                and r.papers = new.papers) then
    raise exception 'papers % are not a published route for % at this level', new.papers, new.syllabus_code
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger student_exam_papers_check
  before insert or update on public.student_exam_papers
  for each row execute function private.check_student_exam_papers();

create function private.touch_student_exam_plan() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger student_exam_plan_touch
  before update on public.student_exam_plan
  for each row execute function private.touch_student_exam_plan();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.exam_zone_location enable row level security;
alter table public.exam_timetable enable row level security;
alter table public.exam_sitting enable row level security;
alter table public.syllabus_paper_route enable row level security;
alter table public.student_exam_plan enable row level security;
alter table public.student_exam_papers enable row level security;

create policy exam_zone_location_read on public.exam_zone_location for select to authenticated using (true);
create policy exam_timetable_read on public.exam_timetable for select to authenticated using (true);
create policy exam_sitting_read on public.exam_sitting for select to authenticated using (true);
create policy syllabus_paper_route_read on public.syllabus_paper_route for select to authenticated using (true);

create policy student_exam_plan_select on public.student_exam_plan
  for select to authenticated using (private.student_scope_allows(student_id));
create policy student_exam_plan_insert on public.student_exam_plan
  for insert to authenticated with check (private.student_scope_allows(student_id));
create policy student_exam_plan_update on public.student_exam_plan
  for update to authenticated using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));

create policy student_exam_papers_select on public.student_exam_papers
  for select to authenticated using (private.student_scope_allows(student_id));
create policy student_exam_papers_insert on public.student_exam_papers
  for insert to authenticated with check (private.student_scope_allows(student_id));
create policy student_exam_papers_update on public.student_exam_papers
  for update to authenticated using (private.student_scope_allows(student_id))
  with check (private.student_scope_allows(student_id));
create policy student_exam_papers_delete on public.student_exam_papers
  for delete to authenticated using (private.student_scope_allows(student_id));

revoke all on public.exam_zone_location, public.exam_timetable, public.exam_sitting,
  public.syllabus_paper_route, public.student_exam_plan, public.student_exam_papers from anon, authenticated;
grant select on public.exam_zone_location, public.exam_timetable, public.exam_sitting,
  public.syllabus_paper_route to authenticated;
grant select, insert, update on public.student_exam_plan to authenticated;
grant select, insert, update, delete on public.student_exam_papers to authenticated;
