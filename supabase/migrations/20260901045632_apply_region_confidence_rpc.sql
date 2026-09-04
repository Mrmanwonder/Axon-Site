-- AXON_FIX_BRIEF.md §9.1: mastery-reconcile currently does one UPDATE per
-- question_region inside a single Promise.all, in one Worker invocation —
-- the same shape of subrequest-ceiling bug that took down mastery-content
-- before batch_size was capped at 1 (§3.3). Fine at today's <=7-question
-- papers, not fine at ~35+. This collapses it to one subrequest regardless
-- of question count.
create or replace function public.apply_region_confidence(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_count integer;
begin
  update public.question_region r
     set confidence_tier    = (e->>'tier')::public.confidence_tier,
         confidence_signals = coalesce(r.confidence_signals, '{}'::jsonb) || (e->'signals'),
         needs_review       = (e->>'needs_review')::boolean,
         updated_at         = now()
    from jsonb_array_elements(p_rows) e
   where r.id = (e->>'id')::uuid;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
