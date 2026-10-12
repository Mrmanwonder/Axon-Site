// Sign-in providers handed off through Supabase OAuth.
//
// WorkOS (AXO-234) is a password authority, not a brand a parent picks: when
// VITE_WORKOS_OIDC_STAGING is exactly "true", the existing "Sign in with a
// password" choice hands off to WorkOS AuthKit through the Supabase custom
// OIDC provider `custom:workos`, so WorkOS's password policy and breached-
// password check apply. It never appears as its own button.
//
// Staging only until the bypass matrix in docs/auth/workos-oidc-staging.md
// passes: hosted Supabase still accepts its own password endpoints. No WorkOS
// client secret belongs in client-side configuration.
export const WORKOS_PASSWORD = import.meta.env.VITE_WORKOS_OIDC_STAGING === 'true';

/** Buttons shown on the account step, in order. */
export const OAUTH_PROVIDERS = Object.freeze(['google']);

/** Every provider signInWithProvider accepts. */
export const SIGN_IN_PROVIDERS = Object.freeze(
  WORKOS_PASSWORD ? ['google', 'custom:workos'] : ['google'],
);

export const PROVIDER_LABEL = Object.freeze({
  google: 'Google',
  'custom:workos': 'your email and password',
});
