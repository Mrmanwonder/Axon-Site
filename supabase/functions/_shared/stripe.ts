// Stripe client, shared by billing-checkout, billing-portal and stripe-webhook.
//
// Checkout + Customer Portal only -- no custom card form, so PCI scope never
// touches this codebase and the checkout surface is Stripe's own polished,
// trusted one (UX_AND_MONETIZATION_THESIS.md workstream instructions, §2).

import Stripe from 'npm:stripe@18';

// Pinned, and pinned HERE so all three billing functions speak one version.
//
// 2025-03-31.basil is a floor, not a preference: this account has Managed
// Payments enabled, and Stripe refuses any request on an older version with
// "Managed Payments is not supported on API version 2024-06-20". The SDK major
// is bumped with it because the two travel together -- stripe@18 is the one
// whose types describe Basil.
//
// Basil moved current_period_start/end off Subscription and onto its items.
// stripe-webhook reads that field; see the note there before changing this
// version again in either direction.
const API_VERSION = '2025-03-31.basil';

export function stripeClient(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set for this function');
  return new Stripe(key, { apiVersion: API_VERSION, httpClient: Stripe.createFetchHttpClient() });
}

/** Price id for a plan, from env so this never needs a code change to repoint. */
export function priceIdFor(plan: 'monthly' | 'annual'): string {
  const key = plan === 'annual' ? 'STRIPE_PRICE_ANNUAL' : 'STRIPE_PRICE_MONTHLY';
  const id = Deno.env.get(key);
  if (!id) throw new Error(`${key} is not set for this function`);
  return id;
}

/**
 * Plan implied by a Stripe price id, the other direction -- used by the
 * webhook to decide pro vs pro_annual without trusting anything the client
 * sent at checkout time.
 */
export function planForPriceId(priceId: string | null | undefined): 'monthly' | 'annual' | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get('STRIPE_PRICE_MONTHLY')) return 'monthly';
  if (priceId === Deno.env.get('STRIPE_PRICE_ANNUAL')) return 'annual';
  return null;
}
