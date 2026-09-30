-- AXO-114 · scanner capture-integrity production report
--
-- Read-only. Run against production after the merged client has produced real
-- camera captures. It deliberately reports only aggregate counts: no student,
-- paper, page, file path or hint text leaves the query.
--
-- The fields are written by src/scan/conditioning.js into paper_page.conditioning_meta.
-- Older camera rows without quad_confidence_at_shutter are excluded from the
-- denominator rather than guessed into a category.

with measured as (
  select
    created_at,
    conditioning_meta ->> 'quad_confidence_at_shutter' as confidence,
    conditioning_meta ->> 'rescue_redetect_attempted' as rescue_attempted,
    conditioning_meta ->> 'rescue_redetect_succeeded' as rescue_succeeded,
    conditioning_meta ->> 'geometry_confirmed' as geometry_confirmed
  from public.paper_page
  where source_kind = 'camera'
    and conditioning_meta ? 'quad_confidence_at_shutter'
),
windows as (
  select '7 days'::text as window, * from measured
   where created_at >= now() - interval '7 days'
  union all
  select '30 days'::text as window, * from measured
   where created_at >= now() - interval '30 days'
  union all
  select 'all instrumented'::text as window, * from measured
)
select
  window,
  count(*) as measured_camera_pages,
  count(*) filter (where confidence = 'locked') as locked_at_shutter,
  count(*) filter (where confidence in ('provisional', 'none')) as unlocked_at_shutter,
  round(
    100.0 * count(*) filter (where confidence in ('provisional', 'none'))
    / nullif(count(*), 0),
    2
  ) as unlocked_at_shutter_pct,
  count(*) filter (where rescue_attempted = 'true') as rescue_attempts,
  count(*) filter (where rescue_succeeded = 'true') as rescue_successes,
  round(
    100.0 * count(*) filter (where rescue_succeeded = 'true')
    / nullif(count(*) filter (where rescue_attempted = 'true'), 0),
    2
  ) as rescue_success_pct,
  count(*) filter (where geometry_confirmed = 'false') as geometry_unconfirmed
from windows
group by window
order by case window
  when '7 days' then 1
  when '30 days' then 2
  else 3
end;

-- Daily trend for spotting a detector regression after a release.
select
  date_trunc('day', created_at) as day,
  count(*) as measured_camera_pages,
  count(*) filter (
    where conditioning_meta ->> 'quad_confidence_at_shutter' in ('provisional', 'none')
  ) as unlocked_at_shutter,
  round(
    100.0 * count(*) filter (
      where conditioning_meta ->> 'quad_confidence_at_shutter' in ('provisional', 'none')
    ) / nullif(count(*), 0),
    2
  ) as unlocked_at_shutter_pct
from public.paper_page
where source_kind = 'camera'
  and conditioning_meta ? 'quad_confidence_at_shutter'
group by 1
order by 1 desc;
