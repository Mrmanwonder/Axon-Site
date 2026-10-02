# Guardian verification — decision record (AXO-56)

Status: **options and recommendation. The decision belongs to Tanmay (with counsel).** Nothing below has been built against a provider.
Prepared 2026-10-01. This isn't legal advice; every "law says" line needs counsel sign-off before launch copy relies on it.

## 1 · What the law actually asks, by market

Axon's students are in grades 9–12, so typically aged 14–17. That matters more than anything else here.

| Market | Who counts as a child | What must be proven before processing a child's data | Applies to Axon's users? |
|---|---|---|---|
| **India — DPDP Act 2023 §9 + Rules 2025 r.10** | under **18** | Verifiable consent of the parent. Due diligence that the person giving consent is an **identifiable adult**, by reference to identity/age details the fiduciary holds or a **virtual token** from a government-authorised entity (e.g. **DigiLocker**). Commencement: ~18 months after Nov 2025 notification, so around **May 2027**. | **Yes, every user.** This is the binding constraint. |
| US — COPPA (amended rule, FR 22 Apr 2025) | under **13** | Verifiable parental consent: signed form, card transaction, call/video, government ID check, knowledge-based questions, ID-plus-face match (delete promptly), "text plus" for some uses. | **Largely no.** 14–17-year-olds are outside COPPA. A US launch would need a state-law review (age-appropriate design / minors' privacy laws), not COPPA VPC. |
| EU/EEA — GDPR Art. 8 | under 13–16 by member state | "Reasonable efforts, taking into consideration available technology" to verify parental responsibility, for information-society services offered directly to the child. | Partly: 14–15-year-olds in 16-threshold states (e.g. DE, IE, NL). |
| UK — UK GDPR + Age Appropriate Design Code | under 13 for consent | Parental consent only under 13. The AADC applies to all under-18s (high-privacy defaults, which Axon already follows). | Consent: no. AADC: yes. |

**What no law here requires:** proof of the *legal parent–child relationship*. DPDP r.10 asks for an identifiable adult who declares themselves the parent. COPPA and GDPR ask for reasonable verification of the consenting adult. Nothing on the market proves biological or legal parentage at consumer scale.

## 2 · The schema today over-claims

`private.guardian_verification_assertion` has `identity_verified`, `adulthood_verified` and **`relationship_verified`**, and `claim_guardian_verification()` requires **all three to be true**. No provider can truthfully set `relationship_verified`. Either it stays false forever, so nobody can ever verify, or someone sets it true without evidence, which is false evidence (the exact failure 20260909111419 cleaned up).

**Recommended change (needs your yes):** replace `relationship_verified` with `relationship_declared` (the adult's signed in-app declaration, timestamped and versioned to the notice). Claim requires `identity_verified AND adulthood_verified AND relationship_declared`. UI copy says "verified adult who has declared they are the parent", never "verified parent".

## 3 · Proof model (recommended)

| Claim | Proof | What Axon stores | Expiry |
|---|---|---|---|
| Identity | Provider assertion that a real, identifiable person completed the check | provider, opaque transaction ref, assurance level, timestamp | the assertion itself: 15 min to claim, single use |
| Adulthood (≥18) | Provider-attested `age_over_18 = true`. **Never** store DOB, ID number, document image or selfie | boolean + provider ref | re-verify on change of guardian, payment-method change, or every **24 months** |
| Relationship | Declaration by the verified adult | declaration text version, timestamp | with the adulthood proof |

## 4 · Provider options

| Option | Markets | Proves | Data minimisation | Notes |
|---|---|---|---|---|
| **A. DigiLocker age/identity token** (direct via MeriPehchaan / API Setu, or via an aggregator such as Setu or Signzy) | India | identifiable adult (r.10's named example) | Good if only the age-over-18 attribute and a token ref are requested. Avoid pulling Aadhaar XML. | Strongest legal fit for India. Requires Aadhaar-linked DigiLocker, which is high coverage among Indian parents. Needs a registered requester (entity onboarding takes time). |
| B. Yoti (Digital ID / age verification) | IN, UK, EU, US | adulthood (estimation or document) | Good: age-only attributes are available | One integration for every market. Age *estimation* is weaker evidence than a token for DPDP; use the document/Digital ID path. |
| C. Stripe Identity | US, UK, EU (India limited) | identity + DOB from ID + selfie | Medium: Stripe holds the document. Configure minimal retention and request only `verified_outputs.dob` | Convenient alongside Stripe billing. Weaker India coverage. |
| D. Card-based check at checkout (COPPA-style) | all | weak signal of adulthood | Good | Not sufficient for DPDP r.10 alone. Note also that core scan-and-explain must stay free, so this can't gate the free tier. |

## 5 · Recommendation

1. **Launch market: India only for the verified-guardian gate.** Mark US, EU and UK as "not launched" in the decision record and in public copy until each has its own review.
2. **Provider: DigiLocker age token (Option A) through an aggregator**, requesting the age-over-18 attribute only. **Yoti (B) as the planned second provider** for non-Indian markets.
3. **Adopt the §2 schema change** so the stored claims are true.
4. Data minimisation (§3): no document, DOB, ID number or image stored anywhere. Provider reference, booleans, assurance level and timestamps only. Retained for account life plus the statutory period counsel sets.
5. **Timing:** DPDP r.10 binds from ~May 2027. Build now; turn the gate on before then, and no later than the first paid launch.

## 6 · What I need from you

- [ ] Launch markets: India only for now (recommended), or name others.
- [ ] Provider: A (recommended), B, C, or other.
- [ ] Schema change `relationship_verified` → `relationship_declared`: yes / no.
- [ ] Re-verification window: 24 months (recommended) or other.
- [ ] Counsel review of §1 before any public copy changes (coordinate with AXO-27/AXO-75, owned by the other workstream).

Sources: [DPDP Rules 2025, rule 10](https://www.dpdpa.com/dpdparules/rule10.html) · [MeitY commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) · [DPDP Act §9](https://www.indiacode.nic.in/bitstream/123456789/22037/1/a2023-22.pdf) · [Loeb & Loeb on amended COPPA](https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule) · [Jones Day on COPPA amendments](https://www.jonesday.com/en/insights/2025/05/ftc-finalizes-amendments-to-coppa--rule).
