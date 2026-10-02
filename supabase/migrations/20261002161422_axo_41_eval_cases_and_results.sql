-- AXO-41/44/125: the stage-level eval. Cases, per-case results, and a place for the run's verdict.
--
-- Explain is text in, text out over stored region data, so it can be evaluated without images,
-- without replaying a pipeline run, and without writing anything a student can see. A replay on a
-- real paper would create a run that nothing stops from committing into a student's live data
-- (commit_extraction_run does not look at eval_run_id), so this table pair is the isolated path.
--
--   eval_case          one input. Synthetic cases carry their input; a production case carries only a
--                      pointer to the stored region (on delete cascade, so a deleted paper or erased
--                      student takes the case with it) and the text is read at run time.
--   eval_case_result   one candidate's answer to one case: validity, the hard-rule checks, the judge's
--                      scores, latency and cost. Scores and flags only, never model or student text.
--
-- Everything is service-role only. Causes on cases are DRAFT labels: human_labels stays null until a
-- person confirms them, and only human labels may ever be release-gate truth.

create table if not exists public.eval_case (
  id                 uuid primary key,
  golden_set_version text not null,
  stage              text not null check (stage in ('explain')),
  source             text not null check (source in ('synthetic', 'production')),
  curriculum         text not null check (curriculum in ('cambridge', 'cbse', 'ibdp')),
  subject            text,
  input              jsonb,
  source_region_id   uuid references public.question_region (id) on delete cascade,
  draft_labels       jsonb,
  human_labels       jsonb,
  needs_human_label  boolean not null default true,
  labelled_by        text,
  labelled_at        timestamptz,
  traps              text[] not null default '{}',
  created_at         timestamptz not null default now(),
  constraint eval_case_has_input check (
    (source = 'synthetic' and input is not null and source_region_id is null)
    or (source = 'production' and source_region_id is not null and input is null)
  ),
  constraint eval_case_labelled_has_a_person check (
    needs_human_label or (human_labels is not null and labelled_by is not null and labelled_at is not null)
  )
);

create index if not exists eval_case_set_idx on public.eval_case (golden_set_version, stage);
create index if not exists eval_case_region_idx on public.eval_case (source_region_id) where source_region_id is not null;

alter table public.eval_run
  add column if not exists kind text not null default 'pipeline' check (kind in ('pipeline', 'stage')),
  add column if not exists thresholds_ref text,
  add column if not exists summary jsonb,
  add column if not exists passed boolean;

create table if not exists public.eval_case_result (
  id                          bigint generated always as identity primary key,
  eval_run_id                 uuid not null references public.eval_run (id) on delete cascade,
  case_id                     uuid not null references public.eval_case (id) on delete cascade,
  candidate_key               text not null,
  model                       text not null,
  thinking_level              text,
  prompt_version              text,
  status                      text not null default 'queued' check (status in ('queued', 'done', 'failed', 'skipped')),
  skipped_reason              text,
  schema_valid                boolean,
  attempts                    integer,
  teacher_mark_contradiction  boolean,
  loss_reasons_ok             boolean,
  do_this_next_clears_floor   boolean,
  grounding_status            text,
  can_explain                 boolean,
  cause                       text,
  faithfulness                smallint check (faithfulness between 1 and 5),
  judge_flags                 text[] not null default '{}',
  latency_ms                  integer,
  cost_usd                    numeric(12, 6),
  error_code                  text,
  created_at                  timestamptz not null default now(),
  unique (eval_run_id, case_id, candidate_key)
);

create index if not exists eval_case_result_run_idx on public.eval_case_result (eval_run_id);
create index if not exists eval_case_result_case_idx on public.eval_case_result (case_id);

alter table public.eval_case enable row level security;
alter table public.eval_case_result enable row level security;
revoke all on public.eval_case, public.eval_case_result from anon, authenticated;
grant select, insert, update on public.eval_case, public.eval_case_result to service_role;
grant select, insert, update on public.eval_run to service_role;
grant usage on sequence public.eval_case_result_id_seq to service_role;

comment on table public.eval_case is
  'Eval inputs. Synthetic cases carry their input; production cases point at a stored region (cascade-deleted with it). Causes are DRAFT until human_labels is set by a person.';
comment on table public.eval_case_result is
  'One candidate model on one case: flags, scores, latency, cost. No model or student text.';
