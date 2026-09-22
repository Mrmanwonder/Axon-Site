# AXON Engineering Specification

# Volume IV — AI Specification

## Purpose

Axon's AI layer reads marked-paper evidence and produces structured,
auditable outputs for the paper-processing and explanation pipeline.

The production implementation lives in `Mrmanwonder/axon-backend` on
Cloudflare Workers.

## Stages

1. Triage — determine whether submitted pages are usable/appropriate.
2. Structure — locate question regions and page relationships.
3. Content — read question/answer/mark fields with provenance.
4. Reconcile — deterministic consistency checks.
5. Adjudicate — inspect conflicts without silently overriding evidence.
6. Explain — explain confirmed lost marks and produce a useful next step.

Crop and sweep/recovery are supporting runtime stages.

## Model runtime

- Gemini is called from the shared Cloudflare backend client.
- Model selection/routing remains explicit and observable.
- Structured outputs are validated by code.
- A schema match is not treated as proof of semantic correctness.
- Retries are bounded.

## Live web grounding

Tavily is available only from the Cloudflare backend.

For the current product it is enabled for explanation calls. The model may
decide whether web evidence is needed, but it cannot author the outbound search
query. Server code constructs the query from public academic context such as
subject and question text.

Never include student answers, teacher remarks, names, emails, IDs, auth data,
or signed URLs in Tavily search context. URL extraction is restricted to public
URLs returned by the same search.

## Grounding and provenance

High-trust claims must be supported by one or more of:
- source page/region provenance,
- deterministic arithmetic/consistency checks,
- student confirmation,
- explicitly recorded public web sources.

If grounding is insufficient, the system should withhold or mark the output
uncertain.

## Evaluation

Track at minimum:
- extraction accuracy,
- mark/question attribution accuracy,
- false-confident error rate,
- review/correction rate,
- explanation grounding rate,
- hallucination/withheld rate,
- latency,
- model/tool failures,
- cost.

The primary optimization target is not model eloquence. It is trustworthy,
useful academic feedback.
