# AXON Production Constitution

# Chapter 3 — System Principles

Axon has two runtime domains.

## Axon-Site

The Site repository owns:
- web UI and routing,
- camera/scanner UX,
- local/offline browser state,
- Supabase schema and migrations,
- billing Edge Functions,
- public/legal surfaces.

## axon-backend

The backend repository owns:
- the paper API,
- R2 access and signed assets,
- Cloudflare Queues,
- triage,
- structure,
- crop,
- content extraction,
- reconciliation,
- adjudication,
- explanation,
- Gemini,
- Tavily,
- sweep/recovery.

## Architectural rules

1. Production paper-processing code exists once: in `axon-backend`.
2. Axon-Site must not contain a second model client or scanner-worker runtime.
3. Every model-produced fact that matters must be validated and, where
   applicable, tied back to page/region provenance.
4. Queue acknowledgement must follow durable work, not merely attempted work.
5. Unknown, failed, missing, and zero are distinct states.
6. Model/web tools are optional dependencies; failure must degrade honestly.
7. Browser/server contracts crossing repositories are checked in CI.
