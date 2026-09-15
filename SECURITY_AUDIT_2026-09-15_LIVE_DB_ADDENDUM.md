# Axon Security Audit — Live Database Addendum

**Date:** 2026-09-15  
**Applies to:** `SECURITY_AUDIT_2026-09-15.md`  
**Status:** authoritative correction/addition to the executive-summary count

During the final live-policy verification, the production Supabase project was queried read-only through `pg_policies`. That check confirmed an additional live authorization defect which was not yet reflected in the original audit document's executive-summary count.

The corrected headline is therefore:

- **3 High-priority confirmed authentication/authorization defects**
- **1 Medium resource-abuse defect**
- **1 Medium deployment hardening gap**
- plus the open architectural/trust-boundary items described in the main audit.

The main audit remains valid for AUTH-001, AUTH-002, UPLOAD-001, DEPLOY-001 and the open/latent items. This addendum adds the following confirmed production finding and changes the export item identifier from `AUTHZ-001` to `AUTHZ-002` for clarity.

---

## AUTHZ-001 — Stale permissive consent policy bypasses Parent Mode

**Severity:** High  
**Exploitability:** Confirmed in the live database on 2026-09-15  
**Status:** Repair migration + regression test are on `security/audit-2026-09-15`; production remains affected until the migration is applied.  
**Affected object:** `public.consent_event` INSERT RLS policies

### Security property

A guardian-session holder on the shared student device must not be able to grant, withdraw or otherwise append consent decisions unless a parent has re-authenticated recently.

The repository's intended policy is:

- consent row belongs to the signed-in guardian;
- any `student_id` belongs to that same guardian;
- `private.has_fresh_auth()` is true.

### Confirmed live state

The live project currently has **two authenticated INSERT policies** on `public.consent_event`:

1. `consent_event_insert_own`
   - the newer intended policy;
   - checks `guardian_id = private.current_guardian_id()`;
   - verifies the optional student belongs to the current guardian;
   - requires `private.has_fresh_auth()`.

2. `Guardians can append their own consent events`
   - an older stale policy;
   - is also **PERMISSIVE**;
   - does **not** require Parent Mode freshness;
   - contains the condition `s.guardian_id = s.guardian_id`, which is a tautology and therefore does not bind the named student to the current guardian.

PostgreSQL combines multiple applicable **PERMISSIVE** RLS policies with OR semantics. As a result, satisfying the stale policy is enough for the INSERT even when the newer policy's Parent Mode condition is false.

The live-policy query separately confirmed that the archive/subscription policies reviewed during the same sweep are `RESTRICTIVE`; those are not affected by this OR-policy issue.

### Impact

A person holding the normal guardian bearer session on the shared device can directly append consent changes without completing Parent Mode. This defeats one of the principal controls designed to distinguish ordinary student use from parent-authorized control-plane actions.

The stale policy's student-ownership typo can also permit a consent ledger row to name another student's id while using the caller's owned guardian id. The current effective-consent evaluation is still guardian-scoped, so this was not established as a cross-account consent takeover, but the inconsistent cross-account audit row is itself invalid and the policy must be removed.

### Preconditions

- A valid authenticated guardian session exists on the device.
- No fresh Parent Mode proof is required by the stale policy.
- The caller sends a direct PostgREST/SDK insert rather than relying on the guarded Settings UI.

This is exactly the threat model Parent Mode is meant to address: the student may legitimately hold the guardian session, so client-side button gating cannot be the authority boundary.

### Safe verification

Use the local/staging database regression test rather than changing real consent in production.

The test should assert from `pg_policies` that:

- the stale policy name does not exist;
- exactly one authenticated INSERT policy applies to `consent_event`;
- that policy contains the fresh-auth requirement;
- that policy binds `student_id` to `private.current_guardian_id()`.

### Remediation implemented on the branch

Migration:

`supabase/migrations/20260915113000_reassert_consent_parent_mode_policy.sql`

The migration:

1. drops `Guardians can append their own consent events` if it exists;
2. drops/recreates the canonical `consent_event_insert_own` policy;
3. requires current-guardian ownership;
4. binds any student to the current guardian;
5. requires `private.has_fresh_auth()`;
6. documents that this must remain the sole authenticated INSERT policy.

Regression test:

`supabase/tests/consent_policy_security.sql`

This is deliberately a schema/policy-shape test in addition to behavioral Parent Mode tests. For permissive RLS, merely proving that the secure policy exists is insufficient; a second permissive policy can silently bypass it.

### Deployment urgency

**This migration should be treated as P0.** The vulnerable policy exists in the live database now. Committing or merging the migration does not fix production by itself.

Recommended order:

1. run the migration/test locally;
2. review the exact policy diff;
3. apply `20260915111500_parent_mode_requires_interactive_amr.sql` and `20260915113000_reassert_consent_parent_mode_policy.sql` to the live Supabase project;
4. immediately re-query `pg_policies` and confirm there is exactly one authenticated INSERT policy for `consent_event`;
5. verify a stale session receives an RLS refusal and a freshly re-authenticated session succeeds.

Do not weaken or temporarily disable RLS to deploy this fix.

---

## AUTHZ-002 — Data export remains UI-only Parent Mode enforcement

This is the item named `AUTHZ-001` in the original audit document. It is renumbered here only to keep the confirmed live consent defect at the higher priority identifier.

Its assessment is unchanged:

- **Severity:** Medium
- **Cross-account leak:** not established; RLS still scopes reads to the account
- **Boundary failure:** a holder of the ordinary guardian session can issue the underlying RLS-authorized reads without using the Settings export button
- **Fix:** route export through a server/RPC boundary that independently requires `private.has_fresh_auth()` and resolves account ownership from `auth.uid()`.

---

## Corrected priority order

### P0 — deploy as a security fix

1. `AUTHZ-001` — remove stale permissive consent policy.
2. `AUTH-002` — Parent Mode must ignore non-interactive/background AMR methods.
3. `AUTH-001` — bind pasted authentication artifacts to the login contact/transaction.
4. `UPLOAD-001` — enforce actual object size after direct-to-R2 PUT.
5. `DEPLOY-001` — CSP parity on the Cloudflare Worker.

### P1

1. `AUTHZ-002` — server-side gated account export.
2. `IDV-001` — live guardian-verification provider/assertion flow.
3. upload quotas/rate limits and security-header parity tests.

### P2

1. remove CSP `'unsafe-inline'` where feasible;
2. explicit origin CORS hardening;
3. SCA/secret-scanning automation;
4. SSRF-safe fetch architecture before any paper-link fetcher is implemented.
