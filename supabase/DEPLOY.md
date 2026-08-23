# Standing the backend up

Everything below is a one-time step per environment. The order matters: the
functions read secrets at cold start, and the tick has nowhere to call until
they exist.

The schema is already applied to `dlgcqieyevoebefhcggi`. The functions are not
deployed, and cannot usefully be until steps 1 and 2 are done — every one of them
would cold-start and immediately throw on a missing environment variable.

## 1 · Secrets

**These go in Supabase Function secrets, not in Netlify.** Netlify serves
`dist/` — `index.html`, `src/` and `vendor/`, and nothing else. It runs no
functions and has no build step that could read an environment variable, so a
key set there would either do nothing or, if something later inlined it into the
client bundle, be published to every visitor. The consumers of every secret
below are Edge Functions.

```bash
supabase secrets set --project-ref dlgcqieyevoebefhcggi \
  OPENROUTER_API_KEY=sk-or-... \
  R2_ACCOUNT_ID=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_ENDPOINT=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com \
  R2_BUCKET_ORIGINALS=mastery-originals \
  R2_BUCKET_DERIVED=mastery-derived \
  MASTERY_SITE_URL=https://<the deployed site>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform; do not set them by hand.

The R2 token is **one per environment, Object Read & Write, scoped to those two
buckets** — not an account-level token. Create it under R2 → Manage API Tokens.

On the OpenRouter account itself, two settings that are not code:

- **Prompt logging off.** The discount is small and the data is a minor's exam
  paper.
- **A spend cap.** A loop in a worker is a bill, and the queue will retry.

## 2 · Buckets

Both exist and are empty. Two things are still owed:

- **They are in `ENAM`, not `apac`.** The location hint is creation-time only, so
  the fix is to delete and recreate them from the dashboard with the APAC hint
  while they are still empty. Per `STORAGE_R2.md` §10 this is a latency
  question, not a residency guarantee — but it is free to fix now and impossible
  to fix later.
- **A lifecycle rule on `mastery-originals`: 30 days, then delete.** Nothing else
  enforces the retention promise; `mastery-derived` gets no rule, because its
  objects die with their paper.

Neither bucket may ever have a `r2.dev` URL or a custom domain enabled. Access is
presigned URLs only.

## 3 · Deploy the functions

```bash
supabase functions deploy --project-ref dlgcqieyevoebefhcggi \
  paper-submit upload-intent upload-complete review-complete \
  queue-tick w-triage w-structure w-content w-reconcile \
  w-adjudicate w-explain w-r2-delete eval-run
```

`queue-tick`, the six `w-*` workers and `eval-run` authenticate on the service
key themselves (`isServiceCall`) and reject anything else, so `--no-verify-jwt`
is neither needed nor wanted.

## 4 · Start the tick

The cron entry needs the service key, which is why it is not in a migration.
Run this once, from a session that already holds the key:

```sql
select private.schedule_pipeline_tick(
  'https://dlgcqieyevoebefhcggi.supabase.co/functions/v1',
  '<service role key>');
```

Check it took:

```sql
select jobname, schedule, active from cron.job where jobname = 'mastery-tick';
```

To stop the pipeline without undeploying anything: `select cron.unschedule('mastery-tick');`

## 5 · Choose the models

`model_route` is seeded with OpenRouter's free models so the pipeline can be
exercised before a paid key exists. **Read this before pointing a real student's
paper at it.**

A free endpoint is usually free because the provider keeps what you send it.
`PROVIDER_POLICY` asks OpenRouter for zero-data-retention endpoints with
provider data collection denied, and if no provider for a model satisfies that,
the call fails with `no_compliant_provider` rather than quietly routing to one
that does not. That is the correct behaviour and it is likely what the free
routes will do.

There are two honest ways forward, and one that is not available:

1. **Point the routes at paid models with compliant endpoints.** This is the
   answer for anything with a real student's paper in it.
   ```sql
   update public.model_route set primary_model = 'anthropic/claude-sonnet-5',
          fallbacks = array['google/gemini-3.7-flash'] where stage = 'content';
   ```
2. **Set `allow_training` on a specific stage, deliberately**, for development
   against papers that are not a child's. Nothing in the codebase writes that
   column; a human sets it having read what it means, and `eval-run` strips it
   from any override rather than letting an eval borrow it.

What is not available: relaxing `PROVIDER_POLICY` globally. It is a constant,
not configuration, and there is no environment variable that changes it.

## 6 · Check it

```sql
select stage, primary_model, prompt_version, enabled from public.model_route;
select queue_name from pgmq.list_queues();
select * from public.paper_progress order by started_at desc limit 5;
select stage, ok, error_code, model_id, cost_usd, latency_ms
  from public.model_call order by created_at desc limit 20;
```

`model_call` is where a misconfiguration shows up first: a run that goes nowhere
with `no_compliant_provider` rows is step 5, and one with `auth` rows is step 1.
