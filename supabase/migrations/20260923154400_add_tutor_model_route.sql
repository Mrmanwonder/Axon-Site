begin;

alter table public.model_call
  drop constraint model_call_stage_check;
alter table public.model_call
  add constraint model_call_stage_check
  check (stage in ('triage', 'structure', 'content', 'adjudicate', 'explain', 'tutor'));

alter table public.model_route
  drop constraint model_route_stage_check;
alter table public.model_route
  add constraint model_route_stage_check
  check (stage in ('triage', 'structure', 'content', 'adjudicate', 'explain', 'tutor'));

insert into public.model_route
  (stage, primary_model, fallbacks, temperature, max_tokens, prompt_version,
   allow_training, enabled, notes)
values
  ('tutor', 'gemini-3.5-flash-lite', '{}'::text[], 0.15, 4096,
   'tutor.explain_concept.v2', false, true,
   'Text-only tutor route. Student data stays behind the authenticated API; release remains blocked until zero-retention certification passes.')
on conflict (stage) do update
set primary_model = excluded.primary_model,
    fallbacks = excluded.fallbacks,
    temperature = excluded.temperature,
    max_tokens = excluded.max_tokens,
    prompt_version = excluded.prompt_version,
    allow_training = false,
    enabled = excluded.enabled,
    notes = excluded.notes;

comment on column public.model_route.allow_training is
  'Human-controlled privacy gate. Tutor and paper routes default false; application code cannot relax it.';

commit;
