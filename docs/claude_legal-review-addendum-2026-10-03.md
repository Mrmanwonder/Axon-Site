# Legal and provider review addendum — 3 October 2026

**Draft for owner/counsel review. No public page or publication date changed.**
Baseline: Site main191e305. Supplements the existing1October legal audit and2October decisions; newer source/terms supersede old claims of OpenRouter routing or zero retention. This document does not choose a provider or conclude that an age restriction is resolved.

## Verified discrepancies and exact proposed replacements

| Surface | Current statement/problem | Proposed text for counsel | Publication prerequisite |
|---|---|---|---|
| Privacy §8 | Paid Gemini requests/responses “are not retained by Google” | “Relevant instructions, text and page images are sent to Google's Gemini API to provide the requested feature. For paid services, Google's current terms say prompts and responses are not used to improve its products. Google nevertheless retains content for safety and policy enforcement under its applicable terms, including the retention described in its abuse-monitoring policy. Axon does not claim zero retention for this route.” | Confirm actual billing/project and endpoint; approve appropriate student-data processing route; counsel approves disclosure. |
| Privacy §15 first paragraph | Stored objects removed before authentication is released | “Account closure removes or de-identifies the account records covered by the deletion flow and queues removal of stored paper objects. Object removal runs asynchronously and is not guaranteed to finish before authentication access ends. Limited copies may remain in backups, security systems or legally required records as described below.” | Verify queue delivery/retry/tombstone behavior and support escalation for failed cleanup; counsel review. |
| Privacy §15 telemetry paragraph | Paper/student anonymisation could imply every deletion path is covered | “Axon preserves limited operational usage facts, such as model, token counts, latency and cost, for accounting and reliability. Content references and identifying details are removed by the applicable deletion process. These retained facts are separate from student academic records.” | AXO-128 region erasure source review; confirm precise policy for single-question deletion/re-extraction; counsel review. |
| Optional learning notice | “Anonymised corrections” does not precisely cover consented corrections/verdicts | Use the existing AXO-75 proposed feedback-and-corrections notice as a draft; describe pseudonymous minimized signals, no raw academic text, consent-based use, withdrawal purge and no automatic model training. | Decide whether explanation verdicts need separate purpose; new notice_version/re-prompt strategy; actual successful production signals and reports. |
| Tutor/scheme/verification copy | Capabilities exist in part but release/provenance/provider acceptance incomplete | Keep conditional, source-specific wording. Do not claim a generally released Tutor, universal official-scheme grounding, independently verified guardian relationship, or passing real-paper acceptance. | AXO-126/34/56–59 exact acceptance, owner and counsel decisions. |

## Direct official-source verification

Sources opened on3October2026:
- https://ai.google.dev/gemini-api/terms — effective23March2026; page updated28April2026. Paid-service data terms distinguish product improvement from limited safety logging. Age requirements restrict API clients directed toward or likely accessed by people under18.
- https://ai.google.dev/gemini-api/docs/usage-policies — updated9June2026. Abuse monitoring specifies55-day content retention and possible authorized human review of flagged content.

The published product policy explicitly describes under18 student profiles. **Inference requiring counsel/provider confirmation:** the current AI Studio API route needs a deliberate eligibility review; guardian-controlled login by itself does not establish an exception to the provider's client restriction. Obtain written provider/contract evidence for an eligible route before extending access. Do not assume Vertex eligibility or zero retention merely from changing provider names or allow_training=false.

The55-day provider policy is not Axon's own database-retention duration and must not be presented as one. Provider terms may change; verify again at publication.

## Current implementation facts and unresolved evidence

- Current source names Google AI Studio, Supabase, Cloudflare/R2/Queues, Tavily, Stripe, Google OAuth and optional PostHog. Avoid replacing this with the stale OpenRouter language from older drafts.
- Paper/student telemetry anonymisation is present. All156 absent-question-region references are deliberate synthetic eval_case attribution;0 genuine or unclassified orphan references were found. They must not be anonymised as a deletion backfill. The independent source gap is the lack of an explicit question-removal/re-extraction erasure hook. See docs/claude_database-spec-audit-2026-10-03.md.
- Learning schema/triggers/aggregation are present; production signals/daily rows are0. A synthetic evaluation failed. Foundation implementation does not establish a working consented correction loop.
- Replay prevention/masking fixes are merged; latest Linear evidence verifies deployed configuration, while runtime masking and fresh OAuth callback metadata remain open. Do not strengthen guarantees from configuration alone.
- Export is described as limited to available account records; keep the support route for a complete access request.
- Region, cloud residency, entity/address, PostHog retention settings, provider agreements and launch-jurisdiction conclusions need owner/counsel facts. Do not invent them.

## Review order and release checklist

1. Owner chooses eligible provider/data route and launch market based on actual contract/billing facts.
2. Counsel reviews age/client eligibility, child/guardian consent, data-transfer and retention terms.
3. Engineering implements approved routes and region erasure, preserving free core access and teacher-mark authority; exact-head CI passes.
4. Prove deployed route/privacy settings and a genuine authorized disposable deletion, including queued object cleanup.
5. Update public policy and consent notices through the publication commit; set dates only at that time.
6. Run mobile/dark/light policy layout checks and record exact deployment identity in AXO-27/74/75/76.

Status remains draft and In Progress in Linear. No legal conclusion, consent expansion, provider switch, paid model evaluation, policy publication or date change was performed.
