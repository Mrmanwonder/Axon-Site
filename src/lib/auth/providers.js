// The WorkOS custom OIDC connector is used only for an isolated staging proof-of-concept.
// Never enable VITE_WORKOS_OIDC_STAGING on production until account linking,
// Supabase password/OTP bypass, and guardian identity preservation are verified.
// No WorkOS client secret belongs in client-side configuration.
const enableWorkos = import.meta.env.VITE_WORKOS_OIDC_STAGING === 'true';

export const OAUTH_PROVIDERS = Object.freeze(
  enableWorkos ? ['google', 'custom:workos'] : ['google'],
);

export const PROVIDER_LABEL = Object.freeze({
  google: 'Google',
  'custom:workos': 'WorkOS',
});
