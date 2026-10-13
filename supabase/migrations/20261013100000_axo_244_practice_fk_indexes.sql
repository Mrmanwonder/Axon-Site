-- AXO-244 follow-up: covering indexes for the two practice foreign keys the
-- Supabase performance advisor flagged after 20261013090000/090100 were
-- applied on 13 Oct 2026 (unindexed_foreign_keys). Both tables are new and
-- small, so a plain index inside the migration transaction is fine.
create index if not exists practice_intention_session_idx on public.practice_intention (session_id);
create index if not exists tag_eval_label_attempt_idx on public.tag_eval_label (attempt_id);
