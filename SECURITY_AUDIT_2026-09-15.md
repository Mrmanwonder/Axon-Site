# Axon Security Audit & Remediation Specification

**Repository:** `Mrmanwonder/Axon-Site`  
**Baseline audited:** `9d04903313c62839334ec8ff5b283721507c7ce5` (`main`)  
**Audit branch:** `security/audit-2026-09-15`  
**Audit date:** 2026-09-15  
**Purpose:** defensive application-security review and remediation plan for Axon.

---

## 1. Executive summary

This review found **two high-priority authentication/authorization defects that are exploitable through normal application capabilities**, one **medium-priority resource-abuse defect in direct-to-R2 uploads**, and one **deployment hardening gap** that weakened exploit containment on the Cloudflare hosting path. Those four issues are patched on this branch.

The review also identified two important pieces of unfinished security architecture that should not be confused with the patched defects:

1. **Data export is Parent-Mode-gated only in the UI.** The data itself is read through ordinary RLS-scoped queries, so a user who already possesses the guardian session can bypass the Settings button and perform the same reads directly. This is a product trust-boundary gap, not a cross-account data leak; RLS still limits the caller to its own account.
2. **Real guardian identity/adulthood/relationship verification is not currently implemented in the onboarding flow.** The database has correctly removed the old forgeable/stub verification route and requires a service-authored assertion before it will mark a guardian verified, but onboarding presently proceeds without obtaining one. That is an identity-assurance/compliance gap, not a way to read another user's records.

The codebase also contains several strong controls that materially reduce risk: ownership is predominantly enforced through RLS rather than client checks; destructive Parent Mode actions are checked in PostgreSQL; Stripe price selection and webhook authenticity are server-side; service-role credentials stay in server secrets; the production KaTeX HTML sink is hardened; local student data is cleared on sign-out; and CI executes both Node and database security tests.

### Overall disposition

| ID | Finding | Severity | Exploitable on baseline? | Branch status |
|---|---|---:|---|---|
| AUTH-001 | Pasted magic-link/session token can swap browser into a different account | **High** | Yes, with a valid link/token for another account and user interaction | **Patched** |
| AUTH-002 | `token_refresh` AMR can incorrectly reopen Parent Mode | **High** | Yes where refreshed JWT contains a newer `token_refresh` AMR entry | **Patched** |
| UPLOAD-001 | Upload size limit can be bypassed by omitting/lying about `bytes` | **Medium** | Yes for an authenticated owner; storage/cost/resource abuse | **Patched** |
| DEPLOY-001 | Cloudflare Worker omitted the CSP present in Netlify config | **Medium / defense-in-depth** | Increases impact of a future injection bug; not an injection by itself | **Patched** |
| AUTHZ-001 | Data export has UI-only Parent Mode gate | **Medium** | Yes by the already-authenticated guardian-session holder | **Open** |
| IDV-001 | Guardian verification has no live provider flow | **High product-trust / compliance** | Not a cross-account exploit; identity claim is simply not established | **Open** |
| SSRF-001 | Future server-side fetching of stored paper links would need SSRF controls | **Latent High** | **No fetcher found in this repo today** | **Design requirement** |
| SCA-001 | CI has no explicit dependency-vulnerability/secret scanning gate | **Low / hardening** | No specific vulnerable dependency established by this audit | **Open** |

No evidence was found of a committed service-role key, Stripe secret, R2 secret, private key, or similar server credential. The committed Supabase publishable key is intentionally public and is not treated as a secret.

---

## 2. Scope and methodology

The review covered the application's trust boundaries rather than only grepping for dangerous strings. The following areas were inspected:

- Supabase authentication, OTP, OAuth return handling, session persistence and token installation.
- Parent Mode and recent-authentication semantics in client code, Edge Functions and PostgreSQL.
- RLS ownership assumptions and security-definer functions.
- Consent, account deletion, student/profile deletion and billing authority.
- Stripe Checkout, Customer Portal and webhook boundaries.
- R2 presigned PUT/GET flows, object-key scoping, upload confirmation and object size controls.
- Paper ingestion, including the stored-link path and possible SSRF boundary.
- Rendering sinks (`dangerouslySetInnerHTML`, raw HTML, dynamic code execution).
- CSP, HSTS, framing, referrer and permissions headers across deployment targets.
- Client-side caches and shared-family-device data residue.
- Service-role use and repository secret exposure.
- CI security regression coverage and dependency/supply-chain posture.

The audit intentionally distinguishes:

- **Confirmed vulnerability:** a concrete security property can be violated on the baseline.
- **Hardening gap:** a control that reduces exploitability/impact is missing, but no direct exploit exists by itself.
- **Latent vulnerability:** dangerous behavior would exist if a planned/incomplete component were enabled as currently designed.
- **Known architectural gap:** the repository itself acknowledges a boundary that is not yet enforceable server-side.

Safe verification steps below assume **local Supabase or a dedicated staging project with test accounts only**. Do not use another person's account, token, files or production data to reproduce findings.

---

## 3. Attack-surface map

### 3.1 Browser / React application

The browser holds the guardian's Supabase session. This is intentionally a shared-device product where the student uses the guardian-owned authenticated session. Therefore, possession of the session is **not sufficient evidence that the parent is physically present** for control-plane actions. That is why Parent Mode exists.

Sensitive browser-side surfaces include:

- `src/supabase.js` — session creation, OTP and OAuth.
- `src/lib/auth/parentMode.ts` — parent re-authentication UX.
- `src/ui/pages/Settings.tsx` — consent, billing, export and destructive controls.
- `src/account.js` — export and account erasure.
- `src/cache.js` and scan IndexedDB — offline student data.
- `src/ui/components/AnswerBlock.tsx` — model-generated LaTeX rendered to HTML.

### 3.2 Supabase / PostgreSQL

The database is the principal authorization boundary. RLS and security-definer functions enforce ownership and, for several destructive actions, Parent Mode freshness.

Critical surfaces include:

- `private.current_guardian_id()` and ownership policies.
- `private.auth_age()` / `private.has_fresh_auth()`.
- consent-event INSERT policy.
- destructive DELETE policies.
- `public.delete_my_account()`.
- verification assertion tables/RPCs.

### 3.3 Edge Functions / privileged services

Edge Functions hold service credentials only where required. Important classes:

- Billing Checkout/Portal and Stripe webhook.
- R2 upload intent/completion and signed asset URLs.
- queue dispatcher / model pipeline workers.
- guardian-verification provider callbacks when implemented.

### 3.4 Cloudflare R2

R2 uses private buckets plus short-lived presigned capabilities. The browser uploads directly to R2, so **the object bytes never cross a trusted application server before storage**. Any size/content rule therefore needs a post-upload authoritative check, not only a client declaration.

### 3.5 Third-party systems

- Supabase Auth / PostgREST.
- Stripe.
- R2 / Cloudflare.
- model providers.
- future guardian verification provider.

Secrets for these providers must remain server-side. No committed secret was identified in the reviewed repository.

---

# 4. Confirmed findings and fixes

## AUTH-001 — Pasted authentication link can cause account/session swapping

**Severity:** High  
**Status:** Patched on `security/audit-2026-09-15`  
**Affected baseline file:** `src/supabase.js`  
**Affected functions:** `tokenFromPastedLink()`, `verifyOtp()`

### Security property

A login attempt that begins for contact **B** must only complete as the Supabase identity that owns contact **B**. A valid authentication artifact for account **A** must not be installable merely because the user pasted it into B's code field.

### Baseline behavior

The OTP field deliberately accepted a complete magic link as a usability fallback. On the baseline:

1. Any syntactically valid `http:`/`https:` URL was parsed.
2. If its fragment contained `access_token` + `refresh_token`, `verifyOtp()` called `sb.auth.setSession()` directly.
3. If it contained a token/hash, the token was exchanged and the resulting session was accepted.
4. The resulting user was **not compared with the email/phone that the browser had requested a code for**.
5. Onboarding then trusted the installed session and upserted/continued the guardian associated with it.

A Supabase token proves which account Supabase authenticated. It does not prove that the current browser intended to authenticate as that account. The missing transaction binding creates a login-CSRF/account-confusion class of defect.

### Preconditions

- The attacker has a valid, unexpired authentication link/session artifact for an account they control.
- The victim is induced to paste that artifact into Axon's OTP field or otherwise supplies it through the paste-link fallback.
- No exploitation of Supabase itself is required.

### Impact

The browser can be switched into the wrong Axon account while the surrounding UI still reflects a sign-in attempt for a different contact. During onboarding, data entered under that mistaken context can be attached to the wrong account. On a shared device, session/account confusion also risks retaining or mixing local state until cleanup occurs.

This is not a way to steal an arbitrary victim's session: the supplied artifact authenticates whichever account legitimately owns the artifact. The security failure is that Axon accepted an **unbound login transaction**.

### Safe staging reproduction

Use two test accounts, A and B, in a local/staging Supabase project.

1. Start Axon sign-in for B.
2. Obtain a valid magic-link/session URL for A.
3. On the baseline only, paste A's link into B's OTP field.
4. Observe that the resulting Supabase session is A rather than the requested B identity.
5. Repeat on this branch. The attempt must be rejected before the candidate session is installed in the persistent application client.

Do not use production accounts or third-party tokens for this test.

### Remediation implemented

`src/supabase.js` now:

- accepts pasted URLs only from the current app origin or the configured Supabase project origin;
- exchanges/inspects pasted authentication artifacts in a **non-persistent isolated Supabase client**;
- compares the resulting user's normalized email/phone to the contact for which this browser started the login;
- installs the session into the real application client only after the identity binding passes;
- rejects mismatched links with a user-actionable message.

### Required regression tests

Automate at least:

- matching email + pasted session => accepted;
- different email => rejected and persistent client unchanged;
- matching normalized phone => accepted;
- different phone => rejected;
- arbitrary third-party URL carrying token-shaped fragment => ignored/rejected;
- configured Supabase-origin magic link => accepted only when returned session matches contact.

**Follow-up:** extract the pure normalization/origin/contact-binding logic into a small testable module if browser globals make direct Node testing awkward.

---

## AUTH-002 — Background token refresh can satisfy Parent Mode freshness

**Severity:** High  
**Status:** Patched with migration + SQL regression suite  
**Affected baseline:** `supabase/migrations/20260909140000_parent_mode_authority_boundary.sql`  
**Affected function:** `private.auth_age()`

### Security property

Parent Mode is explicitly a **proof-of-presence** boundary. The app's normal bearer session may remain on a student's shared device, but sensitive parent actions should require a recent interactive authentication event.

### Baseline behavior

`private.auth_age()` selected the maximum timestamp from every entry in the signed JWT `amr` array, without checking the authentication method.

Supabase documents `token_refresh` as an authentication-method value. Refreshing a token proves possession of the session's refresh token and obtains a new access token; it is not a new ceremony performed by the guardian. If a JWT carries a recent `token_refresh` AMR entry, the old implementation could treat that timestamp as the newest authentication and make `private.has_fresh_auth()` true.

Because `private.has_fresh_auth()` is used as the database-side Parent Mode boundary, this is not merely a UI-timer bug. It can affect controls such as consent changes and destructive actions that deliberately depend on recent guardian presence.

### Preconditions

- The guardian session remains on the shared device.
- The actual interactive authentication is older than the Parent Mode window.
- Supabase refreshes the session and emits a newer `token_refresh` AMR event in the access token.

### Impact

A background/session-maintenance event can be mistaken for current parent presence, undermining the core shared-device privilege boundary. Actions intended to require a parent can become available to the existing session without the parent entering a fresh code.

### Safe staging reproduction

No real account action is needed. The SQL regression suite constructs signed-claim context locally:

- old `otp` + recent `token_refresh` => Parent Mode must remain stale;
- recent `token_refresh` only => Parent Mode must fail closed;
- recent `otp` + newer `token_refresh` => Parent Mode remains fresh based on OTP age, not refresh age.

### Remediation implemented

Migration:

`supabase/migrations/20260915111500_parent_mode_requires_interactive_amr.sql`

redefines `private.auth_age()` to use an **allow-list of interactive authentication methods** rather than trusting every AMR method. Background `token_refresh` and unknown methods are ignored; unknown future methods fail closed until intentionally classified.

Regression suite:

`supabase/tests/parent_mode_refresh_regression.sql`

proves the three cases above.

### Deployment requirement

**Merging the migration does not apply it to the live Supabase project.** The repository's CI explicitly documents that migrations are currently applied manually. Apply the migration to the intended project before depending on the code change, then verify `private.auth_age()` in the deployed database.

### Future-proofing rule

Whenever Supabase introduces or Axon begins using another AMR method, classify it deliberately:

- Does it require a person to perform a fresh authentication ceremony?
- Does that ceremony prove the same guardian identity?
- Can it happen silently/backgrounded?

Only the first two, when not silently reproducible, should count toward Parent Mode freshness.

---

## UPLOAD-001 — Direct-to-R2 upload size limit was advisory/bypassable

**Severity:** Medium  
**Status:** Patched  
**Affected files:**

- `supabase/functions/upload-intent/index.ts`
- `supabase/functions/upload-complete/index.ts`
- `supabase/functions/_shared/r2.ts` (trust model reviewed; no protocol change required)

### Security property

An authenticated account must not be able to turn a nominally 25 MiB-per-object upload API into an unbounded storage/cost or downstream resource-consumption primitive.

### Baseline behavior

The intent endpoint accepted `bytes?: number` and checked:

```ts
if (object.bytes && object.bytes > MAX_BYTES) ...
```

Omission or zero therefore bypassed the check and still produced a presigned PUT URL.

More importantly, the browser uploads directly to R2. A client-supplied `bytes` value is not authoritative. A malicious client can request a URL while claiming a small object and then PUT a larger body. The completion endpoint similarly compared declared versus actual size only when `claim.bytes` was truthy and did not independently reject an object whose actual R2 size exceeded the configured maximum.

### Preconditions

- Valid authenticated Axon session.
- Ownership of the target paper (RLS correctly prevents minting against another user's paper).

### Impact

This is primarily a storage/cost and availability/resource-abuse issue, not a cross-account confidentiality breach. Oversized objects can consume private-bucket storage and may stress later image/model-processing paths if admitted into the pipeline.

### Remediation implemented

`upload-intent` now:

- requires `bytes`;
- requires a positive safe integer;
- enforces the maximum for every requested object;
- rejects non-POST methods;
- fails if the required `upload` bookkeeping row cannot be created.

`upload-complete` now:

- requires a positive bounded declared size;
- validates the runtime bucket value (TypeScript types do not validate JSON);
- performs the authoritative R2 `HEAD`;
- rejects objects whose actual size exceeds the maximum;
- deletes an oversized object when possible;
- requires declared and actual size to match;
- reports database update failures rather than marking the key confirmed in the response.

### Remaining hardening

The per-object boundary is now enforced, but the system would benefit from a separate **per-account/per-time-window upload budget**. The endpoint caps object count per request, not total bytes per guardian/day. That is an abuse-control/cost-governance improvement and should be implemented server-side if public usage grows.

Also consider storing the expected intent size in a durable upload-intent row for every object kind, not only source uploads, so completion can prove that the key, bucket, MIME type and expected size all correspond to a previously minted intent.

---

## DEPLOY-001 — Cloudflare Worker did not emit the application's CSP

**Severity:** Medium as defense-in-depth  
**Status:** Patched  
**Affected file:** `src/index.ts`  
**Reference configuration:** `netlify.toml`

### Baseline behavior

`netlify.toml` defined a meaningful Content-Security-Policy along with HSTS, MIME sniffing protection, framing, referrer and permissions restrictions. The Cloudflare Worker entry point emitted the other security headers but omitted CSP.

This means the same Vite build could have materially different exploit containment depending on which hosting path served it.

### Impact

Missing CSP is not an XSS vulnerability by itself. It removes an important mitigation if an HTML/script injection bug is introduced elsewhere, increasing the likely impact of such a bug—especially because the browser stores an authenticated guardian session.

### Remediation implemented

`src/index.ts` now emits a CSP in lock-step with `netlify.toml`.

The current policy still uses `'unsafe-inline'` for scripts/styles because `index.html` contains an inline pre-paint theme script and the existing styling path relies on inline styles. This is **not the desired end-state**.

### Follow-up hardening

1. Move the pre-paint script to a static file or adopt a stable CSP hash/nonce strategy.
2. Reduce/remove inline style use where practical.
3. Remove `'unsafe-inline'` from `script-src` first.
4. Add an automated parity test that asserts the Worker and Netlify policies do not drift.
5. Consider `Content-Security-Policy-Report-Only` telemetry during tightening before enforcing breaking changes.

---

# 5. Open architectural/security work

## AUTHZ-001 — Data export is Parent-Mode-gated only in the UI

**Severity:** Medium  
**Status:** Open  
**Files:** `src/ui/pages/Settings.tsx`, `src/account.js`

Settings correctly routes the Export button through Parent Mode. However, `exportMyData()` is assembled from ordinary RLS-scoped SELECTs. Those SELECTs are intentionally available to the normal guardian session because the study product needs them.

Therefore, a holder of the already-authenticated shared-device session can reproduce those reads directly even when the UI refuses to export. This does **not** permit cross-account reads; RLS remains the ownership boundary. It does violate the product's stated promise that export is a parent-only control-plane action.

### Correct fix

Do not try to hide REST endpoints in the client. Route the privileged export through one server-side boundary:

1. Create an export RPC/Edge Function requiring `private.has_fresh_auth()`.
2. Resolve the current guardian from `auth.uid()` server-side; never accept a caller-supplied guardian id as authority.
3. Assemble all export sections server-side under that owner.
4. Include the extraction/runtime tables currently listed as `not_included_yet` where legally/product-required.
5. Generate short-lived file URLs only for objects that belong to the owner, or stream/archive through a controlled export job.
6. Add SQL/API tests proving a stale guardian session gets `42501`/equivalent while a fresh session succeeds.
7. Keep the UI `guard()` for UX, but treat the server check as the boundary.

### Acceptance criteria

- A stale but otherwise valid guardian session cannot request the export artifact.
- Fresh auth is checked at export creation time.
- Cross-account identifiers never broaden scope.
- The generated export has an explicit schema version and completeness test.

---

## IDV-001 — Real guardian verification is not currently completed

**Severity:** High product-trust/compliance risk; not a cross-account exploit  
**Status:** Open by design / provider implementation required

The repository has already corrected a serious earlier design flaw: an authenticated browser can no longer declare itself `digilocker`-verified. `20260909160000_verification_needs_a_server_assertion.sql` requires a private, service-authored, expiring assertion that confirms identity, adulthood and relationship before a guardian can be marked verified.

However, the current onboarding code explicitly says the verification step is removed because no real adapter is implemented. Nothing in the normal onboarding path currently establishes those verification facts before the product proceeds.

### Security consequence

Axon must not treat possession of an email/phone account as equivalent to verified guardian identity/adulthood/relationship. If policy, compliance text, consent authority or backend processing assumes `guardian.verified_at` has been established for every live account, that assumption is currently false.

### Correct fix

Implement a real provider callback boundary:

1. Browser starts verification with a server endpoint.
2. Use state/nonce bound to `auth.uid()` and the attempt.
3. Provider callback is processed only server-side.
4. Verify provider signature/issuer/audience/timestamps and replay protection.
5. Check the provider result actually supplies the three facts the database assertion schema requires.
6. Service role writes exactly one short-lived `private.guardian_verification_assertion` for the authenticated account.
7. Browser calls `claim_guardian_verification()`; it cannot create assertions itself.
8. Gate whichever student-data processing legally/product-wise requires verified guardians.
9. Add negative tests: forged callback, replay, wrong user binding, expired assertion, partial facts.

Do not reintroduce a client stub or any browser-callable RPC that accepts a method/reference and marks a guardian verified.

---

# 6. Latent risk: future paper-link fetcher / SSRF

## SSRF-001 — Stored links need a hardened server fetch policy before implementation

**Severity if implemented unsafely:** High  
**Current exploitability:** None found in this repository

`src/papers.js` accepts `http:`/`https:` links and stores them as `paper_page.source_url` with `status='pending'`. Product copy says a server will fetch shared PDFs. The audit searched the repository for consumers of `source_url` and found no implemented server-side fetcher; the migration itself says link pages remain pending until a fetcher resolves them.

Therefore this is **not a live SSRF finding today**. It is a mandatory security requirement for the future component.

### Required fetcher policy

Before shipping any server-side link fetcher:

- Accept only `https:` by default; justify any `http:` support.
- Parse once with a standards-compliant URL parser.
- Reject userinfo, malformed ports and ambiguous host encodings.
- Resolve DNS server-side and reject loopback, link-local, private, carrier-grade NAT, multicast, reserved and metadata-service ranges for both IPv4 and IPv6.
- Re-resolve/revalidate every redirect target; cap redirect count.
- Defend against DNS rebinding by connecting only to the validated resolved address or otherwise binding resolution to connection.
- Do not forward Supabase/Stripe/R2 credentials, cookies or internal auth headers.
- Cap response bytes before buffering.
- Require expected content types and independently inspect the file format before parsing.
- Set strict connect/read/overall timeouts.
- Deny non-HTTP protocols even through redirects.
- Log only safe metadata; do not log signed URLs or sensitive query tokens.
- Add tests for localhost/private IPv4/private IPv6/link-local/metadata hosts/redirect-to-private/DNS rebind/oversized response.

---

# 7. Areas reviewed without a confirmed vulnerability

## 7.1 RLS / cross-account ownership

The reviewed paths generally query as the requester's Supabase JWT so PostgreSQL RLS remains authoritative. Upload intent first resolves the owned `paper` row through the user client before service-role bookkeeping is used. This is the right trust split.

The SQL test suite contains raw authenticated-role tests for destructive Parent Mode actions and ownership. Preserve this pattern: tests should issue the same database calls an attacker could issue, not merely click hidden/visible buttons.

## 7.2 Service-role credentials

Searches found service-role usage in server functions and documentation, but no committed service-role value. `serviceClient()` reads `SUPABASE_SERVICE_ROLE_KEY` from the function environment. `src/config.js` contains the Supabase publishable key, which is expected to be public and has no authority independent of RLS/authenticated user tokens.

Continue to treat any service-role, Stripe secret, R2 secret, webhook secret and model-provider key as server-only.

## 7.3 Stripe

The reviewed billing architecture resolves price/plan authority server-side and uses server-side checks before opening privileged billing flows. Stripe webhook handling is signature-based and the repository contains event-processing/idempotency work. No client-controlled price trust or unsigned webhook path was established in this review.

The Parent Mode AMR fix is still important here because billing functions that rely on the same recent-auth primitive inherit its semantics.

## 7.4 Model-generated HTML / XSS

Production search found one deliberate `dangerouslySetInnerHTML` path in `AnswerBlock.tsx`, used only with `katex.renderToString()` output. The renderer is configured with:

- `trust: false`;
- `strict: true`;
- `throwOnError: true`;
- bounded `maxExpand`;
- a pre-render deny-list for URL/raw-HTML/color-related commands.

Raw fallback text is rendered through React text nodes. No `eval()` use was found. The remaining `innerHTML` hit in `reference/prototype.html` is reference material, not the production build path described by `netlify.toml`.

Do not loosen the KaTeX trust settings without a dedicated security review.

## 7.5 Shared-device local cache

`signOut()` clears local student cache/drafts before terminating the Supabase session. This is the correct order for a sibling-shared browser. Keep local cleanup coupled to any future explicit account-switch flow.

## 7.6 CORS

Shared Edge Functions currently return `Access-Control-Allow-Origin: *`. Because the APIs require an explicit bearer token rather than ambient cookies, wildcard CORS is not by itself a CSRF bypass. It does widen who may call an endpoint if a bearer token is otherwise exposed. Restricting browser-facing endpoints to known Axon origins is still worthwhile hardening, but it is not being reported here as a standalone exploit.

---

# 8. Dependency and supply-chain posture

The repository pins its installed graph through `package-lock.json` and CI uses `npm ci`, which is good. The workflow runs tests, TypeScript checks, production config checks and local Supabase migrations/tests.

However, the reviewed workflow has no explicit dependency-vulnerability scanner, dependency-review gate or secret-scanning step. This audit did not establish a currently exploitable CVE in the declared frontend package versions; that is not equivalent to continuous assurance.

### Recommended CI additions

- Dependabot/Renovate or equivalent update automation.
- GitHub dependency review on pull requests where available.
- An SCA step such as `npm audit --audit-level=high` or OSV Scanner, with a documented triage/suppression process rather than blind failure on every advisory.
- Secret scanning / push protection where repository settings support it.
- Pin high-trust GitHub Actions to immutable commit SHAs if supply-chain policy requires stronger provenance than moving major tags.
- Periodically review Deno/npm imports used by Edge Functions, not only `package.json` dependencies.

---

# 9. Patch inventory on `security/audit-2026-09-15`

Expected security diff after cleanup:

1. `src/supabase.js`
   - bind pasted auth artifacts to the contact that initiated the login;
   - validate pasted-link origin;
   - inspect candidate session in a non-persistent client before installation.

2. `supabase/migrations/20260915111500_parent_mode_requires_interactive_amr.sql`
   - only interactive AMR methods count toward Parent Mode freshness.

3. `supabase/tests/parent_mode_refresh_regression.sql`
   - regression coverage for refresh-only, stale-auth+fresh-refresh and fresh-auth+refresh cases.

4. `supabase/functions/upload-intent/index.ts`
   - mandatory bounded size declaration;
   - method validation;
   - bookkeeping failure handling.

5. `supabase/functions/upload-complete/index.ts`
   - runtime bucket validation;
   - mandatory size claim;
   - authoritative R2 size cap;
   - oversized-object cleanup;
   - exact-size and DB-update confirmation.

6. `src/index.ts`
   - Cloudflare CSP parity with Netlify.

7. `SECURITY_AUDIT_2026-09-15.md`
   - this audit, residual risk and deployment plan.

---

# 10. Verification plan

## 10.1 Required automated checks before merge

Run the existing CI suites:

```sh
npm ci
npm test
npm run typecheck
npm run check:config
```

Run the local Supabase test process exactly as CI does:

```sh
supabase start
supabase db reset --local
```

and execute every file in `supabase/tests/*.sql`, confirming `failed = 0`.

The new Parent Mode refresh suite must be included automatically by the existing glob.

## 10.2 Authentication regression tests

In staging/local only:

- normal 6-digit email OTP login works;
- normal phone OTP works where configured;
- OAuth return still works;
- valid pasted magic link for the requested contact works;
- valid pasted link for a different test account is rejected;
- token-shaped URL from a non-Axon/non-Supabase origin is rejected;
- after a rejected pasted link, `currentSession()` has not silently changed users.

## 10.3 Parent Mode tests

- Initial recent interactive login can perform an action whose policy requires fresh auth.
- After window expiry, same action fails.
- Background token refresh does not reopen it.
- Fresh parent OTP opens it.
- Newer token refresh after that OTP does not alter the age source.
- A JWT with only `token_refresh` fails closed.

## 10.4 Upload tests

Using a staging bucket/test paper:

- missing `bytes` at intent => 4xx;
- zero/negative/non-integer/over-limit `bytes` => 4xx;
- valid object => presign succeeds;
- completion with missing/zero/over-limit claimed bytes => not confirmed;
- completion against an actual object larger than the cap => rejected and cleanup attempted;
- declared/actual mismatch => not confirmed;
- invalid bucket string => rejected;
- another student's paper id => 403/no presign;
- more than allowed object count => 4xx;
- successful normal scanner upload remains unchanged.

## 10.5 Deployment headers

For the real production hostname after deploy, inspect the top-level HTML response and a deep SPA route. Confirm at minimum:

- `Strict-Transport-Security`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- `Permissions-Policy`;
- `Content-Security-Policy`.

Verify the CSP in a real browser does not block Supabase auth/WebSocket, R2 assets, the mastery API, camera/scanner workers or KaTeX styling.

---

# 11. Deployment order

1. Review/merge the application changes.
2. **Apply `20260915111500_parent_mode_requires_interactive_amr.sql` to the live Supabase project manually.** Current CI does not deploy migrations.
3. Deploy Edge Functions containing upload intent/completion changes.
4. Deploy the site/Cloudflare Worker.
5. Verify production response headers.
6. Perform the safe authentication and Parent Mode smoke tests using designated test accounts.
7. Watch Edge Function/R2 error rates for false rejections after enforcing mandatory upload sizes.
8. Confirm scanner capture/gallery upload still completes a normal paper.

If application code that assumes a migration is live is deployed before the migration, fail closed and roll back rather than weakening the Parent Mode policy.

---

# 12. Remediation backlog, ordered

## P0 — merge/deploy with this security patch

- AUTH-001 pasted-link transaction binding.
- AUTH-002 interactive-only Parent Mode AMR.
- UPLOAD-001 authoritative upload-size enforcement.
- DEPLOY-001 Worker CSP parity.
- Run all existing + new CI/security regressions.

## P1 — next security iteration

- AUTHZ-001: server-side Parent Mode gate for complete account export.
- IDV-001: production guardian-verification provider flow backed by service-authored assertions.
- Add direct auth-link unit/integration coverage.
- Add upload-abuse per-account quotas/rate limits.
- Add deployment security-header parity tests.

## P2 — hardening

- Remove `'unsafe-inline'` from `script-src` via external script/hash/nonce strategy.
- Tighten Edge Function CORS to an explicit origin policy where operationally practical.
- Add dependency/SCA and secret-scanning controls.
- Add automated checks for new `dangerouslySetInnerHTML`, `eval`/dynamic-code use and service-role references in client directories.
- Build the SSRF-safe URL policy **before** implementing the paper-link fetcher.

---

# 13. Merge-blocking security invariants

Codex/reviewers should treat these as invariants, not suggestions:

1. **A client never chooses its own authority.** IDs are selectors; `auth.uid()`/RLS is authority.
2. **A guardian bearer session is not proof the parent is present.** Control-plane actions need recent interactive authentication.
3. **`token_refresh` is never Parent Mode proof.** Unknown AMR methods fail closed until classified.
4. **A pasted login artifact must be bound to the login transaction/contact that requested it.**
5. **Service-role keys never reach browser code, logs, generated URLs or committed config.**
6. **Direct-to-object-storage limits are verified against object storage, not trusted from client JSON.**
7. **Presigned GET/PUT URLs are bearer capabilities.** Keep them short-lived and out of logs.
8. **Every production deployment path emits the same minimum security headers.**
9. **Model output is untrusted input.** Keep HTML/URL-capable rendering disabled or sanitized at a narrow boundary.
10. **Future URL fetching starts with SSRF controls, not after launch.**
11. **Security controls hidden only in UI do not count as authorization boundaries.**
12. **Migrations that define authorization are not complete until applied and verified in production.**

---

# 14. Conclusion

The baseline was not broadly unauthenticated or trivially cross-account exploitable; its RLS-centric ownership model and server-side billing design are meaningful strengths. The most serious defects were subtler: Axon had two places where a **valid authentication artifact was given more meaning than it actually proved**. A pasted session proved an identity but not that it was the identity this login intended; a refreshed token proved session continuity but not that a parent was physically present. Both are now corrected on the audit branch.

The next security work should preserve that same principle: explicitly model what each credential/assertion proves, enforce sensitive decisions at the server/database boundary, and fail closed when the proof is absent or ambiguous.
