-- ============================================================================
-- 0010 · The production monitor
-- ============================================================================
-- SCANNING_SYSTEM.md §18 names the reconciliation rate as the production
-- monitor, and it earns that: it is the best single proxy for end-to-end health
-- and the only metric in the harness that is measurable without labels. The
-- correction rate sits beside it, because it is the one signal that says where
-- the pipeline is weak in the field rather than on twenty papers from one city.
--
-- Aggregated per pipeline version, which is the whole point — a change is only
-- an improvement if the numbers moved, and they can only be compared if every
-- run says which version produced it.
--
-- Deliberately not granted to `authenticated`. This is infrastructure: it tells
-- us how the extractor is doing across every account, and nobody's student
-- dashboard has any business showing it. RLS is not the boundary here — the
-- absence of a grant is, which is what makes it service-role only.
-- ============================================================================

create view private.pipeline_health as
select
  r.pipeline_version,
  date_trunc('day', r.started_at)                                  as day,
  count(*)                                                          as runs,
  count(*) filter (where r.status = 'committed')                    as committed,
  count(*) filter (where r.status = 'failed')                       as failed,

  -- The monitor. Unaided means the arithmetic closed before the student touched
  -- anything, which is why it is measured over runs rather than over papers as
  -- they stand after review.
  count(*) filter (where r.reconciled)                              as reconciled,
  round(count(*) filter (where r.reconciled)::numeric
        / nullif(count(*), 0), 4)                                   as reconciliation_rate,

  -- How far out the ones that did not close were. A cluster around one
  -- question's typical value is a different problem from a long tail.
  round(avg(abs(r.reconcile_delta)) filter (where r.reconciled is false), 2)
                                                                    as mean_abs_delta,

  sum(q.total)                                                      as questions,
  sum(r.corrections_count)                                          as corrections,
  round(sum(r.corrections_count)::numeric / nullif(sum(q.total), 0), 4)
                                                                    as correction_rate,

  round(sum(q.unreadable)::numeric / nullif(sum(q.total), 0), 4)     as unreadable_rate,
  round(sum(q.unsure)::numeric / nullif(sum(q.total), 0), 4)         as unsure_rate,

  -- The number that decides whether the pricing model works. Much harder to
  -- retrofit than to log, so it is logged from day one.
  round(avg(r.cost_paise)::numeric, 1)                              as mean_cost_paise,
  round(avg((r.stage_timings ->> 'structure_ms')::numeric), 0)      as mean_structure_ms,
  round(avg((r.stage_timings ->> 'content_ms')::numeric), 0)        as mean_content_ms
from public.extraction_run r
left join lateral (
  select
    count(*)                                                        as total,
    count(*) filter (where confidence_tier = 'unreadable')          as unreadable,
    count(*) filter (where confidence_tier = 'unsure')              as unsure
  from public.question_region qr
  where qr.run_id = r.id
) q on true
group by r.pipeline_version, date_trunc('day', r.started_at);

comment on view private.pipeline_health is
  'Production health per pipeline version. Reconciliation rate is the monitor — measurable without labels, which is what the accuracy harness cannot be. Service-role only: it spans every account and belongs to nobody''s dashboard.';

-- No grant to anon or authenticated. service_role bypasses RLS and reaches it;
-- nothing else does, and that absence is the access control.
revoke all on private.pipeline_health from public, anon, authenticated;
