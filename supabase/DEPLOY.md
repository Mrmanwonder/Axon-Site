# Supabase deployment

Supabase is **not** Axon's paper-processing or model runtime.

The production scanner/review pipeline, Gemini calls, R2 access, Cloudflare
Queues, and Tavily live-web grounding live in the separate
`Mrmanwonder/axon-backend` repository and are deployed with Wrangler.

This repository owns the Supabase database/migrations and the billing Edge
Functions that still run on Supabase.

## 1. Apply database migrations

Before deploying code that reads a new schema, confirm the live project has the
required migrations:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

CI creates a local Supabase stack and tests migrations, but CI does **not** apply
migrations to production.

## 2. Billing secrets

Set billing secrets on the Supabase project:

```bash
supabase secrets set --project-ref dlgcqieyevoebefhcggi \
  AXON_SITE_URL=https://axonstudy.online \
  STRIPE_SECRET_KEY=sk_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_ANNUAL=price_... \
  STRIPE_WEBHOOK_SECRET=whsec_...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are supplied by Supabase.

`MASTERY_APP_ORIGIN` is retained only as a billing return-origin override for
older environments. New environments should use `AXON_SITE_URL`.

## 3. Deploy the Supabase functions that exist here

```bash
supabase functions deploy --project-ref dlgcqieyevoebefhcggi \
  billing-checkout billing-portal stripe-webhook
```

Do **not** deploy scanner/pipeline workers from this repository. Names such as
`w-triage`, `w-structure`, `w-content`, `w-adjudicate`, `w-explain`,
`queue-tick`, `paper-submit`, `upload-intent`, `upload-complete`, and
`review-complete` belong to the retired Supabase implementation and are not a
production deployment path.

## 4. Cloudflare model/runtime secrets

These do **not** belong in Supabase:

- `GOOGLE_API_KEY`
- `TAVILY_API_KEY`
- R2 credentials/bindings used by the paper pipeline
- Cloudflare Queue bindings

Configure them in `axon-backend` on the relevant Workers. Tavily is currently
used by `mastery-explain`; its outbound search query is constructed by server
code from public academic context, not from student answers.

## 5. Stripe verification

After deployment:

1. Complete a sandbox checkout.
2. Confirm the webhook is accepted.
3. Confirm the guardian subscription state changes in Supabase.
4. Open the billing portal and verify return URLs use
   `https://axonstudy.online`.
5. Confirm an invalid or stale Parent Mode session cannot open checkout or the
   billing portal.

The Stripe webhook is the only service-role function in this repository that
updates entitlement state; it must fail loudly on database or signature errors.
