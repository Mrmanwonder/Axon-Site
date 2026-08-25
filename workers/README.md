# workers/

**Status: deployed.** All 8 scripts are live, all 12 queues exist, all
secrets are set, and the required migration
(`20260824120000_cloudflare_queue_fanout`) is applied to the Supabase
project. What's documented below as "setup" is what was actually done to get
here — kept as the record of how to reproduce or redeploy, not a future TODO.

Not yet done: a real paper has not been run through the live pipeline
end to end. The deploy is verified reachable (the asset route round-trips
its HMAC correctly) but not yet exercised with an actual scan, and the
Supabase-side cutover (disabling the old Edge Function path, pointing the
client at `mastery-api`) has not happened — see **Cutover** below.

The Cloudflare Workers runtime for the review pipeline, per
[`CLOUDFLARE_WORKERS.md`](../CLOUDFLARE_WORKERS.md) at the repo root. Ported
from `supabase/functions/{w-triage,w-structure,w-content,w-reconcile,
w-adjudicate,w-explain,w-r2-delete,paper-submit,upload-intent,upload-complete,
review-complete,queue-tick}` — the logic in each is unchanged; what changed is
the runtime underneath it.

Supabase keeps Postgres, RLS and Auth. Everything else — orchestration, the
queue-driven state machine, and the R2 access every stage does for images —
moves here.

## Layout

```
workers/
  shared/            code every script imports, none of it Deno-specific
    env.ts             the Env interface — bindings + secrets
    http.ts             CORS, RLS-scoped client, service client
    r2.ts               keys, presigned PUT, native R2-binding reads/deletes,
                         the signed asset route's HMAC
    openrouter.ts        the model client — unchanged logic from _shared/openrouter.ts
    worker.ts            consumeQueue() — the ack/retry/permanent-failure shape
    contract.ts, confidence.ts, reconcile.ts, quality_floor.ts,
    attribution.ts, schemas.ts, prompts.ts, prompts/*.ts
                        — copied verbatim from supabase/functions/_shared;
                          pure TypeScript, no Deno APIs, nothing to port
  api/                 mastery-api — HTTP entry point
  triage/              mastery-triage   — consumer of triage-queue
  structure/           mastery-structure — consumer of structure-queue
  content/             mastery-content   — consumer of content-queue
  reconcile/           mastery-reconcile — consumer of reconcile-queue
  adjudicate/          mastery-adjudicate — consumer of adjudicate-queue
  explain/             mastery-explain   — consumer of explain-queue
  sweep/               mastery-sweep     — cron: stuck runs + the deletion drain
```

Each worker directory has its own `wrangler.jsonc` and `src/index.ts`. There
is one `package.json` and `tsconfig.json` for the whole tree — run
`npm install` once, from `workers/`.

## Required migration

[`supabase/migrations/20260824120000_cloudflare_queue_fanout.sql`](../supabase/migrations/20260824120000_cloudflare_queue_fanout.sql)
**must land before any of this deploys.** pgmq has no equivalent of
`pgmq.send()` reachable from Cloudflare Queues — nothing in Postgres can push
into a Cloudflare Queue — so `advance_after_structure`, `advance_after_content`
and `begin_explanations`, which used to enqueue their own fan-out inside the
same transaction as their completion check, now return *what* to enqueue and
let the calling Worker send it. Read the migration's header comment for the
one guarantee this trades away (the enqueue is no longer atomic with the state
transition) and why the sweep's existing stuck-run cron is what closes that
gap, not a new mechanism.

## Setup

**`limits.cpu_ms` requires a Workers Paid plan** — the Free plan rejects it
outright (`CPU limits are not supported for the Free plan`). It's a cost
guard, not a functional requirement (per §0 above, `fetch` I/O doesn't count
against CPU time regardless of plan), so it's not in any `wrangler.jsonc`
here. Add it back per script once the account is on Paid, if you want the
guard.

```sh
cd workers
npm install
wrangler login

# One R2 bucket set, shared by every script that touches storage. Bucket
# names, key layout and lifecycle rules are STORAGE_R2.md's, unchanged.
wrangler r2 bucket create axon-originals
wrangler r2 bucket create axon-derived

# Seven queues plus their dead-letter queues. Batch sizes, retries and DLQ
# names are already wired into each wrangler.jsonc; this just has to exist
# for those references to resolve.
for q in triage structure content reconcile adjudicate explain; do
  wrangler queues create "$q-queue"
  wrangler queues create "$q-dlq"
done

# Secrets, per script that needs them (api and sweep need R2 credentials for
# presigning/HEAD-via-binding; every worker needs Supabase + the asset secret;
# only the model-calling workers need OPENROUTER_API_KEY).
for w in api triage structure content reconcile adjudicate explain sweep; do
  wrangler secret put SUPABASE_URL --config "$w/wrangler.jsonc"
  wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config "$w/wrangler.jsonc"
  wrangler secret put ASSET_SIGNING_SECRET --config "$w/wrangler.jsonc"
done
wrangler secret put SUPABASE_ANON_KEY --config api/wrangler.jsonc
for w in api sweep; do
  wrangler secret put R2_ACCESS_KEY_ID --config "$w/wrangler.jsonc"
  wrangler secret put R2_SECRET_ACCESS_KEY --config "$w/wrangler.jsonc"
  wrangler secret put R2_ENDPOINT --config "$w/wrangler.jsonc"
  wrangler secret put R2_BUCKET_ORIGINALS --config "$w/wrangler.jsonc"
  wrangler secret put R2_BUCKET_DERIVED --config "$w/wrangler.jsonc"
done
for w in triage structure content adjudicate explain; do
  wrangler secret put OPENROUTER_API_KEY --config "$w/wrangler.jsonc"
done
# Every worker that mints or verifies a signed asset URL needs to agree on
# where mastery-api is reachable, since that is where /asset/:bucket/:key is
# served from.
for w in triage structure content adjudicate; do
  wrangler secret put MASTERY_ASSET_URL --config "$w/wrangler.jsonc"
done
```

Deploy in the build order CLOUDFLARE_WORKERS.md §13 gives: `api` first (a real
upload and submit, no queues consuming yet), then `triage` → `structure` →
`content` → `reconcile` → `adjudicate` → `explain`, then `sweep`.

```sh
npm run deploy:all
```

## Cutover

**Do not run this alongside the Supabase Edge Function pipeline against the
same database.** Both write to `paper_page.structure_status`,
`question_region.extract_status`, `extraction_run.status` and the same
`r2_deletion` table; running both means two systems racing to process the same
rows. Before pointing traffic at `mastery-api`:

1. Disable the Supabase `queue-tick` cron (`pg_cron` job `mastery-tick` or
   equivalent), so nothing dispatches `w-*` Edge Functions any more.
2. Leave the `w-*` and `queue-tick` Edge Functions deployed but unreachable
   rather than deleting them immediately — they're the rollback path if
   something in the Cloudflare side needs a day to fix.
3. Point the client at `mastery-api`'s URL instead of the Supabase Edge
   Function URLs for `paper-submit`, `upload-intent`, `upload-complete` and
   `review-complete`.

## What this pass did not migrate, and why

Scoped to the queue-driven pipeline `queue-tick` actually dispatched — the
same boundary CLOUDFLARE_WORKERS.md draws. Left on Supabase Edge Functions,
deliberately, not by oversight:

- **`billing-checkout`, `billing-portal`, `stripe-webhook`.** Stripe-specific,
  unrelated to the CPU/wall-clock ceiling this migration exists to fix. No
  reason to move them until there's a reason to.
- **`eval-run`.** Admin tooling, not on the student-facing request path. It
  can keep calling the pipeline via HTTP once `mastery-api` exists; wiring
  that up is follow-on work, not part of this pass.
- **`extract-content`, `extract-structure`, `extract-finalize`, `explain`,
  `patterns`.** Not referenced by `queue-tick`'s dispatch table — an older or
  parallel implementation, superseded by the `w-*` functions this pass
  actually ported. Worth confirming they're genuinely dead before deleting
  them, but nothing here depends on them.
- **`_shared/anthropic.ts`.** Not imported by any `w-*` function — the live
  pipeline calls OpenRouter (`_shared/openrouter.ts`), not the Anthropic SDK
  directly. Dead code in the source tree, not something this port needed to
  carry forward.
- **`_shared/crop.ts`.** Uses `https://deno.land/x/imagescript`, which does
  not run in the Workers runtime. Not ported, and — per the fail-visibly rule
  — flagged rather than silently dropped: nothing in the live `w-structure` /
  `w-content` pipeline currently calls `cropRegion` either (only the
  unreferenced `extract-content` does), so this is an existing gap this
  migration inherits rather than introduces. If cropping needs to happen
  server-side later, it needs a Workers-compatible image library (a WASM
  codec such as `@cf-wasm/photon`) — imagescript is not an option here.
- **`r2-deletion-queue`.** CLOUDFLARE_WORKERS.md §2 lists this as a real
  Cloudflare Queue. It isn't built that way here: `r2_deletion` is a Postgres
  table claimed with `for update skip locked` (0014's `claim_deletions`), and
  nothing in this architecture can push from SQL into a Cloudflare Queue —
  pgmq had a SQL-callable `send`; Cloudflare Queues does not. `mastery-sweep`
  drains it directly on its cron tick instead, keeping the claim-and-retry
  shape whole rather than half-porting it into a queue nothing can feed.
