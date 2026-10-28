# Review pipeline

The production review pipeline no longer lives in this repository.

Authoritative implementation:

- Repository: `Mrmanwonder/axon-backend`
- Runtime: Cloudflare Workers
- Queueing: Cloudflare Queues
- Model: Gemini via the shared backend model client
- Live web grounding: Tavily in `axon-backend/shared/src/tavily.ts`
- Storage: Cloudflare R2

Axon-Site owns the browser UI, Supabase schema/migrations, and billing Edge
Functions. Do not implement or deploy paper-processing workers from this
repository.

The current browser/server contract is enforced by
`scripts/check-cross-repo-contract.mjs`, which compares
`src/scan/contract.js` with `axon-backend/shared/src/contract.ts`.
