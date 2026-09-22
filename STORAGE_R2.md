# R2 storage runtime

Production R2 access for the scanner/review pipeline is owned by
`Mrmanwonder/axon-backend` and runs in Cloudflare Workers.

Axon-Site contains the browser-side scanner/upload contract only. Server-side R2
reads, writes, signing, retention handling, and object validation must be changed
in `axon-backend/shared/src/r2.ts` and the relevant Cloudflare Worker.

Do not add R2 credentials or an R2 server client to Supabase Edge Functions in
this repository.
