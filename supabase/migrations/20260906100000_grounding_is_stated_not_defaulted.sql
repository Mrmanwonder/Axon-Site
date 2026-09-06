-- ============================================================================
-- Grounding is stated, never defaulted
-- ============================================================================
-- 20260906090000 added `grounding_status` with `default 'complete'`, backfilled
-- only the rows carrying a model_answer, and left the rest on the default.
--
-- That was wrong, and it only became visible once the frontend started using
-- the column to decide what a diagnosis may claim. Nine rows in
-- region_explanation now read `complete` — not because anything verified them,
-- but because that is what the column does when nobody says otherwise. Every
-- one was generated on 2026-09-04, two days before the pipeline that computes
-- grounding was deployed (axon-backend CI run 23, 2026-09-06 07:05 UTC). Their
-- grounding is not complete; it is unknown, and unknown is not a value the
-- earlier migration gave itself a way to say.
--
-- The consequence was not hypothetical. The question detail screen now reads
-- `grounding_status` to decide whether the explanation is presented as grounded
-- subject knowledge or as an observation about how the answer was written.
-- Under the default, nine explanations written without any dependency chain
-- would have been presented as fully grounded — the original defect of this
-- whole line of work, reintroduced through a column default.
--
-- Two changes:
--
--   The nine are marked `no_verified_answer_source` — there is no source we can
--   attest to, because nothing recorded one.
--
--   The default is dropped. The column stays NOT NULL, so an insert that does
--   not state its grounding now fails loudly instead of quietly claiming the
--   best case. A default that means "everything is fine" is exactly the shape
--   of the bug this project keeps finding: a confident value with nothing
--   behind it. The only writers are mastery-explain, which sets it explicitly,
--   and commit_extraction_run, which carries it across.
-- ============================================================================

update public.region_explanation
   set grounding_status = 'no_verified_answer_source'
 where grounding_status = 'complete'
   and generated_at < timestamptz '2026-09-06 07:05:00+00';

update public.mark_loss_event e
   set grounding_status = 'no_verified_answer_source'
  from public.region_explanation r
 where e.grounding_status = 'complete'
   and r.generated_at < timestamptz '2026-09-06 07:05:00+00'
   and e.attempt_id in (
     select q.committed_attempt_id
       from public.question_region q
      where q.id = r.region_id
        and q.committed_attempt_id is not null
   );

-- Anything the join above could not reach is still a pre-deploy row: every
-- mark_loss_event in this database was committed before the pipeline shipped,
-- so none of them can honestly claim a grounding that was never computed.
update public.mark_loss_event
   set grounding_status = 'no_verified_answer_source'
 where grounding_status = 'complete'
   and created_at < timestamptz '2026-09-06 07:05:00+00';

alter table public.region_explanation alter column grounding_status drop default;
alter table public.mark_loss_event    alter column grounding_status drop default;

comment on column public.region_explanation.grounding_status is
  'Whether this row''s corrected working was grounded, and if not, why. Closed list, NOT NULL and with no default: a writer must state it, because a default of ''complete'' is a confident value with nothing behind it. Only `complete` permits a model_answer. `heuristic_off_topic` is a coarse net for prose generated without the question, never a correctness check.';
