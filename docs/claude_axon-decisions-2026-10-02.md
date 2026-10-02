# Axon — decisions waiting on Tanmay (2026-10-02)

Six decisions. Each one is a yes or no, with my recommendation listed first. Answer with the number and "yes" (take the recommendation) or the letter of another option. The agent implements as soon as you answer. Nothing below has been published, and no legal text changes without counsel.

---

## 1. Privacy route for student pages and the tutor (AXO-129, AXO-126, AXO-35)

**Decision:** Move the three stages that read student pages (`structure`, `content`, `explain`) and the tutor to **Vertex AI** with zero data retention? **Recommended: yes.**

**Facts (verified in production on 2026-10-01):**
- All six `model_route` rows say `provider = ai_studio` and `allow_training = false`. No route uses `vertex`, and OpenRouter isn't used at all.
- The published Privacy Policy §8/§10 says requests go through OpenRouter's zero-data-retention endpoints. That is false today.
- The tutor's `STUDENT_CHAT_STRICT` policy admits only `gemini-zdr`. With `GEMINI_PRIVACY_MODE=unverified`, it therefore refuses every request: the tutor is unshippable as configured. This is the same underlying decision.

**Options:**
- **A (recommended):** Vertex AI with zero data retention for `structure`, `content`, `explain` and `tutor`.
  - Engineering: a `model_route.provider` change, the Vertex service-account secret on the workers, then one eval run per stage before switching (AXO-125 rule).
  - Lets the policy make a true retention claim and unblocks the tutor.
- **B:** Make a policy exception that admits the AI Studio route for Tanmay's own internal tutor accounts only (`TUTOR_ROLLOUT=internal`), while student-page stages stay on AI Studio under "Google's terms apply" wording. Fastest, but the tutor can never reach students this way.

**What you must check yourself (the agent can't see it):**
- the AI Studio project's billing tier: paid tier vs free tier, since the free tier lets Google use prompts to improve products;
- the data-use terms shown in AI Studio → Settings → Plan;
- paste back: "Paid tier: yes/no" and the project id.

**Proposed factual correction for counsel (not published):** `docs/claude/claude_legal-proposed-copy-edits-2026-10-01.patch` §8/§10 replaces the OpenRouter and zero-data-retention claim with:

> "We send the images and text needed to read and explain a paper to Google's Gemini models through Google's API. Google processes them under its API terms; they are not used to train Google's models."

The second sentence is only true on the paid tier, which is what the check above confirms. Under option A, add "and are not retained after the response is returned" once Vertex zero data retention is live. No publication date is set.

---

## 2. Guardian verification (AXO-56 → 57/58/59)

Full record: `docs/claude_guardian-verification-decision-record-2026-10-01.md`.

| # | Decision | Recommendation |
|---|---|---|
| 2a | Launch market India only for now (DPDP Act 2023)? | **Yes** |
| 2b | Provider: DigiLocker age token first, Yoti second? | **Yes** |
| 2c | Rename `relationship_verified` to `relationship_declared`? No provider can verify a parent-child relationship, so as written nobody can ever be verified. | **Yes** (one migration plus the claim check) |
| 2d | Re-verify every 24 months? | **Yes** |
| 2e | Counsel reviews any public copy change before it ships? | **Yes** (required) |

The server half is built and tested (Axon-Site#165, 16 SQL assertions; axon-backend#143, 8 API tests). No provider is registered, so no one can be marked verified by accident.

---

## 3. Tavily web search in Tier 1 explanations (AXO-127)

**Decision:** Restrict the search query to subject, stage and a concept label, so the printed question text never goes to Tavily? **Recommended: yes (B).**

- A: keep sending the question text and disclose Tavily in the policy.
- B: restrict the query (recommended). This is a one-line change in `workers/explain/src/index.ts`, and grounding may be slightly weaker.
- C: disable web search for Tier 1.

---

## 4. Telemetry left behind after deletion (AXO-128)

**Update 2026-10-02 ~06:00 UTC:** option A is already implemented by the other session and **live**:
- migration `20261002060000_axo_128_anonymise_telemetry_on_delete`, recorded in the ledger as `20261002053503`;
- the delete sheets now say usage logs stay, anonymised.

Nothing to decide unless you want B instead.

**Decision:** On paper or account deletion, anonymise `model_call` and `eval_result`? That means nulling `student_id`, `paper_id`, `region_id` and `image_keys`, plus the R2 keys in `error_detail`, while keeping token and cost rows for AXO-124 accounting. **Recommended: yes (A, anonymise rather than cascade-delete).**

- B: keep the rows and disclose a retention window, for example 90 days, in the Privacy Policy.

---

## 5. Scanner reliability thresholds (AXO-48)

**Decision:** Accept these as the acceptance bar? **Recommended: yes.**
- acquisition p95 ≤ 3000 ms, with timeouts kept in the denominator;
- correct Auto capture within 10 s in ≥ 95% of capture-ready trials;
- zero false captures, and zero false locks on hard negatives;
- ≥ 20 trials per device × scenario;
- 60 fps on a mid-tier Android during lock.

Source: `docs/qa/scanner-reliability.md` and `docs/claude_release-acceptance-matrix-2026-10-01.md` §C.

---

## 6. Failed payment (`past_due`) and currency

**Today, in production:** `20260902125055_past_due_ends_pro_immediately` ends Pro the moment Stripe reports a failed payment. `guardian.subscription_grace_until` exists but is unused. Free keeps core scan-and-explain, so no student loses the core product.

| # | Decision | Recommendation |
|---|---|---|
| 6a | Restore a 7-day grace period (Pro stays on until `subscription_grace_until`, with a calm parent-only notice)? | **Yes.** The column and the logic already exist in `entitlements_and_billing`, and a card failure shouldn't change a family's experience mid-week. |
| 6b | Charge in INR only for launch (India only, per 2a)? | **Yes** |

---

After you answer, the agent will:
- **1A:** route migration plus Vertex adapter checks, an eval run per stage, the tutor `TUTOR_ROLLOUT=internal` smoke, and the copy patch for counsel;
- **2c:** the rename migration;
- **3B:** the query restriction plus a test;
- **4A:** the anonymisation trigger plus a deletion test;
- **6a:** the grace-period migration plus a test.
