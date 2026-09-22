# Axon Site — Current Product Reference

This document describes the current Axon web product. Older Dashboard/Planner/
Timer/Mission concepts are retired and must not be used as implementation input.

## Product loop

```
Scan or upload a marked paper
        ↓
Process on Cloudflare
        ↓
Review uncertain extraction
        ↓
Understand each lost mark
        ↓
Build insights from trusted history
```

## Navigation

Primary authenticated surfaces:

- Home
- Library
- Scan
- Insights
- Settings

Paper routes:

- Paper overview
- Paper review
- Question detail

Public routes:

- Privacy
- Terms
- Cookies

## Design language

Axon should feel calm, compact, fast, and precise.

- Clear hierarchy with one obvious primary action.
- High information density without visual clutter.
- Consistent spacing and alignment.
- Short, snappy motion; no decorative latency.
- Skeletons for meaningful loading states.
- Full dark-mode parity.
- Accessible focus, dialogs, controls, and reduced-motion behavior.
- No UI that implies certainty the pipeline does not have.

## Library

The Library is the student's history of processed papers.

It must support:
- reliable subject identification,
- paper metadata,
- search across paper/question/answer content where available,
- status and review state,
- direct navigation to papers and questions.

## Scan

The Scan surface owns capture UX only. It must:
- start quickly,
- guide paper placement/quality,
- handle retakes atomically,
- show page preparation state,
- prevent duplicate submission,
- make failures recoverable.

The browser sends papers to the Cloudflare API. It does not run or host the
server extraction pipeline.

## Review and question detail

Uncertain model output is reviewed rather than disguised as fact.

Question detail should show only evidence-backed:
- question text,
- student answer,
- awarded/available marks,
- teacher feedback/mark evidence,
- explanation,
- corrected working when grounded,
- explicit withheld/uncertain states.

## Insights

Insights are derived from sufficiently trusted paper history. Unreviewed unsure
data must not silently become a trend or recommendation.

## Runtime split

### Axon-Site
- React/browser UI
- scanner/camera UX
- local state/offline shell
- Supabase schema/migrations
- billing Edge Functions
- public/legal pages

### axon-backend
- Cloudflare paper API
- R2
- Cloudflare Queues
- triage/structure/crop/content/reconcile/adjudicate/explain/sweep
- Gemini
- Tavily live-web grounding

Production AI/runtime logic must exist only in `axon-backend`.
