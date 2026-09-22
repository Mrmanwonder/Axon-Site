# AXON V1 Product Blueprint

## Product vision

Axon turns a marked paper into clear, trustworthy feedback a student can act on.

The core loop is:

1. Scan or upload a marked paper.
2. Extract questions, answers, teacher marks, and awarded marks.
3. Ask the student to review anything uncertain.
4. Explain mistakes from evidence that can be traced back to the paper.
5. Build useful insights from confirmed results.

Axon is not a planner, digital twin, social network, or generic chat product.

## Audience

- CAIE IGCSE, AS & A Level students
- Primarily ages 13–17
- Students who want to understand exactly where marks were lost and what to do differently

## Product principles

- Evidence before inference.
- Never fabricate a mark, teacher comment, answer, source, or certainty.
- Uncertain extraction must be reviewable.
- Student-confirmed data is more trusted than model guesses.
- One obvious next action per screen.
- Fast, quiet, Apple-like interaction polish.
- Private academic data stays inside the minimum required processing boundary.

## Core surfaces

1. Home
2. Library
3. Scan
4. Paper review
5. Question detail
6. Insights
7. Settings
8. Privacy / Terms / Cookies

## Runtime ownership

### Axon-Site

Owns:
- browser UI
- scanner/capture UX
- local/offline state
- Supabase schema and migrations
- billing Edge Functions
- public/legal pages

### axon-backend

Owns:
- student-facing paper API
- Cloudflare Queues
- triage / structure / crop / content / reconcile / adjudicate / explain
- Gemini model calls
- Tavily live-web grounding
- R2 server access and signing
- sweep/recovery

There must be no second paper-processing/model runtime in Axon-Site.

## V1 success criteria

A successful V1 lets a student reliably go from a marked paper to:
- the correct paper/subject in their library,
- question-by-question marks and feedback,
- explicit uncertainty where the system is not sure,
- explanations grounded in the paper and, when genuinely needed, safe public web evidence,
- aggregate insights based only on sufficiently trusted data.
