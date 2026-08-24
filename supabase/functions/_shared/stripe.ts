// Stripe client, shared by billing-checkout, billing-portal and stripe-webhook.
//
// Checkout + Customer Portal only -- no custom card form, so PCI scope never
// touches this codebase and the checkout surface is Stripe's own polished,
// trusted one (UX_AND_MONETIZATION_THESIS.md workstream instructions, §2).

import Stripe from 'npm:stripe@17';

export function stripeClient(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set for this function');
  return new Stripe(key, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
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
