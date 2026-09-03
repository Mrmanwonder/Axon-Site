# STORAGE_R2.md

All user documents — uploaded PDFs, captured pages, conditioned pages, crops,
and masks — live in Cloudflare R2, accessed over the S3 API. Supabase Postgres
holds metadata only.

Replaces the Supabase Storage references in REVIEW_PIPELINE.md §4 and §6.

---

## 1. Why R2 rather than Supabase Storage

**Egress.** This pipeline reads its own images constantly: one structure call per
page, one content call per question, adjudication crops, review thumbnails, and
every re-read on retry. A single 20-question paper can be fetched 40+ times
across its life, and the model provider is fetching over the public internet.
R2 charges nothing for egress. On most alternatives that read amplification is a
recurring line item that grows with usage rather than with storage.

**Lifecycle rules.** Retention in SCANNING_SYSTEM.md §17 requires originals to
expire on a schedule while derived crops persist. R2 object lifecycle does this
declaratively, per prefix, with no cron job to get wrong.

**One credential model.** S3-compatible, so `aws4fetch` signs requests in a Deno
Edge Function in a few hundred bytes of code — which matters under a 2-second CPU
budget where the AWS SDK is far too heavy.

The costs to know about: **Class A (write, list) and Class B (read) operations
are billable even though egress is free.** Presign-then-GET per model call is a
Class B op each time. It's cheap, but it's not zero, and the read amplification
above means it scales with question count. Cache signed URLs for the life of a
worker invocation rather than minting one per retry.

---

## 2. Buckets

Two, deliberately.

| Bucket | Contents | Lifecycle |
|---|---|---|
| `axon-originals` | Uploaded PDFs, raw captures | 30 days → delete |
| `axon-derived` | Conditioned pages, crops, masks | Retained with the paper |

Splitting them means the retention policy is a bucket-level rule rather than a
prefix convention that a future migration quietly breaks. Originals are the
sensitive, large, short-lived objects; derived artifacts are small and needed for
the review UI and any re-extraction.

Location hint `apac`. See §10 — this is a performance hint, not a residency
guarantee, and the distinction matters legally.

### Key layout

```
axon-originals/
  {student_id}/{paper_id}/upload/{upload_id}.pdf
  {student_id}/{paper_id}/raw/{page_idx}-{nonce}.heic

axon-derived/
  {student_id}/{paper_id}/page/{page_idx}-{nonce}.webp
  {student_id}/{paper_id}/mask/{page_idx}-{nonce}.png
  {student_id}/{paper_id}/crop/{question_id}.webp
  {student_id}/{paper_id}/cropmask/{question_id}.png
  {student_id}/{paper_id}/thumb/{page_idx}.webp
```

`{nonce}` is 16 random bytes, base64url. Keys are never guessable from a paper
id, because presigned URLs are handed to third parties (§6) and key structure
should not be an enumeration surface if one ever leaks.

`{student_id}` leads so a student's data can be deleted or exported by prefix in
one operation — DPDP erasure and portability both become a prefix walk.

---

## 3. Credentials

One R2 API token per environment, scoped to these two buckets only, **Object Read
& Write**, not account-level. Two secrets in Supabase Function secrets:

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ENDPOINT          = https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com
R2_BUCKET_ORIGINALS  = axon-originals
R2_BUCKET_DERIVED    = axon-derived
```

Region is always `auto` for R2.

The secret never reaches a client. Devices upload with presigned URLs (§5), which
is the whole reason presigning exists.

---

## 4. The client module

```ts
// supabase/functions/_shared/r2.ts
import { AwsClient } from 'npm:aws4fetch@1'

const r2 = new AwsClient({
  accessKeyId:     Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
})

const ENDPOINT = Deno.env.get('R2_ENDPOINT')!

export type Bucket = 'originals' | 'derived'

const bucketName = (b: Bucket) =>
  b === 'originals'
    ? Deno.env.get('R2_BUCKET_ORIGINALS')!
    : Deno.env.get('R2_BUCKET_DERIVED')!

function objectUrl(bucket: Bucket, key: string) {
  return `${ENDPOINT}/${bucketName(bucket)}/${key}`
}

/** Presigned PUT for direct device upload. Bytes never touch an Edge Function. */
export async function presignPut(
  bucket: Bucket,
  key: string,
  contentType: string,
  ttlSeconds = 900,
): Promise<string> {
  const url = new URL(objectUrl(bucket, key))
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds))

  const signed = await r2.sign(
    new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }),
    { aws: { signQuery: true, allHeaders: false } },
  )
  return signed.url
}

/** Presigned GET, handed to the model provider. Keep the TTL tight. */
export async function presignGet(
  bucket: Bucket,
  key: string,
  ttlSeconds = 600,
): Promise<string> {
  const url = new URL(objectUrl(bucket, key))
  url.searchParams.set('X-Amz-Expires', String(ttlSeconds))

  const signed = await r2.sign(
    new Request(url, { method: 'GET' }),
    { aws: { signQuery: true } },
  )
  return signed.url
}

/** Server-side delete. Used by erasure, not by the pipeline. */
export async function deleteObject(bucket: Bucket, key: string) {
  const res = await r2.fetch(objectUrl(bucket, key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(`r2 delete failed ${res.status}`)
  }
}

/** Prefix delete for account erasure. Paginates; call from a background task. */
export async function deletePrefix(bucket: Bucket, prefix: string) {
  let token: string | undefined
  do {
    const list = new URL(`${ENDPOINT}/${bucketName(bucket)}`)
    list.searchParams.set('list-type', '2')
    list.searchParams.set('prefix', prefix)
    list.searchParams.set('max-keys', '1000')
    if (token) list.searchParams.set('continuation-token', token)

    const res = await r2.fetch(list.toString())
    if (!res.ok) throw new Error(`r2 list failed ${res.status}`)
    const xml = await res.text()

    const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1])
    for (const k of keys) await deleteObject(bucket, k)

    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1]
  } while (token)
}
```

`aws4fetch` rather than `@aws-sdk/client-s3` is a considered choice: the SDK is
hundreds of kilobytes, pulls in a large dependency graph, and its initialisation
alone is a meaningful fraction of a 2-second CPU budget. `aws4fetch` is a thin
signer over `fetch` and is what R2's own Workers documentation reaches for.

The XML parsing above is deliberately crude. It is correct for R2's `ListObjectsV2`
response shape and avoids pulling an XML parser into the isolate. If listing ever
grows beyond erasure, revisit it — but don't add a parser for one code path.

---

## 5. Upload — bytes never pass through a function

The 2-second CPU limit forbids proxying uploads through an Edge Function; a
single 800KB body read and re-emit will exceed it. Devices talk to R2 directly.

```
1. Client → POST /upload-intent
     { paper_draft_id, files: [{ kind, content_type, bytes }] }

2. Function validates the session, checks per-account quota, generates keys,
   inserts pending rows, returns presigned PUT URLs (15 min TTL).

3. Client → PUT each URL directly to R2, in parallel, with retry.
   Capture ETag from each response.

4. Client → POST /upload-complete
     { paper_draft_id, uploads: [{ key, etag, bytes, sha256 }] }

5. Function verifies each object exists via HEAD, compares size and ETag,
   marks rows confirmed, then proceeds to paper-submit.
```

Step 5 is not optional. Without a server-side HEAD, a client can register a row
for an object that was never uploaded, and the failure surfaces much later as a
model call against a 404 — which looks like a model problem and isn't.

**Resumability.** For a 16-page booklet on patchy 4G, each page is an independent
PUT. Track per-page state locally so an interrupted upload resumes at the failed
page. This is the storage-layer half of the resume-a-draft behaviour already
specified for the Scan screen; the multipart API is available for individual
objects over ~100MB but no single page will approach that.

---

## 6. Presigned GETs and the third-party question

Model calls pass a presigned GET URL rather than base64 (REVIEW_PIPELINE.md §7.3),
because base64 costs CPU the isolate doesn't have and inflates the payload ~33%.

The consequence is worth naming rather than assuming: **a presigned URL handed to
OpenRouter is a time-limited bearer capability to a minor's exam paper, held by a
third party, and possibly present in that party's request logs.**

Controls:

- **TTL 600 seconds.** Long enough for a slow provider fetch and one retry, short
  enough that a leaked log line expires before it's useful.
- **Unguessable keys**, per §2, so one leaked URL doesn't imply neighbours.
- **Crops, not pages, for the content stage.** A question crop contains
  handwriting and marks; the cover page contains the student's name, roll number,
  and school. Never send the cover page anywhere except triage.
- **Never log the signed URL** in `model_calls`. Log the key.

The alternative — inline base64 — removes the third-party URL but sends the same
bytes to the same party, and costs CPU you don't have. The URL is not obviously
worse. But it is a decision, and it belongs in the data map going to counsel
alongside the teacher-consent question.

---

## 7. PDFs

Uploaded PDFs are stored as-is in `axon-originals/.../upload/{upload_id}.pdf`.
That is the object of record, and nothing overwrites it.

### Rasterisation

A PDF has to become page images before any of the pipeline can touch it. This
cannot happen in an Edge Function — PDF rendering is precisely the CPU-bound work
the 2-second limit exists to prevent.

**Rasterise on device, before upload**, using pdf.js on web or PDFKit on native:

```
1. Client loads the PDF locally.
2. Renders each page to a canvas at ~2400px long edge.
3. Runs the same stage-1 conditioning as a camera capture
   (IMAGE_PIPELINE.md §5) — no tonal operations, WebP q92 4:4:4.
4. Uploads the original PDF *and* the conditioned pages.
```

The device has the PDF in memory already, so this is the cheapest place it will
ever happen. It also means one conditioning implementation serves both capture
and upload paths, which is worth more than the CPU saving.

Render at a scale factor derived from the PDF's own page box, not a fixed zoom —
a scanned PDF whose pages are 200×300pt needs a very different multiplier from a
digital one at A4.

### Guards

- Reject encrypted PDFs with a plain message; don't attempt a password.
- Cap at 25 pages, consistent with the capture limit.
- Reject PDFs with no renderable content.
- A text-layer PDF (a digital question paper, never printed or written on) will
  fail triage as `blank_paper`. That's the right outcome and needs no special
  handling here.

---

## 8. Lifecycle and deletion

### Lifecycle rules

On `axon-originals`:

```json
{
  "rules": [{
    "id": "expire-originals",
    "enabled": true,
    "conditions": { "prefix": "" },
    "deleteObjectsTransition": { "condition": { "type": "Age", "maxAge": 2592000 } }
  }]
}
```

Thirty days. After a paper is reviewed and committed, the full-resolution
originals are no longer needed — crops and conditioned pages carry the review UI
and any re-extraction. Less stored data is less to lose, and this is the rule
that makes that real rather than aspirational.

`axon-derived` has no expiry rule. Its objects die with their paper.

### Deletion is real

Deleting a paper deletes every object under both prefixes, synchronously enough
that the student's "delete" means what it says:

```sql
create or replace function delete_paper(p_paper_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into r2_deletions (bucket, prefix)
  select 'originals', student_id || '/' || id || '/' from papers where id = p_paper_id
  union all
  select 'derived',   student_id || '/' || id || '/' from papers where id = p_paper_id;

  delete from papers where id = p_paper_id;   -- cascades all child rows
end $$;
```

`r2_deletions` is drained by a worker on the same 10-second tick as the pipeline
queues. The row survives a failed delete and retries; a delete that silently
fails and leaves a minor's exam paper in a bucket is a compliance incident, not a
background-job hiccup.

Account erasure is the same thing with a `{student_id}/` prefix.

---

## 9. Schema changes

Replace the Supabase Storage keys throughout:

```sql
alter table pages
  drop column storage_key,
  add column r2_bucket    text not null default 'derived',
  add column r2_key       text not null,
  add column bytes        int,
  add column sha256       text,
  add column etag         text,
  add column preprocess_version text not null default 'v2';

alter table pages
  add column original_key text;      -- in axon-originals, may be expired

alter table questions
  drop column crop_key,
  add column crop_key     text,
  add column cropmask_key text;

create table uploads (
  id           uuid primary key default gen_random_uuid(),
  paper_id     uuid references papers(id) on delete cascade,
  kind         text not null,          -- 'pdf' | 'image'
  r2_key       text not null,
  content_type text not null,
  bytes        int,
  sha256       text,
  etag         text,
  confirmed    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table r2_deletions (
  id         bigserial primary key,
  bucket     text not null,
  prefix     text,
  key        text,
  attempts   int not null default 0,
  created_at timestamptz not null default now()
);
```

`sha256` is computed on device and stored for two reasons: it makes upload
verification meaningful beyond a size check, and it lets the golden-set harness
confirm it is running against exactly the bytes a real device produced.

**RLS still governs everything**, because R2 keys are only reachable through rows
a student can read. The bucket itself is private and has no public access — no
`r2.dev` URL enabled, no custom domain, ever.

---

## 10. Residency, stated honestly

R2 offers two different things that are easy to conflate:

- **Location hints** (`apac`, `enam`, `weur`, `eeur`, `wnam`, `oc`) are a
  best-effort placement optimisation. Not a guarantee.
- **Jurisdictional restrictions** are a real residency guarantee — objects are
  stored and processed within the jurisdiction, and the bucket is reachable only
  via a jurisdiction-specific endpoint. Available for **EU and FedRAMP only.**

There is no India jurisdiction. `apac` is the best available, it is a hint, and
it is not something to describe in a privacy policy as data residency.

So the accurate position is: **student documents are stored on a global provider
with an Asia-Pacific placement hint, and model inference runs wherever OpenRouter
routes it under ZDR constraints.** DPDP does not presently mandate localisation
for this category, but "we keep Indian students' papers in India" is a claim the
architecture does not currently support, and it should not appear in marketing or
policy copy until it does.

Two things follow:

1. Add storage and inference geography to the data map going to counsel,
   alongside the teacher-consent question.
2. If India residency later becomes a requirement — regulatory or competitive —
   the change is a jurisdictional bucket that R2 doesn't yet offer, or a different
   provider entirely. Worth knowing that now rather than after the migration is
   expensive.

---

## 11. CORS

Direct browser PUTs need it. Native (Capacitor) does not, but the web path does
and will be the development surface.

```json
[{
  "AllowedOrigins": ["https://axonstudy.online", "http://localhost:5173"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["content-type", "x-amz-*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

`ExposeHeaders: ["ETag"]` is the line everyone forgets, and without it step 4 of
the upload flow has no ETag to send back.

---

## 12. Build order changes

Slots into the REVIEW_PIPELINE.md §14 sequence:

- **Step 1 (schema)** absorbs §9 above. R2 keys from the start; no Supabase
  Storage anywhere, so there is nothing to migrate later.
- **New step 1.5:** `_shared/r2.ts`, buckets, token, CORS, lifecycle rules.
  Deliverable — a test that presigns a PUT, uploads from a browser, HEADs it
  server-side, presigns a GET, and confirms a third party can fetch it.
- **Step 3 (`paper-submit`)** becomes `upload-intent` → `upload-complete` →
  `paper-submit`.
- **New step 3.5:** the `r2_deletions` drain worker. Build it with the queues in
  step 4, not later — deletion that was retrofitted is deletion that was tested
  once.
