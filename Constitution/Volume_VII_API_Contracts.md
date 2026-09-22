# AXON Engineering Specification

# Volume VII — API Contracts

## Runtime owner

Production paper APIs are implemented by `Mrmanwonder/axon-backend` on
Cloudflare Workers. Axon-Site must not create a parallel Supabase paper API.

## Student-facing paper API

The Cloudflare API owns the browser-facing operations required to:
- create/submit a paper workflow,
- obtain upload intents,
- confirm uploaded objects,
- retrieve signed paper/review assets,
- complete review and begin explanation,
- perform deletion operations that require R2/runtime coordination.

All endpoints must enforce authenticated ownership server-side.

## Queue contracts

Internal Cloudflare Queue messages carry identifiers needed by:
- triage,
- structure,
- crop,
- content,
- reconcile,
- adjudicate,
- explain,
- sweep/recovery.

Messages must be safe under at-least-once delivery. A queue acknowledgement
means durable completion, durable replacement/retry, or confirmed terminal
state.

## Model contract

All Gemini calls go through the shared backend model client.

Inputs define:
- stage,
- system/instruction content,
- optional images,
- structured output schema,
- post-parse validator,
- run/paper/region/student metadata,
- bounded retry/timeout behavior,
- optional live-web policy.

## Tavily contract

Live-web grounding exists only in `axon-backend`.

For explanation calls:
- the model may request search/extraction,
- the outbound search query is server-controlled public academic context,
- student answers, teacher remarks, identifiers, auth data, and signed URLs are
  excluded,
- extraction is limited to public URLs returned by the same search,
- consulted URLs are surfaced as source metadata.

## Supabase Edge Functions

Axon-Site deploys only billing functions:
- `billing-checkout`
- `billing-portal`
- `stripe-webhook`

These are not part of the paper/model runtime.
