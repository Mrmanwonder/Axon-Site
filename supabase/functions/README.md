# Supabase Edge Functions

## Runtime ownership

Supabase is not the production paper-processing runtime.

The scanner/review pipeline and every model call run from
`Mrmanwonder/axon-backend` on Cloudflare Workers. That repository owns:

- upload and paper API handling
- triage, structure, crop, content, reconcile, adjudicate, and explain workers
- Cloudflare Queues and sweep/recovery
- R2 access/signing
- Gemini
- Tavily live-web grounding

This repository keeps only the Supabase Edge Functions that are genuinely part
of the current product:

```
billing-checkout
billing-portal
stripe-webhook
```

They share only:

```
_shared/http.ts
_shared/parent_mode.ts
_shared/stripe.ts
```

Do not add a second model client, queue worker, R2 pipeline, Tavily adapter, or
scanner worker under `supabase/functions/`. Make production pipeline changes in
`axon-backend`.

## Deployment

See `supabase/DEPLOY.md`. The deployment command in this repository is
billing-only.
