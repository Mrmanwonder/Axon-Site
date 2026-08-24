// Open the Stripe Customer Portal for the signed-in guardian: self-serve plan
// change and cancellation, no retention-flow dark patterns (workstream
// instructions §2). Configure the Portal's branding to match Obsidian Pro dark
// mode in the Stripe Dashboard before launch -- that is configuration, not
// code, and does not belong in this function.

import { CORS, clientFor, failure, json, readJson } from '../_shared/http.ts';
import { stripeClient } from '../_shared/stripe.ts';

interface Body { return_to?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  const returnTo = typeof body?.return_to === 'string' && body.return_to.startsWith('/') && !body.return_to.includes('://')
    ? body.return_to
    : '/';

  const { data: guardian } = await sb.from('guardian').select('stripe_customer_id').single();
  if (!guardian?.stripe_customer_id) {
    return failure('No billing account yet -- start with checkout first.', 409);
  }

  const appOrigin = Deno.env.get('MASTERY_APP_ORIGIN');
  if (!appOrigin) return failure('Billing is not configured yet.', 500);

  const session = await stripeClient().billingPortal.sessions.create({
    customer: guardian.stripe_customer_id,
    return_url: `${appOrigin}${returnTo}`,
  });

  return json({ portal_url: session.url });
});
