// Start a Stripe Checkout session for the signed-in guardian.
//
// UX_AND_MONETIZATION_THESIS.md is explicit about where this may be called
// from: the parent's own account/dashboard surface, never mid-session inside
// the student's capture -> understand -> act loop. That boundary is a UI
// concern (this function has no way to know which screen called it), so it is
// enforced in index.html/src -- see UX_MONETIZATION_AUDIT.md. What this
// function itself guarantees is narrower and structural: it only ever acts on
// the caller's own guardian row (RLS-scoped client, exactly like every other
// function in this codebase -- see AGENTS.md), and it never takes a price id
// from the client, only a plan name it resolves server-side.

import { CORS, clientFor, failure, json, readJson } from '../_shared/http.ts';
import { priceIdFor, stripeClient } from '../_shared/stripe.ts';

interface Body { plan: 'monthly' | 'annual'; return_to?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (body?.plan !== 'monthly' && body?.plan !== 'annual') {
    return failure('plan must be "monthly" or "annual".');
  }
  // Origin-relative only, so this can never become an open redirect to a
  // domain Stripe would then dutifully send a payer to.
  const returnTo = typeof body.return_to === 'string' && body.return_to.startsWith('/') && !body.return_to.includes('://')
    ? body.return_to
    : '/';

  const { data: guardian } = await sb.from('guardian')
    .select('id, name, contact, stripe_customer_id').single();
  if (!guardian) return failure('No guardian account for this session.', 404);

  const appOrigin = Deno.env.get('MASTERY_APP_ORIGIN');
  if (!appOrigin) return failure('Checkout is not configured yet.', 500);

  const stripe = stripeClient();

  let customerId = guardian.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: guardian.name,
      metadata: { guardian_id: guardian.id },
    });
    customerId = customer.id;
    // Own row, own RLS policy (guardian_update_own) -- no elevated access needed.
    const { error } = await sb.from('guardian').update({ stripe_customer_id: customerId }).eq('id', guardian.id);
    if (error) return failure('Could not start checkout.', 500, error.message);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: guardian.id,
    metadata: { guardian_id: guardian.id },
    subscription_data: { metadata: { guardian_id: guardian.id } },
    line_items: [{ price: priceIdFor(body.plan), quantity: 1 }],
    // Stripe Tax handles GST for India-resident customers and the equivalent
    // for other jurisdictions -- see the Stripe Dashboard config, not this
    // code (workstream instructions §2 / §5).
    automatic_tax: { enabled: true },
    success_url: `${appOrigin}${returnTo}${returnTo.includes('?') ? '&' : '?'}billing=success`,
    cancel_url: `${appOrigin}${returnTo}${returnTo.includes('?') ? '&' : '?'}billing=cancelled`,
  });

  return json({ checkout_url: session.url });
});
