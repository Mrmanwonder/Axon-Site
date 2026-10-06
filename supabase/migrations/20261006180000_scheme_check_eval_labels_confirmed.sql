-- AXO-202: the owner confirmed every expected estimate range in the scheme_check golden set
-- (evals/golden/scheme-check-v1.json) on 2026-10-06, after reviewing eval run c7a66b34.
-- The draft labels become human labels unchanged.
update public.eval_case
set human_labels = draft_labels - 'draft',
    labelled_by = 'owner (Tanmay Harkawat)',
    labelled_at = '2026-10-06T18:00:00Z',
    needs_human_label = false
where golden_set_version = 'scheme-check-synthetic-v1'
  and stage = 'scheme_check'
  and needs_human_label;
