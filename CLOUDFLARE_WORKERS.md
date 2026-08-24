# CLOUDFLARE_WORKERS.md

Replaces REVIEW_PIPELINE.md §§1–7, 10, 11, 13, 14 in full. §8 (prompts), §9
(reconciliation logic) and §12 (security principles) carry over unchanged —
same rules, different runtime, referenced below rather than repeated.

Supabase stays for exactly two things: **Postgres** (the state machine, RLS,
Auth) and nothing else. Every worker, queue, and byte of orchestration moves to
Cloudflare. R2's bucket layout, lifecycle rules, and schema from STORAGE_R2.md
are unchanged — what changes is *how a Worker reaches R2*, which gets simpler,
covered in §6.

---

## 0. What was actually broken, briefly

Worth naming so it doesn't resurface in a different shape. Supabase Edge
Functions cap CPU at **2 seconds per invocation** and cap background work
(`waitUntil`) at 150–400 seconds of wall clock, after which the isolate is
retired whether the promise resolved or not. "Read this paper" fans out into
dozens of model calls; the first one that pushed past those limits — or any
retry logic built on `waitUntil` rather than a real queue — would fail exactly
the way you saw: silently, on the client, with nothing actionable in the error.

Cloudflare Workers on the Paid plan default to 30 seconds of CPU time per
invocation, configurable up to 5 minutes (15 minutes for a queue consumer), and
**CPU time excludes time spent waiting on network I/O** — so a Worker sitting
on a slow OpenRouter call costs almost nothing against that budget regardless
of how long the call takes. That single difference removes the architectural
strain that was driving the failures.

---

## 1. Architecture

```
                     ┌───────────────────────────┐
   device ──upload──▶│  R2 (binding, no signing) │
                     └─────────────┬─────────────┘
                                   │
                     POST /papers  │  api Worker
                                   ▼
                     ┌───────────────────────────┐
                     │ Supabase Postgres (REST)  │  papers.status = queued
                     └─────────────┬─────────────┘
                                   │
                          TRIAGE_QUEUE.send()
                                   │
     ┌─────────────┬───────────────┼───────────────┬──────────────┐
     ▼             ▼               ▼               ▼              ▼
 triage-consumer structure-consumer content-consumer explain-consumer
     │             │               │               │
     └─────────────┴───────────────┴───────┬───────┘
                                            ▼
                              reconcile()  (Postgres RPC, no model)
                                            │
                              Realtime → client progress

  cron trigger (every 15 min) ──▶ sweep stuck papers, drain r2_deletions
```

Every consumer is a Cloudflare Queue push-based consumer — Cloudflare delivers
batches to the Worker; there is no polling, no `pg_cron` tick, no manual
dispatcher. That entire layer (`queue-tick`, pgmq, the visibility-timeout
dance) is deleted rather than ported. It existed to work around Supabase's
retry model; Cloudflare Queues has retries, backoff, and dead-lettering built
in and configured declaratively.

---

## 2. Cloudflare topology

One account, one shared R2 bucket set (from STORAGE_R2.md), five queues, and a
small number of Worker scripts. Keep the state machine and prompts identical to
REVIEW_PIPELINE.md — only the compute substrate changes.

| Worker | Role |
|---|---|
| `mastery-api` | HTTP entry point: submit, upload, correct, signed asset URLs |
| `mastery-triage` | Consumer: `triage-queue` |
| `mastery-structure` | Consumer: `structure-queue` |
| `mastery-content` | Consumer: `content-queue` |
| `mastery-explain` | Consumer: `explain-queue` |
| `mastery-sweep` | Cron trigger: stuck papers, R2 deletion drain |

Five Worker *scripts*, not five deployments to manage by hand — one repo, one
`wrangler.jsonc` per script, deployed together. A queue consumer can live in the
same script as the producer if you'd rather have fewer deployables; kept
separate here because content and explain scale very differently and you'll
want independent `max_concurrency` tuning once there's real traffic.

### Queues

| Queue | Producer | Consumer | max_batch_size | max_retries | DLQ |
|---|---|---|---|---|---|
| `triage-queue` | api | mastery-triage | 5 | 3 | `triage-dlq` |
| `structure-queue` | mastery-triage | mastery-structure | 20 | 3 | `structure-dlq` |
| `content-queue` | mastery-structure | mastery-content | 30 | 3 | `content-dlq` |
| `explain-queue` | api (post-review) | mastery-explain | 20 | 3 | `explain-dlq` |
| `r2-deletion-queue` | api, sweep | mastery-sweep | 50 | 5 | `deletion-dlq` |

Cloudflare Queues limits worth knowing before they surprise you: 100 messages
max per batch, 128KB max message size, 100 max retries, and — the one that
actually matters here — **15 minutes wall clock per consumer invocation**, with
CPU time configurable up to 5 minutes. A batch of 30 content-extraction calls,
each waiting a few seconds on OpenRouter, fits inside that with room to spare.

---

## 3. `wrangler.jsonc` — representative

One per Worker script; the content-consumer shown, since it's the one doing
the most.

```jsonc
{
  "$schema": "https://developers.cloudflare.com/workers/wrangler/config-schema.json",
  "name": "mastery-content",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"],

  "r2_buckets": [
    { "binding": "ORIGINALS", "bucket_name": "mastery-originals" },
    { "binding": "DERIVED",   "bucket_name": "mastery-derived" }
  ],

  "queues": {
    "producers": [
      { "binding": "EXPLAIN_QUEUE", "queue": "explain-queue" }
    ],
    "consumers": [{
      "queue": "content-queue",
      "max_batch_size": 30,
      "max_batch_timeout": 10,
      "max_retries": 3,
      "max_concurrency": 10,
      "dead_letter_queue": "content-dlq"
    }]
  },

  "limits": { "cpu_ms": 60000 },

  "vars": {
    "MODEL_STAGE": "content"
  }
}
```

Secrets (`wrangler secret put`, never in the file): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `OPENROUTER_API_KEY`,
`ASSET_SIGNING_SECRET`.

`nodejs_compat` is on because `zod` and the Supabase client both expect a few
Node globals. `limits.cpu_ms` at 60s is generous headroom for a 30-message
batch; tighten it once real latencies are measured — it's a cost guard, not a
functional requirement.

---

## 4. Reaching Postgres from a Worker

Workers don't get a raw TCP driver to Postgres without Hyperdrive, and
Hyperdrive is one more thing to provision and pay for. Skip it: **use
Supabase's REST layer (PostgREST) over `fetch`, via `@supabase/supabase-js`**,
which is itself fetch-based and runs fine in the Workers runtime. Every table
and RPC in REVIEW_PIPELINE.md §4 and §9 is already reachable this way — nothing
about the schema, RLS, or the `reconcile_paper` function changes.

```ts
// src/lib/db.ts
import { createClient } from '@supabase/supabase-js'

export function adminDb(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })
}
```

Service-role calls bypass RLS, same as before — these are internal workers,
never reachable from a browser. The one place a Worker needs to respect RLS is
`mastery-api`'s public routes, and there it verifies the caller directly rather
than delegating to Postgres (§5).

Every `admin.rpc(...)` and `admin.from(...).select()` call from the old Edge
Function code carries over verbatim. This is the part of the redesign that
*isn't* a rewrite.

---

## 5. `mastery-api` — auth without a round trip

The old design called Supabase Auth to resolve the caller. A Worker shouldn't
take that subrequest on every call when it doesn't have to: Supabase issues
standard signed JWTs, and the project's JWT secret can verify them locally.

```ts
// src/lib/auth.ts
import { jwtVerify } from 'jose'

export async function verifyCaller(req: Request, env: Env) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { payload } = await jwtVerify(
      auth.slice(7),
      new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
    )
    return payload.sub as string   // auth.users.id
  } catch {
    return null
  }
}
```

Local verification is a CPU-cheap crypto check with no subrequest — worth doing
even though the CPU budget is generous now, because it's also just faster for
the person waiting on the response.

```ts
// src/routes/paper-submit.ts
import { z } from 'zod'
import { verifyCaller } from '../lib/auth'
import { adminDb } from '../lib/db'

const Body = z.object({
  student_id: z.string().uuid(),
  subject: z.string().min(1),
  test_type: z.enum(['unit_test','mid_term','final','pyq','sample','other']),
  date_taken: z.string().date().optional(),
  pages: z.array(z.object({
    idx: z.number().int().min(0),
    r2_key: z.string(),
    mask_key: z.string().optional(),
    bytes: z.number(),
    sha256: z.string(),
    quality: z.object({ blur: z.number(), glare: z.number(), long_edge_px: z.number() })
  })).min(1).max(25),
  idempotency_key: z.string().uuid()
})

export async function paperSubmit(req: Request, env: Env) {
  const userId = await verifyCaller(req, env)
  if (!userId) return json({ error: 'unauthorised' }, 401)

  const parsed = Body.safeParse(await req.json())
  if (!parsed.success) return json({ error: 'invalid', detail: parsed.error.flatten() }, 400)
  const body = parsed.data

  const admin = adminDb(env)

  // Explicit ownership check — service role bypasses RLS, so this replaces it.
  const { data: student } = await admin
    .from('students')
    .select('id, board, class_level, accounts!inner(auth_user_id)')
    .eq('id', body.student_id)
    .eq('accounts.auth_user_id', userId)
    .single()
  if (!student) return json({ error: 'forbidden' }, 403)

  const { data: paper, error } = await admin.rpc('create_paper_idempotent', {
    p_idempotency_key: body.idempotency_key,
    p_student_id: student.id,
    p_board: student.board,
    p_class_level: student.class_level,
    p_subject: body.subject,
    p_test_type: body.test_type,
    p_date_taken: body.date_taken ?? null,
    p_pages: body.pages
  })
  if (error) return json({ error: 'create_failed' }, 500)

  await env.TRIAGE_QUEUE.send({ paper_id: paper.id })

  return json({ paper_id: paper.id, status: 'queued' }, 202)
}
```

This is the one place the service-role bypass of RLS needs a manual stand-in —
**every route on `mastery-api` must do the ownership join explicitly**, exactly
as the RLS policy in REVIEW_PIPELINE.md §4 would have enforced automatically.
Missing this on a new route is the most likely way this design leaks another
student's paper; worth a lint rule or a shared helper (`assertOwnsStudent`)
rather than trusting each route to remember.

---

## 6. R2 — bindings instead of signed S3 requests

STORAGE_R2.md's bucket names, key layout, and lifecycle rules are unchanged.
What disappears is the `aws4fetch` signing module — a Worker that owns the R2
binding doesn't need SigV4 at all for its own reads and writes.

```ts
// inside any worker with the DERIVED binding
const obj = await env.DERIVED.get(page.r2_key)
if (!obj) throw new Error('missing object')
const bytes = await obj.arrayBuffer()

await env.DERIVED.put(cropKey, cropBytes, {
  httpMetadata: { contentType: 'image/webp' }
})
```

No credentials, no signing, no `aws4fetch` dependency. This is strictly less
code than the Supabase version and was the main thing STORAGE_R2.md §4 existed
to work around.

### The one place a real URL is still needed

OpenRouter is an external HTTP service — it cannot use an R2 binding, it needs
a fetchable URL. Two options:

- **Presigned S3 URL** (STORAGE_R2.md §4–6, `aws4fetch`), which still works
  fine from a Worker and is worth keeping if you want the same code path for
  local dev without Cloudflare bindings.
- **A signed Worker route**, native to this stack and simpler to reason about
  since it doesn't involve SigV4 at all:

```ts
// src/routes/asset.ts — GET /asset/:bucket/:key?exp=...&sig=...
import { timingSafeEqual } from '../lib/hmac'

export async function serveAsset(req: Request, env: Env, params: { bucket: string, key: string }) {
  const url = new URL(req.url)
  const exp = Number(url.searchParams.get('exp'))
  const sig = url.searchParams.get('sig') ?? ''
  if (!exp || exp < Date.now() / 1000) return new Response('expired', { status: 403 })

  const expected = await hmac(env.ASSET_SIGNING_SECRET, `${params.bucket}:${params.key}:${exp}`)
  if (!timingSafeEqual(sig, expected)) return new Response('forbidden', { status: 403 })

  const bucket = params.bucket === 'originals' ? env.ORIGINALS : env.DERIVED
  const obj = await bucket.get(params.key)
  if (!obj) return new Response('not found', { status: 404 })

  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream' }
  })
}

export async function signAssetUrl(env: Env, bucket: 'originals'|'derived', key: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const sig = await hmac(env.ASSET_SIGNING_SECRET, `${bucket}:${key}:${exp}`)
  return `https://assets.mastery.app/asset/${bucket}/${key}?exp=${exp}&sig=${sig}`
}
```

Take this over presigned S3 URLs unless there's a concrete reason to keep the
SigV4 path. It's an HMAC over a string — no dependency, no clock-skew tolerance
to configure, and the route is a normal Worker you already control end to end.
The security properties are the same ones set out in STORAGE_R2.md §6: short
TTL, unguessable keys underneath the signature, never log the signed URL
itself.

### Uploads

Because bandwidth through a Worker is no longer the constraint it was on
Supabase — a Worker streams a request body straight into `R2.put()` without
buffering it in memory, and that costs almost no CPU — device uploads can go
**through `mastery-api` directly**, which removes a round trip:

```ts
export async function uploadPage(req: Request, env: Env, params: { paper_draft_id: string, idx: string }) {
  const userId = await verifyCaller(req, env)
  if (!userId) return json({ error: 'unauthorised' }, 401)
  // ownership + draft validation elided — same pattern as §5

  const key = `${studentId}/${params.paper_draft_id}/page/${params.idx}-${crypto.randomUUID()}.webp`
  await env.DERIVED.put(key, req.body, {
    httpMetadata: { contentType: req.headers.get('content-type') ?? 'image/webp' }
  })
  return json({ r2_key: key }, 201)
}
```

Presigned direct-to-R2 uploads (STORAGE_R2.md §5) still work and are a fine
choice if you'd rather keep upload bandwidth off the Worker entirely — that's a
cost and topology preference, not a correctness one, given Workers pricing
doesn't charge for subrequest bandwidth and CPU time on a streamed body is
minimal. Pick one; don't run both paths.

---

## 7. OpenRouter integration

Unchanged in substance from REVIEW_PIPELINE.md §7 — same provider policy
(`zdr: true`, `data_collection: "deny"`, `require_parameters: true`), same
model matrix, same cost math, same `models` fallback array. The only edits are
where the module lives and how it logs.

```ts
// src/lib/openrouter.ts
export async function callModel(env: Env, opts: CallOpts) {
  const route = await getRoute(env, opts.stage)
  const started = Date.now()

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mastery.app',
      'X-Title': 'Mastery'
    },
    body: JSON.stringify({
      model: route.primary_model,
      models: route.fallbacks,
      provider: PROVIDER_POLICY,
      temperature: route.temperature,
      max_tokens: route.max_tokens,
      messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
      response_format: { type: 'json_schema', json_schema: { name: opts.schema.name, strict: true, schema: opts.schema.schema } },
      usage: { include: true }
    }),
    signal: AbortSignal.timeout(90_000)
  })

  if (!res.ok) throw new ModelError(res.status, await res.text())
  const data = await res.json()
  const parsed = opts.schema.parse(JSON.parse(data.choices[0].message.content))

  await logCall(env, {
    stage: opts.stage, paper_id: opts.paper_id, question_id: opts.question_id,
    requested_model: route.primary_model, model_id: data.model,
    prompt_version: route.prompt_version,
    input_tokens: data.usage?.prompt_tokens, output_tokens: data.usage?.completion_tokens,
    cost_usd: data.usage?.cost, latency_ms: Date.now() - started, ok: true
  })
  return parsed
}
```

This `fetch` call is pure I/O wait from the Worker's point of view — it costs
essentially none of the 30-second CPU budget no matter how long OpenRouter
takes to respond, which is the whole reason this migration removes the
timeout anxiety the Supabase version had. The 90-second `AbortSignal` is a
sanity ceiling, not a platform constraint.

Image URLs passed to the model are the signed asset URLs from §6, exactly as
REVIEW_PIPELINE.md §7.3 specified — crops, not full pages, plus the red-ink mask
as a second low-detail image. Nothing about that reasoning changes.

---

## 8. A representative consumer

`mastery-content`, standing in for every `w-*` worker in the old design. The
batch shape is new; the logic inside each item is the same as
REVIEW_PIPELINE.md §6.3.

```ts
// src/index.ts
import { adminDb } from './lib/db'
import { callModel } from './lib/openrouter'
import { signAssetUrl } from './lib/asset'
import { CONTENT_SYSTEM_PROMPT, CONTENT_SCHEMA, buildContentUserMessage } from './prompts/content'

interface ContentMsg { question_id: string }

export default {
  async queue(batch: MessageBatch<ContentMsg>, env: Env) {
    const admin = adminDb(env)

    await Promise.all(batch.messages.map(async (msg) => {
      const { question_id } = msg.body
      try {
        const { data: q } = await admin
          .from('questions')
          .select('*, papers!inner(id, status)')
          .eq('id', question_id).single()

        if (!q || q.extract_status === 'done') {
          msg.ack()   // already handled — batches can redeliver
          return
        }

        const cropUrl = await signAssetUrl(env, 'derived', q.crop_key)
        const maskUrl = q.cropmask_key ? await signAssetUrl(env, 'derived', q.cropmask_key) : null

        const result = await callModel(env, {
          stage: 'content', paper_id: q.papers.id, question_id,
          system: CONTENT_SYSTEM_PROMPT,
          user: buildContentUserMessage({ q, cropUrl, maskUrl }),
          schema: CONTENT_SCHEMA
        })

        await admin.rpc('apply_content_extraction', { p_question_id: question_id, p_payload: result })
        await maybeAdvance(admin, q.papers.id)
        msg.ack()

      } catch (err) {
        if (isRetryable(err)) {
          msg.retry()   // Cloudflare's built-in backoff, not a hand-rolled one
        } else {
          await admin.from('questions').update({
            extract_status: 'failed', confidence: 'unreadable', needs_review: true
          }).eq('id', question_id)
          await maybeAdvance(admin, q!.papers.id)
          msg.ack()   // permanent failure is handled, not retried
        }
      }
    }))
  }
}
```

Two differences from the Edge Function version worth calling out:

- **`msg.ack()` / `msg.retry()` replace the pgmq delete-or-leave dance.** Retry
  backoff, attempt counting, and dead-lettering after `max_retries` are all
  Cloudflare's, configured in `wrangler.jsonc`, not written by hand.
- **`Promise.all` across the batch** rather than one message per invocation.
  With CPU time only metering active compute, thirty concurrent `fetch` calls
  cost barely more CPU than one — the old per-message dispatch existed to work
  around Supabase's per-invocation ceiling, and that ceiling is gone.

`maybeAdvance` is the same idea as `maybe_advance_to_reconcile` from
REVIEW_PIPELINE.md §6.3 — a Postgres RPC, advisory-locked, so concurrent
completions from a `Promise.all` batch don't race each other into a double
transition.

---

## 9. Reconciliation and prompts

No changes. `reconcile_paper` (REVIEW_PIPELINE.md §9) is pure SQL and doesn't
care what called it — it's now invoked as `admin.rpc('reconcile_paper', { p_paper_id })`
from `mastery-structure`'s completion path instead of from an Edge Function,
same transaction, same guarantees. Every prompt in REVIEW_PIPELINE.md §8 —
triage, structure, content, adjudicate, explain — is verbatim unchanged; prompts
are a property of the model call, not the runtime that makes it.

---

## 10. Explanation gating and the review loop

Unchanged in rule: explanations still run only after the student confirms
review, per REVIEW_PIPELINE.md §3. The mechanism is `mastery-api`'s
`question-correct` / `paper-confirm` route pushing to `explain-queue` once every
question in the paper is out of `needs_review`, rather than the paper's own
status transition triggering it — functionally identical, just invoked from a
route instead of `queue-tick`.

---

## 11. Cron — `mastery-sweep`

```jsonc
// wrangler.jsonc for mastery-sweep
{
  "name": "mastery-sweep",
  "triggers": { "crons": ["*/15 * * * *"] },
  "queues": {
    "consumers": [{ "queue": "r2-deletion-queue", "max_batch_size": 50, "max_retries": 5 }]
  }
}
```

```ts
export default {
  async scheduled(_event: ScheduledEvent, env: Env) {
    const admin = adminDb(env)
    await admin.rpc('fail_stuck_papers', { p_older_than_minutes: 60 })
  },
  async queue(batch: MessageBatch<{ bucket: 'originals'|'derived', key: string }>, env: Env) {
    for (const msg of batch.messages) {
      const bucket = msg.body.bucket === 'originals' ? env.ORIGINALS : env.DERIVED
      await bucket.delete(msg.body.key)
      msg.ack()
    }
  }
}
```

One script, two triggers — a cron for the stuck-paper sweep from
REVIEW_PIPELINE.md §11, and a queue consumer draining the deletion backlog from
STORAGE_R2.md §8. `fail_stuck_papers` is the same plpgsql behaviour already
specified: no paper sits in a non-terminal status past an hour without the
student being told.

---

## 12. What's genuinely simpler now, and one thing to watch

**Simpler:** no queue-polling cron, no hand-rolled visibility timeout, no pgmq,
no CPU anxiety around JSON parsing or zod validation, no `aws4fetch` for
internal reads and writes, batch-level concurrency instead of one-invocation-
per-message. That's a real reduction in moving parts, not just a change of
vendor.

**Watch:** Cloudflare Queues is **at-least-once, not exactly-once**, same as
pgmq was — idempotency on every consumer (check terminal status before acting,
same as §8 above) is still required, not optional. And `Promise.all` across a
batch means one question's unhandled exception can, if not caught per-item,
take the whole batch down; the try/catch belongs inside the `map`, per item, as
shown above — not around the `Promise.all` itself.

---

## 13. Build order

Supersedes REVIEW_PIPELINE.md §14, steps 2–9. Step 1 (Postgres schema, RLS,
`create_paper_idempotent`, `reconcile_paper`) is unchanged and still comes
first.

1. **Schema and RLS.** As before — no changes here.
2. **`mastery-api` skeleton** with `jose`-based auth, the ownership-check
   helper, and R2 bindings for both buckets. Deliverable: a real upload and
   submit from a client session, no queues yet.
3. **Queues and DLQs**, created via `wrangler queues create` for each of the
   five in §2, wired into each script's `wrangler.jsonc`.
4. **`mastery-triage`** consumer, `_lib/openrouter.ts`, `_lib/asset.ts`
   (signing). First real model call.
5. **`mastery-structure`** consumer, including cross-page continuation and the
   fan-out into `content-queue`.
6. **`mastery-content`** consumer per §8, with the two failure paths and
   `maybe_advance_to_reconcile`.
7. **Reconciliation invocation** wired into structure's completion path, plus
   the adjudication model call for the failure case.
8. **`mastery-explain`** consumer, gated on review confirmation via
   `mastery-api`.
9. **`mastery-sweep`** — cron and deletion drain, built alongside the queues in
   step 3 rather than deferred, per STORAGE_R2.md §12's original caution about
   deletion paths that are tested once and then forgotten.

Capture, the review UI, and the eval harness are unaffected by this migration
and proceed as already specified.
