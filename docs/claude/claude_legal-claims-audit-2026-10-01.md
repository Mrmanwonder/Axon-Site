# Legal and public disclosures — claims audit (AXO-73 / 74 / 75 / 76, parent AXO-27)

Prepared 2026-10-01 against Axon-Site `claude/trusting-sagan-4ie9gq`, axon-backend `main` @ `0272e44`, and the live Supabase project (`dlgcqieyevoebefhcggi`, read-only queries).
**This is an audit and a prepared draft, not legal advice and not published text.** Nothing here sets a publication date. Proposed wording is in `claude_legal-proposed-copy-edits-2026-10-01.patch` (a `git apply`-able patch against `src/ui/pages/{Privacy,Terms,Cookies}.tsx`, deliberately not applied to the branch).

BLOCKED-ON-HUMAN: counsel review of the patch before anything is merged or any date is set.

## 0. Findings that need a decision today

| # | Finding | Evidence | Why it matters |
|---|---|---|---|
| F1 | **Privacy §8/§10 name OpenRouter and claim zero-data-retention endpoints. Production does not use OpenRouter.** Every model route is Gemini via Google AI Studio (`provider = ai_studio`, `allow_training = false`). `OPENROUTER_API_KEY` survives only as an unused env type. | Live `select … from model_route`; `shared/src/model-client.ts`, `model-provider.ts` | A published statement about where student pages go is false, and the ZDR claim is not supportable for AI Studio (the code comments reserve ZDR for the `vertex` provider, which no route uses). |
| F2 | **Privacy §3 and Cookies §6 said replay "masks text and input fields". That was untrue until PR #166**: `maskAllText` is not a PostHog `session_recording` option and was ignored; text and image alt/src were recorded. | `scripts/verify-replay-masking.mjs` — old bundle leaks name, marks and image alt; new bundle masks all | The sentence becomes true only when #166 is deployed. The copy edit must ship with, not before, that deploy. |
| F3 | **Tavily is not disclosed anywhere** but receives, for Tier 1 explanations, `subject | class_level | printed question text`. It does not receive the student's answer, marks, remark or name. | `workers/explain/src/index.ts` L214-224; `shared/src/tavily.ts` (query is server-built; the model cannot supply it) | Undisclosed third-party processor. Whether OCR'd question text may be sent to a search vendor is a product/legal decision (see §3). |
| F4 | **Scope text says Cambridge-only** (Privacy §1, Terms §2) although the catalogue and onboarding support Cambridge, CBSE and IBDP. | `20260923164022_multi_curriculum_foundation`, `src/curriculum.js` | Stale; also contradicts the "no silent Cambridge" invariant. |
| F5 | **Operational tables keep student/paper identifiers after deletion.** `public.model_call` carries `student_id`, `paper_id`, `region_id`, `image_keys`, `error_detail` with no FK to `paper`/`student`; `eval_result` carries `paper_id`. Account/paper deletion cascades everything else. | Live FK query (no `model_call` row among FKs referencing `paper`/`student`) | Privacy §14-15 say derived records are removed on deletion. These rows hold no prompt/answer text, but they are identifiers plus R2 keys. Needs an engineering/legal call (purge on delete vs. disclose as operational logs). Filed as discovered work, not fixed here. |
| F6 | **Supabase project is in `ap-northeast-2` (Seoul).** No India residency exists or is promised. Privacy §13 already says data may be processed outside the user's country. | `list_projects` | Matches the known open gap; preserved as flagged. |

## 1. Claim-by-claim table (AXO-75)

Status key: **OK** accurate as written · **STALE** was true, no longer · **FALSE** contradicted by code/runtime · **COND** conditional wording, acceptable only while the condition stays true · **UNVERIFIED** needs something only a human/provider console can confirm · **FUTURE** describes something not shipped.

### Privacy Policy

| § | Claim | Source of truth | Status |
|---|---|---|---|
| 1 | Product is for Cambridge Classes 9–12 only | `curriculum_provider/programme/stage` catalogue; `src/curriculum.js` | **STALE** → patch |
| 1 | Support/privacy contact `support@axonstudy.online`; no postal address published | `src/ui/lib/legal.ts` (single constant, enforced by `tests/ui/legal-contact.test.ts`) | **OK** |
| 3 | Profile holds first name, stage/class, subjects, codes, avatar; no school/address/photo | `student`, `student_subject`; avatar is generated (`src/avatar.js`) | **OK** (wording of stage is Cambridge-specific → patch) |
| 3 | Uploaded pages, crops, transcriptions, provenance stored | pipeline tables (`paper_page`, `question_region`, `student_attempt`, `extraction_run`, `model_call`) | **OK** |
| 3 | PostHog events: pageviews, interactions, exceptions, masked replay | `src/ui/lib/analytics.ts` (`autocapture`, `capture_pageview`, `capture_exceptions`, `session_recording`) | **OK** |
| 3 | Replay masks text and inputs | `POSTHOG_PRIVACY_CONFIG`; `scripts/verify-replay-masking.mjs` | **FALSE until #166 deploys**, then **OK** |
| 3 | No custom event carries names/emails/answers/tokens/ids | `grep posthog.capture src/` → no custom capture calls at all; `before_send` also drops Library autocapture | **OK** (by construction) |
| 3 | Billing via Stripe-hosted Checkout and portal; no card form | `src/billing.js` → `billing-checkout`, `billing-portal` edge functions | **OK** |
| 8 | Requests routed through **OpenRouter** | none; production routes are `ai_studio` / Gemini | **FALSE** → patch |
| 8 | Default ZDR endpoints; provider data collection/training denied | `allow_training=false` is Axon's flag; AI Studio is not ZDR | **FALSE** as worded → patch (states what Axon sets, not Google's retention) |
| 8 | Temporary signed links make a page available to an AI request | backend uses signed asset URLs (`MASTERY_ASSET_URL`) and bounded-lifetime signing | **UNVERIFIED** — not re-read end-to-end in this pass |
| 8/10 | No mention of Tavily | `shared/src/tavily.ts`, explain worker | **FALSE (omission)** → patch |
| 7 | Verifiable guardian consent will be completed before relying on it; stub is not verification | `src/verification.js`: DigiLocker adapter `implemented: false`; stub cannot be selected in a build; DB refuses stub verification | **COND** — accurate only while DigiLocker stays unimplemented *and* the copy does not claim completion. Do not strengthen until AXO-20/59. |
| 10 | Providers: Supabase, Cloudflare, OpenRouter, Stripe, Google (auth), PostHog | see §2 | **FALSE** (OpenRouter), incomplete (Gemini, Tavily, Queues/R2 specifics) → patch |
| 11 | Share links: time-limited, revocable, read-only, no contact/sibling/model-log/signed-URL data | `20260925123447_academic_share_links`, `20261001180000_axo_105…`; `supabase/tests/academic_share.sql` (anonymous payload asserted PII-free; loss_reasons now allow-listed) | **OK** (strengthened by AXO-105) |
| 12 | PostHog is not initialised without an "Allow analytics" choice | `initAnalytics()` guard; verified 0 PostHog requests pre-consent (AXO-10 raw evidence; re-verified locally with `verify-replay-masking.mjs`) | **OK** |
| 13 | Data may be processed outside the user's country; no single-country promise | Supabase `ap-northeast-2`; Cloudflare global; Google | **OK**; India residency not promised (gap preserved) |
| 14 | Retention by criteria; no fixed period invented | no scheduled purge jobs found for paper data; PostHog retention is a project setting | **OK** / PostHog retention **UNVERIFIED** (console) |
| 15 | Deletion removes stored paper objects before the auth account is released | `delete_my_account` (live def): deletes papers (cascading pages, attempts, mark-loss, shares, runs), erases student/guardian PII to `[erased]`, deletes `auth.users`. R2 objects are removed by DB triggers `paper_prefix_deletion` / `student_prefix_deletion` that **enqueue** deletion in the same transaction; execution is asynchronous. The client additionally empties the legacy Supabase Storage bucket first. | **Partly OK**: object removal is guaranteed-queued, not completed before the account is released → wording "intended to be removed" is acceptable; "before … released" is overstated for R2. **F5** applies to `model_call`/`eval_result`. |
| 15 | A minimised consent/compliance record may be retained | `consent_event` is append-only, FK `RESTRICT` to student; guardian/student rows kept as tombstones | **OK** |
| 16 | In-product export covers available account records, not everything | `exportMyData`: profiles, papers, pages, attempts, marks lost, unreadable pages, preferences | **OK** (does not include consent ledger, shares, files) |
| 21 | Security controls listed; no absolute guarantee | RLS, private storage, HTTPS, short-lived capabilities, key separation exist; AXO-15 advisor warnings still open (SECURITY DEFINER surface) | **OK** — keep "no guarantee" wording; do not add stronger claims while AXO-15 is open |
| 20 | DPDP Act/Rules applied "to the extent in force" | no code claim | **COND** — legal question for counsel |

### Terms

| § | Claim | Source of truth | Status |
|---|---|---|---|
| 2 | Cambridge Classes 9–12 only | catalogue | **STALE** → patch |
| 2/11 | Not an examiner; no official marks; AI output may be wrong | `marks_source ∈ {teacher_pen, official_scheme}` (DB-enforced, no model value); explain pipeline writes only `ai_explanation` | **OK** |
| 10 | Cambridge names disclaimer only | — | **Incomplete** (CBSE/IB not named) → patch |
| 11-ish | Scheme language: "confirmed against … mark scheme … where applicable" | no corpus claim; Tier 2 uses stored scheme only via `resolveSchemeEvidence`; AXO-12 (registry) not done | **COND** — fine while it stays conditional; do **not** add "checked against the official scheme" |
| 16 | Free product experience; Pro adds cross-paper patterns | `get_entitlements`: Pro gates `crossSubjectPatterns`, `fullHistoricalArchive`, `parentProgressReports`, `priorityProcessing`, profile count; scan + per-paper analysis free | **OK** with the non-negotiable (no student-facing paywall) |
| 17-20 | Stripe-hosted Checkout, renewal, cancel, refunds | `billing-checkout`/`billing-portal`; `past_due` ends Pro immediately (entitlements) | **OK**; refund policy specifics **UNVERIFIED** (Stripe config) |
| 31 | Governing law India, courts in India | — | **COND** — see entity gap below |
| — | Tutor | backend `/tutor` route + `tutor` model route are live, but **no student-facing UI exists** (no tutor code in `src/` except an unrelated word in Terms) | Policies correctly make **no** tutor claim. **FUTURE**: when AXO-19/39 ship, Privacy must add that the student's free-text message (≤20,000 chars) goes to Gemini and `board programme stage subject code` (not the message) to Tavily. |

### Cookie Policy

| § | Claim | Source of truth | Status |
|---|---|---|---|
| 4/5 | Necessary storage: auth, consent choice, prefs, offline data, drafts | `axon.analytics-consent.v1`, `axon.prefs.v1`, IndexedDB read cache, sw.js cache | **OK** |
| 6 | PostHog uses localStorage+cookie persistence | `persistence: "localStorage+cookie"` | **OK** |
| 6/9 | Replay masks all text and inputs; not started before consent | see Privacy §3 | **FALSE until #166**, then **OK** |
| 7/8 | Off until allowed; "Necessary only" leaves it off; withdrawal opts out | `setAnalyticsConsent`, `opt_out_capturing` | **OK** |
| 15 | No fixed analytics retention stated | project setting | **OK** (and honest) |

## 2. Provider / processor reconciliation (AXO-74)

| Provider | What actually reaches it (verified source) | In policy today | Action |
|---|---|---|---|
| **Supabase** (`ap-northeast-2`) | Auth (email/phone OTP, Google OAuth), Postgres + RLS (guardian, student, paper, attempts, mark-loss, consent ledger, shares, model telemetry), Edge Functions (`billing-*`), legacy Storage bucket | yes | Add Edge Functions mention only if counsel wants granularity |
| **Cloudflare** | Workers (api, triage, structure, content, crop, reconcile, adjudicate, explain, sweep, intelligence), Queues (fan-out between stages), **R2** (original pages, conditioned pages, crops; signed access), CDN/static hosting of the app | partly ("worker and/or object-storage") | Name Workers, Queues, R2 (patch) |
| **Google — Gemini API (AI Studio)** | Page images/crops and extracted text for triage, structure, content, adjudicate, explain, tutor; token/cost metadata comes back and is stored in `model_call` | **No** (OpenRouter named instead) | Replace (patch). Do not claim ZDR. |
| **Tavily** | Tier 1 explanations: subject, class level, printed question text (server-built query; model cannot choose it). Tutor: curriculum/subject labels. Not answers, marks, remarks, names. | **No** | Add (patch); decision in §3 |
| **Stripe** | Checkout/portal; customer + subscription ids, plan, status, timestamps (synced into the `stripe` schema) | yes | OK |
| **Google OAuth** | Identity assertion on sign-in | yes | OK |
| **PostHog** (US cloud: `us.i.posthog.com`, project 620121) | Opt-in only: pageviews, autocapture (text/attributes masked after #166), exceptions, masked replay with media blocked | yes | Wording fixed once #166 ships |
| OpenRouter | nothing (legacy env var only) | **named as current** | Remove (patch) |
| DigiLocker | nothing (adapter not implemented) | not named | Keep unnamed until AXO-20/59 |

## 3. Decisions for Tanmay (not mine to resolve)

1. **Tavily and OCR'd question text.** Options: (a) keep and disclose (patch does this); (b) restrict the search query to subject + stage + a concept label instead of verbatim question text; (c) switch Tier 1 web grounding off. Recommendation: (b) — it removes the only place paper-derived text leaves for a search vendor, costs little explanation quality, and is a one-line change in `workers/explain/src/index.ts`. Needs your call because it changes explanation behaviour.
2. **Google AI Studio vs Vertex for student pages.** AI Studio is what runs; Vertex is the zero-retention route and is a `model_route.provider` change. Recommendation: move `explain`/`structure`/`content` to Vertex before making any retention statement stronger than "Google's terms apply". Confirm the AI Studio account's billing tier/data-use terms; I cannot see them.
3. **`model_call` / `eval_result` after deletion (F5).** Options: add FKs `ON DELETE CASCADE` (or SET NULL for identifiers) and purge `image_keys`; or disclose them as operational logs with a retention window. Recommendation: cascade/null on delete.

## 4. Known legal gaps — preserved, not papered over

- The operator is currently an individual, not an incorporated entity; policies say "Axon" and give no postal address. Governing-law/venue clauses assume an Indian operator. **Counsel.**
- No India data-residency commitment exists (F6). Policy correctly makes none.
- Guardian verification is **not** DPDP-compliant: the DigiLocker adapter is unimplemented, the dev stub cannot reach a build, and the DB refuses stub verification. Copy must never imply otherwise (AXO-20/56/59).
- Complete marking-scheme corpus does not exist (AXO-12 open). Copy must keep official-scheme wording conditional on a verified stored source.
- Tutor is backend-only (AXO-19/39).

## 5. Contact, layout and dates (AXO-76)

- **Contact:** the only address on any public surface (src pages, `public/`, `index.html`, manifest) is `support@axonstudy.online`. It is now a single constant, `SUPPORT_EMAIL` in `src/ui/lib/legal.ts`; `tests/ui/legal-contact.test.ts` fails if any other address appears. (`PRODUCTION_READINESS.md` also lists the same address.)
- **Layout:** `/privacy`, `/terms`, `/cookies` were loaded at 320, 360 and 390 px in dark and light (headless Chromium, `isMobile` + `deviceScaleFactor 2`, emulated). Result for all 18 combinations: no horizontal overflow (`scrollWidth == clientWidth`), the theme attribute applied, no element wider than the viewport, consent banner present. Screenshots: `docs/claude/legal-shots/`. **This is emulation, not a real Android/iPhone**; a real-device pass is a human item. The fixed consent banner covers ~30% of a 360×740 viewport until a choice is made (readable, dismissible; not changed).
- **Dates:** still 22 September 2026 / 22 September 2026, now in `LEGAL_EFFECTIVE_DATE` / `LEGAL_LAST_UPDATED`. Publication = change those two lines in the same commit that applies the counsel-approved copy. Not changed here.
