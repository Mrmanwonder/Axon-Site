# Standing the backend up

Everything below is a one-time step per environment. The order matters: the
functions read secrets at cold start, and the tick has nowhere to call until
they exist.

The schema is already applied to `dlgcqieyevoebefhcggi`, and both buckets exist.
Applied is not the same as complete: on 2026-09-02 the entitlements/billing
migration turned out never to have reached that project, and `billing-checkout`
had been answering "No guardian account for this session." to a guardian whose
account was fine. Before trusting a deploy, diff what is actually applied:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```
The functions are not deployed, and cannot usefully be until step 1 is done —
every one of them would cold-start and immediately throw on a missing
environment variable.

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
  R2_BUCKET_ORIGINALS=axon-originals \
  R2_BUCKET_DERIVED=axon-derived \
  AXON_SITE_URL=https://<the deployed site>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform; do not set them by hand.

`OPENCODE_API_KEY` is not in this list on purpose. opencode is the build agent
from `REVIEW_PIPELINE.md` §14 — it runs on a developer's machine and writes this
repository. Nothing the pipeline deploys reads it, and nothing should: a key that
buys model calls has no reason to be inside a function that serves a student.
Keep it in the developer's local `.env`.

The R2 token is **one per environment, Object Read & Write, scoped to those two
buckets** — not an account-level token. Create it under R2 → Manage API Tokens.

On the OpenRouter account itself, two settings that are not code:

- **Prompt logging off.** The discount is small and the data is a minor's exam
  paper.
- **A spend cap.** A loop in a worker is a bill, and the queue will retry.

### Billing secrets

Absent from the list above until 2026-09-02, which is how they came to be
unset while `billing-checkout` was live and failing. The functions read them at
cold start:

```bash
# STRIPE_SECRET_KEY is the SANDBOX account's secret key, from the Dashboard.
supabase secrets set --project-ref dlgcqieyevoebefhcggi \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_PRICE_MONTHLY=price_1U6hpiB8mNE63ebCXIUcPBXn \
  STRIPE_PRICE_ANNUAL=price_1UBIGWB8mNE63ebCIJTTm3ID
```

The origin Stripe returns the payer to is **`AXON_SITE_URL`** — the same secret
§1 already asks for, and the one `_shared/openrouter.ts` already reads. Billing
used to demand `MASTERY_APP_ORIGIN` instead, a name from the old "mastery"
branding that nothing in this repo ever set, which is precisely how it stayed
unset while every other function worked. `MASTERY_APP_ORIGIN` still wins where
it is set, as a billing-only override:

```bash
# Only if billing must return to a different origin than the rest of the app.
supabase secrets set --project-ref dlgcqieyevoebefhcggi \
  MASTERY_APP_ORIGIN=https://axon-site.tanmay-harkawat.workers.dev
```

Whichever is used, check the value: `wrangler.jsonc` carries
`AXON_SITE_URL: https://axon.app`, which does **not** resolve. If the secret
holds that value, Checkout will complete and then return the payer to a dead
domain — the subscription is created either way, but they land nowhere. The live
deploy is `https://axon-site.tanmay-harkawat.workers.dev`.

Those are the real values for the **sandbox** Stripe account
(`acct_1U6hlUB8mNE63ebC`) as of 2026-09-02: product `Pro`
(`prod_V6vhx65z4LuhEa`), $5/month and $40/year, both `tax_behavior: inclusive`.
Only `STRIPE_SECRET_KEY` has to be filled in by hand — Stripe has no API that
can hand a key out, so it comes from the Dashboard.

`STRIPE_WEBHOOK_SECRET` is already set: `stripe-setup` registered the endpoint
at `https://dlgcqieyevoebefhcggi.supabase.co/functions/v1/stripe-webhook`
(`we_1U6huTB8mNE63ebCdVRfkaNw`, managed by stripe-sync) and it already listens
to `checkout.session.completed`, all four `customer.subscription.*` events and
`invoice.payment_failed`. Stripe returns an endpoint's signing secret only when
it is created, so if it ever needs re-setting, create a new endpoint rather than
hunting for the old secret.

A price id belongs to the account its secret key belongs to — test-mode keys
with live-mode price ids fail at Checkout, and the two accounts share nothing.

**Live mode is not ready.** The live account (`acct_1U6hkCPiqaubF9ju`) has no
products and no prices at all, so live-mode Checkout cannot succeed whatever is
configured here. Mirror the sandbox product and both prices before cutting over.

## 2 · Buckets

`axon-originals` and `axon-derived`, both in APAC, both empty. One thing is
still owed:

- **A lifecycle rule on `axon-originals`: 30 days, then delete.** Nothing else
  enforces the retention promise, and a promise nothing enforces is a promise
  that quietly stops being true. `axon-derived` gets no rule, because its
  objects die with their paper.

Neither bucket may ever have a `r2.dev` URL or a custom domain enabled. Access is
presigned URLs only.

## 3 · Deploy the functions

```bash
supabase functions deploy --project-ref dlgcqieyevoebefhcggi \
  paper-submit upload-intent upload-complete review-complete \
  queue-tick w-triage w-structure w-content w-reconcile \
  w-adjudicate w-explain w-r2-delete eval-run \
  billing-checkout billing-portal stripe-webhook
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
select jobname, schedule, active from cron.job where jobname = 'axon-tick';
```

To stop the pipeline without undeploying anything: `select cron.unschedule('axon-tick');`

## 5 · Models

**Right now: the free routes, for testing.** That is a deliberate decision and
this section is what it costs.

`model_route` is seeded with OpenRouter's free models. A free endpoint is
usually free *because* the provider keeps what you send it, so
`PROVIDER_POLICY` — zero data retention, provider data collection denied — will
in most cases leave no eligible provider and the call will fail with
`no_compliant_provider`. That is the client working correctly, not a bug to
route around.

To let the free routes actually run, set the per-stage escape hatch. It is a
column rather than an environment variable precisely so that turning it on is a
row someone can see, and so it can be turned off again in one statement:

```sql
-- Development only. Everything sent through these stages may be retained and
-- trained on by whichever provider serves it.
update public.model_route
   set allow_training = true,
       notes = notes || ' — TESTING: training permitted, revert before real papers'
 where stage in ('triage','structure','content','adjudicate','explain');
```

> **This is currently set on `dlgcqieyevoebefhcggi`.** All five stages carry
> `allow_training = true` and the marker in `notes`. That project is a testing
> environment for as long as that is true. Check before assuming otherwise:
>
> ```sql
> select stage, primary_model, allow_training from public.model_route order by stage;
> ```

**Two conditions on running it, and they are not decoration.** The pages that go
through a training-permitted route become that provider's data. So:

- **Test with papers that are not a child's.** Your own handwriting on a mock
  paper is a perfectly good test of the pipeline. A real student's script, with
  their name and school on the cover, is not something to spend on a smoke test.
- **Revert before the first real paper**, and pick models with compliant
  endpoints at the same time:
  ```sql
  update public.model_route
     set allow_training = false,
         notes = replace(notes, ' — TESTING: training permitted, revert before real papers', '');
  update public.model_route
     set primary_model = 'anthropic/claude-sonnet-5',
         fallbacks = array['google/gemini-3.7-flash']
   where stage = 'content';
  ```

`eval-run` strips `allow_training` from any route override it is given, so an
eval can never borrow the relaxation even while the column is set.

What is not available, in any environment: relaxing `PROVIDER_POLICY` globally.
It is a constant in `_shared/openrouter.ts`, not configuration, and there is no
environment variable that changes it.

## 6 · Passkeys

Off by default — see `supabase/config.toml`. Before switching Authentication →
Passkeys on for `dlgcqieyevoebefhcggi` (or setting `rp_id` to anything but
`localhost`):

1. Confirm the production Netlify domain is final. `rp_id` is bound into
   every passkey a parent registers; changing it later invalidates all of
   them, with no migration.
2. Set `rp_display_name = "Axon"`, `rp_id` to the bare domain (no scheme,
   no port, no path), and `rp_origins` to every origin the app is actually
   served from, in the Dashboard's Passkey settings.
3. Only then flip `enabled = true`.

## 7 · OTP email template

The email `signInWithOtp` sends is a Dashboard setting (Authentication →
Email Templates → Magic Link), not something this repo can check in. Two
things to set there, both purely about iOS's autofill heuristic — nothing
tricky, just formatting that helps it find the code:

- **Subject line contains the word "code" and the app name**, e.g.
  `Your Axon sign-in code: {{ .Token }}`.
- **The code sits alone on its own line in the body**, not folded into a
  sentence — `{{ .Token }}` on its own line, with the word "code" nearby.

The template must contain `{{ .Token }}` (not only `{{ .ConfirmationURL }}`)
or `signInWithOtp` sends a link instead of a code — `src/supabase.js` already
depends on this for the paste-the-link fallback. Keep the email otherwise
bare: no marketing content, it is a trust-sensitive transactional message.

## 8 · Check it

```sql
select stage, primary_model, prompt_version, enabled from public.model_route;
select queue_name from pgmq.list_queues();
select * from public.paper_progress order by started_at desc limit 5;
select stage, ok, error_code, model_id, cost_usd, latency_ms
  from public.model_call order by created_at desc limit 20;
```

`model_call` is where a misconfiguration shows up first: a run that goes nowhere
with `no_compliant_provider` rows is step 5, and one with `auth` rows is step 1.
