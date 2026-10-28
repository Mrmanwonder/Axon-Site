# Axon Security Audit — Live Database Addendum

**Date:** 2026-09-15  
**Applies to:** `SECURITY_AUDIT_2026-09-15.md`  
**Status:** **authoritative correction/addition to the main audit's executive summary and priority order**

This addendum records the findings from the final read-only inspection of the connected production Supabase project's live RLS policies, grants, triggers, function definitions, migration state, and deployed Edge Function inventory. Where this addendum conflicts with the main audit's finding count, severity, production status, or identifier ordering, **this addendum wins**.

No destructive exploitation was performed against production.

## Corrected headline

The completed audit found:

| ID | Severity | Production status at audit time | Finding | Remediation branch |
|---|---|---|---|---|
| `BILLING-001` | **Critical** | **Confirmed live** | Authenticated guardian can author its own subscription/Stripe authority fields and make itself Pro | Fixed + regression test |
| `AUTHZ-001` | **High** | **Confirmed live** | Stale permissive consent INSERT policy bypasses Parent Mode | Fixed + regression test |
| `AUTH-002` | **High** | **Confirmed live** | Background `token_refresh` AMR can renew Parent Mode freshness | Fixed + regression test |
| `AUTH-001` | **High** | Confirmed in audited `main` | Pasted auth link/session is adopted without binding it to the requested email/phone | Fixed in client auth code |
| `DEPLOY-001` | **Medium** | Confirmed deployment gap | Cloudflare Worker omits the CSP present in Netlify config | Fixed |
| `STORAGE-001` | **Medium if deployed** | **Latent in connected project** | Upload byte declaration can be omitted/zeroed to bypass intended file-size limit | Fixed |
| `PIPELINE-001` | **Medium if active** | Schema live; related repository pipeline functions not deployed in connected project | Owner can rewrite extraction queue priority after entitlement snapshot | Fixed + regression test |
| `OPS-001` | **Medium** | Confirmed process risk | Security migrations are manual; merging code does not apply them to production | Release-process remediation required |

The application's core family ownership RLS is generally sound. The serious findings are concentrated in **authority-bearing fields and policy composition**: places where the caller owns a row/session but must not be allowed to author billing state, guardian-presence state, consent authority, or paid queue priority.

---

# BILLING-001 — Authenticated guardian can self-author Pro status

**Severity:** Critical  
**Exploitability:** Confirmed structurally in the live database on 2026-09-15  
**Production status:** **Affected until the new Checkout function and database trigger migration are deployed**  
**Affected boundary:** subscription authorization and Stripe identity

## Confirmed live state

The live database has an owner-scoped guardian UPDATE policy. It correctly restricts a session to its own guardian row, but the `authenticated` role can update the guardian row's billing columns, including:

- `subscription_status`
- `subscription_plan`
- `subscription_renews_at`
- `subscription_grace_until`
- `stripe_customer_id`
- `stripe_subscription_id`

The live guardian trigger inventory contained `guardian_verification_server_authored`. Its function protects verification fields (`verified_at`, `verification_method`, `verification_ref`) but **does not protect billing fields**.

The server-side entitlement helper `private.guardian_is_pro(...)` trusts `guardian.subscription_status`.

Therefore an authenticated modified client can author a paid state on **its own** row and the server-side entitlement logic will treat that forged state as authoritative. This is not merely a front-end paywall/UI bypass.

## Impact

A free authenticated account can grant itself Pro entitlements without a successful Stripe subscription. Client-writable Stripe customer/subscription identifiers are also an unsafe authority boundary because the browser must not decide which external payment identity belongs to its account.

No cross-account UPDATE was established; normal RLS still scopes the attacker to its own guardian row. The severity comes from direct modification of a server-trusted authorization/payment source of truth.

## Remediation implemented

### Database boundary

`supabase/migrations/20260923061207_billing_fields_are_server_authored.sql`

Adds a `BEFORE INSERT OR UPDATE` guardian trigger that rejects subscription/Stripe authority changes when the DB role is `authenticated`. Trusted server/service-role paths remain able to author them.

### Checkout adjustment

`supabase/functions/billing-checkout/index.ts`

Checkout still resolves the guardian through the requester's RLS-scoped client first. Only after that authorization does it use the service-role client for the narrow write of the server-created Stripe customer ID to that exact guardian row. The write uses a null compare-and-set and canonical reread for concurrent Checkout requests.

### Regression suite

`supabase/tests/billing_server_authored.sql`

Required assertions:

- ordinary guardian profile edits still work;
- authenticated client cannot set `subscription_status = 'pro'`;
- authenticated client cannot attach a Stripe customer ID;
- trusted server-side writes can still update billing state.

## Mandatory deployment order

**Deploy the updated `billing-checkout` Edge Function before applying the billing trigger migration.**

The old Checkout implementation writes `stripe_customer_id` using the authenticated caller. If the trigger is applied first, that legitimate old code will correctly start failing. The safe order is:

1. deploy updated `billing-checkout`;
2. verify a controlled/test Checkout can create or reuse its Stripe customer linkage;
3. apply `20260923061207_billing_fields_are_server_authored.sql`;
4. verify a normal authenticated client cannot change subscription or Stripe fields;
5. verify Stripe webhook/service-role writes still update legitimate subscription state.

Do not validate this by altering a real paid customer's production subscription state.

---

# AUTHZ-001 — Stale permissive consent policy bypasses Parent Mode

**Severity:** High  
**Exploitability:** Confirmed in the live database  
**Production status:** **Affected until migration is applied**  
**Affected object:** `public.consent_event` INSERT RLS

Production has two applicable authenticated permissive INSERT policies on `consent_event`:

1. intended `consent_event_insert_own`, which checks current-guardian ownership and `private.has_fresh_auth()`;
2. stale `Guardians can append their own consent events`, which does not require recent Parent Mode authentication.

PostgreSQL ORs applicable permissive policies. The stale policy therefore bypasses the freshness requirement even though the secure policy also exists.

The stale policy additionally contains the historical condition `s.guardian_id = s.guardian_id`, a tautology rather than a current-guardian ownership check. This can create inconsistent ledger rows. The audit did **not** establish that it lets one guardian change another guardian's effective consent, because effective-consent evaluation remains guardian-scoped.

## Impact

A holder of the ordinary persistent guardian session—including the shared-device student threat Parent Mode is designed to distinguish—can append consent changes without the parent recently authenticating.

## Remediation

Migration:

`supabase/migrations/20260923061202_reassert_consent_parent_mode_policy.sql`

It removes the stale policy and reasserts one canonical authenticated INSERT policy requiring:

- `guardian_id = private.current_guardian_id()`;
- any non-null student belongs to that same current guardian;
- `private.has_fresh_auth()`.

Regression:

`supabase/tests/consent_policy_security.sql`

The test intentionally asserts **exactly one** authenticated INSERT policy, because proving that a secure permissive policy exists is insufficient if another permissive policy can OR around it.

---

# AUTH-002 — Automatic token refresh can masquerade as recent guardian authentication

**Severity:** High  
**Exploitability:** Confirmed in the live production function definition  
**Production status:** **Affected until migration is applied**  
**Affected object:** `private.auth_age()`

The live function currently takes the newest timestamp from the JWT `amr` array without filtering by method. Supabase can represent session refresh using `token_refresh`, and the browser client enables automatic token refresh. A refresh proves possession of a refresh token; it does not prove that the guardian is physically present and just completed an authentication ceremony.

## Impact

An older guardian authentication followed by a recent background refresh can look recent to Parent Mode. That undermines freshness-dependent consent, destructive, and billing control-plane operations on a shared device.

## Remediation

`supabase/migrations/20260923061158_parent_mode_requires_interactive_amr.sql`

`private.auth_age()` now uses an explicit allow-list of interactive methods:

- `otp`
- `totp`
- `password`
- `oauth`
- `sso/saml`
- `magiclink`

`token_refresh` and unknown future methods do not acquire guardian authority automatically.

Regression:

`supabase/tests/parent_mode_refresh_regression.sql`

Covers refresh-only, old-OTP-plus-new-refresh, and recent-OTP-plus-new-refresh cases.

**Keep this as an allow-list, not a deny-list.** New authentication methods should fail closed until deliberately classified.

---

# AUTH-001 — Pasted authentication artifact is not bound to login intent

**Severity:** High  
**Status on audited `main`:** Confirmed source defect  
**Production impact depends on deployed frontend revision**

The OTP field accepts a pasted magic/auth link. Before the branch fix, a valid Supabase session/token from that link could be adopted without checking that the resulting account matches the email/phone for which this browser initiated the login flow.

That creates a login-CSRF/session-swapping/account-confusion path: valid authentication material proves the identity authenticated by Supabase, but not that this browser intended to log into that identity.

## Remediation

`src/supabase.js` now:

- accepts pasted auth URLs only from the app origin or configured Supabase project origin;
- verifies pasted auth material in a separate non-persistent Supabase client;
- normalizes and compares the resulting session's email/phone to the login contact requested by the browser;
- installs the session into the main persistent client only after that identity binding succeeds.

Regression should cover same-account pasted link success, unrelated-origin rejection, different-owned-test-account rejection, and confirmation that a rejected link cannot mutate the main session.

---

# DEPLOY-001 — Cloudflare Worker lacked CSP parity

**Severity:** Medium  
**Status:** Fixed on branch

`netlify.toml` had a CSP while the Cloudflare Worker only emitted the other security headers. `src/index.ts` now emits a matching CSP so hosting choice does not silently remove that browser containment layer.

This is defense-in-depth, not a standalone XSS finding. The policy still contains `unsafe-inline` exceptions and should be tightened later after the inline theme/style path is refactored or hash/nonce-based.

---

# STORAGE-001 — Direct-to-R2 size limit was optional

**Severity:** Medium if deployed  
**Connected production status:** **Latent**

The connected Supabase project's deployed Edge Function inventory did **not** include the repository's upload/extraction functions during this audit. Only Stripe-related functions were present. This finding therefore must not be described as an active exploit of that inspected production function deployment.

Before the fix, upload intent only enforced the cap when the caller supplied a truthy byte count, and completion likewise conditionally compared sizes. A modified authenticated client could omit/zero the claim and obtain a presigned PUT not bounded by the intended application check.

Hardened files:

- `supabase/functions/upload-intent/index.ts`
- `supabase/functions/upload-complete/index.ts`

The branch now requires a positive safe integer size within the cap before minting a PUT, validates the actual R2 object with `HEAD`, enforces the real maximum, requires declared/actual size equality, and rejects/deletes oversized objects.

Run storage integration tests against a non-production bucket before these functions are deployed.

---

# PIPELINE-001 — Extraction queue priority is mutable after entitlement snapshot

**Severity:** Medium if the extraction scheduler is active  
**Connected production status:** Schema weakness confirmed; related repository Edge pipeline was not in the connected project's deployed-function inventory

`private.snapshot_run_priority()` correctly assigns free/Pro priority on INSERT, but the owner policy allows UPDATE of the run and there was no UPDATE guard for `priority`. A modified authenticated client can therefore rewrite its own priority after the trusted entitlement snapshot.

Remediation:

`supabase/migrations/20260923061212_extraction_priority_is_server_authored.sql`

Adds a narrow guard rejecting authenticated changes to `priority` while allowing legitimate updates to other run fields.

Regression:

`supabase/tests/extraction_priority_security.sql`

---

# OPS-001 — Merging the PR does not remediate the live database

**Severity:** Medium operational security risk

The repository's migration documentation states that CI performs local reset/tests and **does not apply migrations to production**. Security migrations are manually deployed.

This matters directly here: `BILLING-001`, `AUTHZ-001`, and `AUTH-002` remain present in the connected live database until their migrations are applied and verified. A merged commit alone is not evidence that production is fixed.

Every security release should record the expected migration set and run read-only post-deploy assertions against the live database.

---

# Corrected deployment priority

## P0 / immediate production remediation

1. Deploy the hardened `billing-checkout` function.
2. Apply `20260923061207_billing_fields_are_server_authored.sql`.
3. Apply `20260923061158_parent_mode_requires_interactive_amr.sql`.
4. Apply `20260923061202_reassert_consent_parent_mode_policy.sql`.
5. Deploy the frontend authentication-link binding fix.
6. Deploy the Cloudflare CSP update where Cloudflare serves the app.

`PIPELINE-001` should be applied before enabling/depending on paid queue priority. Hardened upload functions must be the only versions deployed when that storage pipeline is enabled.

## Post-deploy live assertions

After deployment, require all of the following before declaring the audit remediated:

- `private.auth_age()` explicitly filters to approved interactive AMR methods and does not accept `token_refresh` as fresh presence;
- exactly one authenticated INSERT policy exists on `public.consent_event`;
- that consent policy requires current-guardian student ownership and `private.has_fresh_auth()`;
- `guardian_billing_server_authored` exists for guardian INSERT/UPDATE;
- existing `guardian_verification_server_authored` still exists;
- an authenticated test account cannot update subscription or Stripe authority fields;
- legitimate Stripe webhook/service-role state transitions still work;
- `extraction_priority_server_authored` exists if the extraction scheduler is enabled;
- no new anonymous family-data policy or authenticated grant to service-role-only RPCs has appeared.

---

# Important non-findings / controls that held up

The live/code review also established several defenses that should be preserved:

- RLS is enabled on the core guardian/student/paper/page/consent/attempt data model and cross-family ownership policies are generally sound.
- Guardian verification fields are already protected by a server-authored trigger; the billing problem should not be generalized into a claim that all guardian authority fields were writable.
- Sensitive pipeline mutation RPCs reviewed are generally service-role-only.
- Stripe Checkout resolves price IDs server-side and constrains payment return paths to the application origin.
- Stripe webhook processing verifies Stripe events and uses server-side state handling.
- The KaTeX `dangerouslySetInnerHTML` path renders KaTeX output with `trust:false`, strict/error handling, expansion limits, and explicit command restrictions; no direct arbitrary-HTML model-output sink was established there.
- No active production `eval()` / `new Function()` execution sink was identified.
- The Supabase publishable key is intentionally public; no committed service-role/private-key secret value was identified in the reviewed source.
- No active server-side arbitrary-URL fetcher was established, so SSRF is a future-feature hardening requirement rather than a confirmed current exploit.

---

# Handoff to Codex

Codex should treat this addendum and `SECURITY_AUDIT_2026-09-15.md` together as the implementation specification. The addendum is authoritative for final severity and production status.

Acceptance criteria:

1. preserve all database-side authority boundaries; do not replace them with UI checks;
2. run existing build/unit/database suites plus the new security regression suites;
3. verify Checkout's service-role mutation occurs only after the caller's own guardian has been resolved through the RLS-scoped client;
4. do not accept guardian IDs, subscription state, Stripe IDs, queue priority, or guardian-presence claims from the browser as authority;
5. run controlled two-account authentication-link tests without touching unrelated accounts;
6. run the post-deploy live assertions above after the migrations are actually applied;
7. do not mark the production findings fixed merely because the PR is merged.
