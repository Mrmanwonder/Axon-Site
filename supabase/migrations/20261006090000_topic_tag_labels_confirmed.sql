-- The owner confirmed the 50 topic_tag golden labels on 2026-10-06 (eval run
-- 7ca49ba7-6f11-4d11-b212-416d7d1987d1 matched every one). The draft labels become the human
-- labels; evals/golden/topic-tag-v1.json records the same.
update public.eval_case
set human_labels = draft_labels - 'draft',
    needs_human_label = false,
    labelled_by = 'owner',
    labelled_at = timestamptz '2026-10-06 00:00:00+00'
where golden_set_version = 'topic-tag-synthetic-v1'
  and stage = 'topic_tag'
  and needs_human_label;
