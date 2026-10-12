# WorkOS AuthKit → Supabase custom OIDC (AXO-234)

WorkOS holds guardian passwords so that its password policy and its breached-password check (Have I Been Pwned) apply on the server. Supabase stays the session issuer, so `auth.uid()`, RLS, Google sign-in and email/phone codes are unchanged.

## What the app does

- `VITE_WORKOS_OIDC_STAGING` unset or anything other than exactly `true`: no change. Password sign-in uses Supabase as before.
- `VITE_WORKOS_OIDC_STAGING=true`: once a valid email is typed on the account step, "Continue with a password" hands off to WorkOS (no Axon account check is made in this mode) through the Supabase provider `custom:workos` (`signInWithOAuth`, scopes `openid email profile`). Sign-in, sign-up and password reset all happen on the WorkOS page. WorkOS never appears as a separate button or by name.
- With the flag on, Parent Mode offers only the emailed code. A WorkOS-held password cannot be checked by Supabase.

Code: `src/lib/auth/providers.js`, `src/supabase.js` (`signInWithProvider`), `src/ui/onboarding/Onboarding.tsx`, `src/ui/data/useParentMode.tsx`. Tests: `tests/ui/workos-oidc-provider.test.ts`, `tests/ui/onboarding-single-flight.test.tsx`, `tests/ui/parent-mode-workos.test.tsx`.

## Live configuration as read on 12 Oct 2026

| Item | Value | State |
|---|---|---|
| WorkOS environment | Staging (sandbox), `environment_01M4JH5SBPTPXXQVHK0PCHGXX1` | in use |
| WorkOS Production | `canUseProduction: false` (no billing on the workspace) | not usable yet |
| OIDC issuer | `https://free-cove-65-staging.authkit.app` (discovery document valid: RS256, `openid email profile`, `client_secret_basic`/`post`) | OK |
| Connect app | "Axon", `app_01M4JH8TV1BVTB7QSN2F4JQDZE`, client `client_01M4JH8TV0P3WY54FX9N3VE0SH`, confidential | **no client secret exists; app-level redirect URIs empty** |
| Redirect URI | `https://dlgcqieyevoebefhcggi.supabase.co/auth/v1/callback`, set on the environment, not the Connect app | check |
| Password policy | min length 10, strength 3, no uppercase/lowercase/number rule, breached check **off** | **does not match the owner rule** |
| Other AuthKit methods | Apple, GitHub, Microsoft and Google sign-in on; Magic Auth off; email verification required | see step 1 |
| Supabase | Only project is production `dlgcqieyevoebefhcggi` (org on Free). Public `/auth/v1/settings` does not list custom providers, so `custom:workos` cannot be confirmed from outside. | owner reports configured |

## Owner steps, in order

These change WorkOS or Supabase account settings, so an agent session may not make them.

1. **WorkOS → Staging → Authentication → Methods → Password policy.** Minimum length 8. Require uppercase, lowercase and a number. Do not require a symbol. Turn on "Reject breached passwords". Set minimum strength to the lowest setting, so the composition rule above is the whole rule. Turn off Apple, GitHub, Microsoft and Google sign-in on the AuthKit page: Google already goes through Supabase directly, and a second Google route creates a second guardian account.
2. **WorkOS → Staging → Applications → Axon (Connect).** Create a client secret. Add `https://dlgcqieyevoebefhcggi.supabase.co/auth/v1/callback` to the app's own redirect URIs.
3. **Supabase → Authentication → Sign In / Providers → Custom → `custom:workos`.** Issuer `https://free-cove-65-staging.authkit.app`, client ID `client_01M4JH8TV0P3WY54FX9N3VE0SH`, the secret from step 2, scopes `openid email profile`.
4. **Decide isolation.** The only Supabase project is production. Either create a free second project in the Axon_Site org for staging (Free allows two), or accept testing against production with one synthetic guardian account that is deleted afterwards.
5. Deploy a preview with `VITE_WORKOS_OIDC_STAGING=true` and run the checks below.

## Checks before any production use

Record each result on AXO-234.

- [ ] New password rejected below 8 characters, without an uppercase, lowercase or digit; accepted with no symbol.
- [ ] A known breached password (for example `Password123`) rejected by WorkOS.
- [ ] Reset and first-time sign-up both complete and return to Axon signed in.
- [ ] An existing guardian with the same verified email keeps the same `auth.uid()`; no second guardian row; consent and student profiles intact.
- [ ] Unverified email never links to an existing account.
- [ ] Google sign-in and email/phone codes still work.
- [ ] **Bypass matrix (blocking).** Hosted Supabase cannot switch off email+password while keeping email codes. Direct calls to `/auth/v1/signup`, `/auth/v1/token?grant_type=password`, `/auth/v1/user` (password change) and `/auth/v1/recover` still accept a Supabase password that never went through WorkOS. Until these are closed, WorkOS screening covers the Axon interface only and is not authoritative. Options: move email codes to WorkOS Magic Auth and switch off the Supabase email provider, or reject non-WorkOS password sessions in a custom access token hook (a compensating control only).
- [ ] Parent Mode unlock by code works for a WorkOS-only guardian.
- [ ] Production WorkOS needs billing details on the workspace (AuthKit is free to 1M MAU). No billing change without the owner.
