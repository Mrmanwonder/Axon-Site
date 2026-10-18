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

## Email templates (automatically deployed to hosted Supabase)

**Source of truth:** `scripts/build-email-templates.mjs` generates the three
versioned `supabase/templates/*.html` files. The production publisher is
`scripts/deploy-email-templates.mjs`, run by
[.github/workflows/auth-email-deploy.yml](../.github/workflows/auth-email-deploy.yml).

The workflow uses Supabase's **Management API** (GET and PATCH
`/v1/projects/dlgcqieyevoebefhcggi/config/auth`) to publish exactly these
template-content fields and their corresponding subjects:

| Email | Generated file | Management API fields | Subject |
| --- | --- | --- | --- |
| Sign-in / magic link OTP | `magic_link.html` | `mailer_templates_magic_link_content` / `mailer_subjects_magic_link` | `{{ .Token }} is your Axon verification code` |
| Sign-up confirmation | `confirmation.html` | `mailer_templates_confirmation_content` / `mailer_subjects_confirmation` | `{{ .Token }} is your Axon verification code` |
| Password recovery | `recovery.html` | `mailer_templates_recovery_content` / `mailer_subjects_recovery` | `Reset your Axon password` |

### One-time credential requirement

Configure the **`SUPABASE_ACCESS_TOKEN`** secret in GitHub Actions, available to
the `production` environment used by the workflow. This **must** be a Supabase
Management API personal access token or equivalent appropriately scoped token;
**`SUPABASE_DB_URL` and `SUPABASE_SERVICE_ROLE_KEY` cannot authorize it**.
Fine-grained tokens need `auth_config_read`, `auth_config_write`, and the
project administration write permission required by the API. The project ref
is fixed in source and is **not** a secret.

Token setup/permissions: https://supabase.com/docs/reference/api/v1-update-auth-service-config

### Release and rollback

1. Edit `scripts/build-email-templates.mjs`; regenerate with
   `node scripts/build-email-templates.mjs`. Commit the generator **and**
   its generated HTML. `node scripts/build-email-templates.mjs --check`
   verifies parity.
2. Open a pull request. Its `Publish Supabase Auth emails` check validates
   the generator, markup, OTP/recovery placeholders, font declarations,
   and deployment manifest **without any production secrets**.
3. On merge to `main`, changes to the templates, generator, deployment
   script or workflow automatically deploy to production. This job has a
   single concurrency group and uses the `production` GitHub environment.
   Unchanged fields are skipped, unrelated Auth/SMTP settings are untouched,
   and the written values are read back for verification.
4. For an operator preview, open Actions → **Publish Supabase Auth emails** →
   Run workflow on `main` with `dry_run=true` (default). A manual
   `dry_run=false` run publishes the templates even if there is no new commit.
5. Test actual OTP and password-reset messages in Gmail, Outlook, Apple Mail
   and mobile email after the first successful production deployment. Verify
   correct link/code operation when web fonts are unavailable. Roll back by
   reverting the template commit and allowing this same workflow to deploy
   the previous version.

**Fail-closed behavior:** Missing or invalid token, unsynchronized generator
output, missing placeholders, an unexpected API response, or a failed
post-deployment read-back fails the job. The workflow will not silently report
successful publication when nothing was verified. It does not echo remote
Auth config, email bodies, or the token into GitHub logs.

### Typography and auth links

The templates use Google Fonts Onest weights 400/500/600/700 as a progressive
enhancement, with an **inline**
`'Onest','Helvetica Neue',Helvetica,Arial,sans-serif` fallback on text.
Gmail, Outlook and other clients may ignore remote fonts; some supporting
clients make requests to Google Fonts.

The OTP appears in the subject and preheader so compatible clients can
offer their own copy-code action. The recovery URL is
`{{ .SiteURL }}/?token_hash={{ .TokenHash }}&type=recovery`: maintain the
production Site URL and the Auth redirect allow-list.

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
