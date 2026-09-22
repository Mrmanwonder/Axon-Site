# AXON Engineering Specification

# Volume VIII — Database Specification

Supabase stores account, paper, extraction/review, explanation, insight-support,
consent, analytics-preference, and billing state.

## Core domains

### Account
Guardian/student profiles, authentication-linked ownership, preferences, and
Parent Mode state.

### Paper
Paper metadata, pages, upload state, processing runs, subject/test metadata, and
retention state.

### Review
Question regions, page spans, extracted fields, teacher marks, confidence,
student confirmation, and review state.

### Explanation
One explanation per current question region, with prompt/model version and
grounding metadata required by the product contract.

### Billing
Stripe customer/subscription linkage, entitlement state, and webhook idempotency
ledger.

## Rules

- RLS is the primary browser data boundary.
- Service-role writes are limited to server runtimes that require them.
- Missing/unknown values must not be encoded as zero or success.
- Student confirmation must remain distinguishable from model extraction.
- Historical migrations may mention retired planner/digital-twin tables only to
  document their removal; those tables are not current product entities.
