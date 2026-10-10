# WorkOS AuthKit → Supabase Custom OIDC: staging-only wiring

This change **does not replace Supabase Auth credentials**. It adds one optional provider, `custom:workos`, to Axon's existing `signInWithOAuth` flow, gated behind `VITE_WORKOS_OIDC_STAGING=true`. Default `false` leaves Google, email/phone OTP, and Supabase email/password flows unchanged. Do **not** enable it on the production deployment.

## Prerequisites

1. Create a **separate Supabase staging project** (or equivalent isolated environment) for auth testing. **The existing `src/config.js` still targets the production Supabase project**; changing only `VITE_WORKOS_OIDC_STAGING` does **not** isolate anything! Do not flip the flag until staging backend configuration is explicitly implemented and verified.
2. Create the WorkOS AuthKit staging application and a **WorkOS Connect first-party OAuth/OIDC application** whose client credentials are used by the Supabase custom provider.
3. Configure the Supabase staging project's **Custom OAuth Providers → OIDC → Auto-discovery** with WorkOS' exact OIDC issuer string (no trailing slash if the discovery document has none), client ID/secret and identifier **`custom:workos`**. These private credentials belong in Supabase/WorkOS settings, not browser `VITE_` variables.
4. Copy the callback/redirect URL **shown by the Supabase custom OIDC provider** into the WorkOS Connect OAuth app's allowed redirect URIs. This URL is Supabase Auth's callback, **not** Axon's home URL. Allowlist the staging Axon website return URL in **Supabase Auth URL configuration**.
5. Use an isolated, synthetic guardian account without real student data. Test both first-time and returning sign-in, returned `email_verified`, account linking and unchanged `auth.uid()` on the same user. Never test provider linking by risking a real production guardian.
6. Set `VITE_WORKOS_OIDC_STAGING=true` **only** for isolated staging, rebuild, and use `Continue with WorkOS`.

## Why it is not production-ready

- Supabase Auth still directly accepts **email/password**; an OIDC provider does **not** automatically enforce WorkOS HIBP policy on those password endpoints. Native provider disabling, or another provably authoritative enforcement approach, must be settled by adversarial tests before a production migration.
- A WorkOS staging issuer configured inside a **production Supabase project is not a staging Supabase environment**. Do not link the live guardian namespace against a staging provider without a safe rollout plan.
- An external OIDC provider may create a new Supabase user rather than link it. Confirm identical guardian UUID and existing student-consent/RLS ownership before accepting migration.
- Parent Mode currently reauthenticates via Supabase password and would require separate work; reset/OTP/Gmail remain unchanged by this PR.
- Password creation in WorkOS is controlled by WorkOS's own policy; configure >=8 characters, uppercase, lowercase, digit, no mandatory symbol, HIBP rejection and verify it with provider-side tests.

**Scope of this PR:** only make the optional OIDC method reachable inside the existing Axon OAuth UI when explicitly enabled. No live config, schema, signups, passwords, provider secrets or production login are changed.

References:
- https://supabase.com/docs/guides/auth/custom-oauth-providers
- https://workos.com/docs/authkit/connect/oauth
- https://linear.app/axon-26/issue/AXO-234
