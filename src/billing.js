// Checkout and the Customer Portal — called only from the parent's own
// account/billing surface. Import this module only from that surface: it has
// no purpose anywhere in the student's scan -> understand -> act loop, and
// UX_MONETIZATION_AUDIT.md tracks that as a standing invariant to check on
// every screen that touches it.

import { sb } from './supabase.js';

async function invoke(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    try {
      const parsed = await error.context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch { /* keep the transport message */ }
    const wrapped = new Error(message);
    wrapped.cause = error;
    throw wrapped;
  }
  return data;
}

/**
 * Start Stripe Checkout for the signed-in guardian and send them there.
 * @param {'monthly'|'annual'} plan
 * @param {string} [returnTo] Origin-relative path to return to. Defaults to "/".
 */
export async function startCheckout(plan, returnTo = '/') {
  const { checkout_url } = await invoke('billing-checkout', { plan, return_to: returnTo });
  window.location.assign(checkout_url);
}

/**
 * Open the Stripe Customer Portal — self-serve plan change, cancellation, and
 * (per the thesis) at most a single neutral pause-instead-of-cancel option,
 * configured in Stripe, not here. No retention flow lives in this codebase.
 * @param {string} [returnTo]
 */
export async function openBillingPortal(returnTo = '/') {
  const { portal_url } = await invoke('billing-portal', { return_to: returnTo });
  window.location.assign(portal_url);
}
