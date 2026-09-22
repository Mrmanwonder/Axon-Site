# AXON Engineering Specification

# Volume V — Backend Specification

## Production backend

The production paper runtime is `Mrmanwonder/axon-backend` on Cloudflare.

### Workers

- `mastery-api`
- `mastery-triage`
- `mastery-structure`
- `mastery-crop`
- `mastery-content`
- `mastery-reconcile`
- `mastery-adjudicate`
- `mastery-explain`
- `mastery-sweep`

### Shared backend responsibilities

- Supabase access helpers
- checked database I/O
- queue consumer semantics
- R2/signing
- Gemini client
- Tavily
- prompts/schemas/validators
- confidence/reconciliation/attribution logic
- shared browser/backend contract

## Axon-Site backend responsibilities

Supabase in Axon-Site owns schema/migrations and billing functions only:
- `billing-checkout`
- `billing-portal`
- `stripe-webhook`

Do not deploy paper workers from Axon-Site.

## Reliability rules

- A queue message is acknowledged only after durable completion, durable retry,
  or confirmed terminal state.
- Failed database reads are errors, not empty data.
- Writes that are expected to affect a row must prove that they did.
- Signed asset URLs are short-lived capabilities and must never be logged.
- At-least-once delivery must not create duplicate paid model work where an
  atomic claim can prevent it.
