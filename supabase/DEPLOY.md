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

Merging to `main` applies new migrations through `.github/workflows/migrate.yml`
(secret `SUPABASE_DB_URL`; see `supabase/migrations/README.md`). Pull-request CI
only tests them against a throwaway local stack.

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
supabase functions deploy --project-ref dlgcqieyevoebefhcggi --no-verify-jwt \
  account-lookup
```

`account-lookup` is called by a signed-out browser that holds only the
publishable key, which is not a JWT, so it is deployed with `--no-verify-jwt`.
It answers `new`, `password` or `code` for an email and is rate limited per
caller; apply `20261012090000_account_lookup.sql` first. Optional secret
`ACCOUNT_LOOKUP_SALT` keys the caller hash (it falls back to the service key).

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

## Email templates (Supabase Dashboard, not deployable from the repo)

Source: `node scripts/build-email-templates.mjs` writes `supabase/templates/*.html`.
Paste each into Dashboard → Authentication → Email Templates and set the subject:

| Template | File | Subject |
| --- | --- | --- |
| Magic link (sign-in code) | `magic_link.html` | `{{ .Token }} is your Axon code` |
| Confirm signup | `confirmation.html` | `{{ .Token }} is your Axon code` |
| Reset password | `recovery.html` | `Reset your Axon password` |

The code is in the subject and preheader so Gmail and phone lock screens can offer
their own "Copy code" action; an email cannot copy on click. The reset button points at
`{{ .SiteURL }}/?token_hash=…&type=recovery`, so Authentication → URL Configuration → Site URL
must be the production address and that address must be in the redirect allow-list.

## Slow auth emails

Measured from the project's auth logs (12 Oct 2026): `/recover` took 1.4–2.3 s and `/otp` about 1.9 s
before answering, because Supabase sends over SMTP before it replies. Delivery after that is the
sender's. To cut it, Authentication → SMTP Settings should point at a transactional provider close to
the project's region (for example Resend over port 465 or 587, with SPF, DKIM and DMARC set for
axonstudy.online so mail lands in the inbox, not spam). Sending through an HTTPS API instead (Auth Hook →
Send Email, an Edge Function) would be faster still but is a larger change and the owner's call.
Supabase also refuses a second request for the same address within about a minute, and each new
reset email cancels the one before it, so the app now waits 60 s before offering a resend.

## Account lookup (one hop)

The email step asks `public.account_lookup_public(p_email)` through the REST API
(`/rest/v1/rpc/account_lookup_public`), about 0.2 s, instead of the
`account-lookup` Edge Function (1 to 2 s, 8 s cold). Apply
`supabase/migrations/20261012160000_account_lookup_direct.sql` BEFORE the build
that calls it ships; until it is applied the browser falls back to the Edge
Function, so nothing breaks, it is just slower. Re-run the Supabase advisors
afterwards: expect the intended "anon can execute a SECURITY DEFINER function"
notice for this one function.
