// Start a Stripe Checkout session for the signed-in guardian.
//
// UX_AND_MONETIZATION_THESIS.md is explicit about where this may be called
// from: the parent's own account/dashboard surface, never mid-session inside
// the student's capture -> understand -> act loop. WHERE it is called from is
// still a UI concern, since this function cannot know which screen called it.
// WHO called it is not, and no longer relies on the UI: requireParentMode()
// below refuses unless the caller re-authenticated recently, so a student
// holding the guardian's session cannot start a subscription by calling this
// endpoint directly. It also only ever acts on the caller's own guardian row
// (RLS-scoped client for authorization) and never takes a price id from the
// client, only a plan name it resolves server-side.

import { CORS, clientFor, failure, json, readJson, serviceClient } from '../_shared/http.ts';
import { requireParentMode } from '../_shared/parent_mode.ts';
import { priceIdFor, stripeClient } from '../_shared/stripe.ts';

interface Body { plan: 'monthly' | 'annual'; return_to?: string }

Deno.serve(async (req) => {
  try {
    return await checkout(req);
  } catch (err) {
    return failure((err as Error).message || 'Checkout could not be started.', 500);
  }
});

function originForReturn(): string {
  const raw = Deno.env.get('MASTERY_APP_ORIGIN') ?? Deno.env.get('AXON_SITE_URL') ?? '';
  return raw.trim().replace(/\/+$/, '');
}

async function checkout(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const refusal = await requireParentMode(sb);
  if (refusal) return refusal;

  const body = await readJson<Body>(req);
  if (body?.plan !== 'monthly' && body?.plan !== 'annual') {
    return failure('plan must be "monthly" or "annual".');
  }
  const returnTo = typeof body.return_to === 'string' && body.return_to.startsWith('/') && !body.return_to.includes('://')
    ? body.return_to
    : '/';

  // Authorization happens with the caller's JWT. Do not let a service-role
  // lookup choose which guardian row is being billed.
  const { data: guardian, error: guardianError } = await sb.from('guardian')
    .select('id, name, contact, stripe_customer_id').single();
  if (guardianError && guardianError.code !== 'PGRST116') {
    return failure('Could not read your account.', 500, guardianError.message);
  }
  if (!guardian) return failure('No guardian account for this session.', 404);

  const appOrigin = originForReturn();
  if (!appOrigin) {
    return failure('Checkout is not configured yet.', 500,
      'Set AXON_SITE_URL (or MASTERY_APP_ORIGIN, which overrides it) on the project.');
  }

  let priceId: string;
  try {
    priceId = priceIdFor(body.plan);
  } catch {
    return failure(
      body.plan === 'annual'
        ? "The yearly plan isn't set up yet. Monthly is available now."
        : "The monthly plan isn't set up yet.",
      503,
    );
  }

  const stripe = stripeClient();
  let customerId = guardian.stripe_customer_id as string | null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: guardian.name,
      metadata: { guardian_id: guardian.id },
    }, { idempotencyKey: `guardian-customer:${guardian.id}` });
    customerId = customer.id;

    // Billing identity is a server-authored security boundary. The browser must
    // never be able to write Stripe ids or subscription state directly. We
    // already resolved `guardian.id` through the caller's RLS-scoped client, so
    // this elevated write is limited to that exact authorised row and one exact
    // server-produced value.
    const admin = serviceClient();
    const { data: linked, error } = await admin
      .from('guardian')
      .update({ stripe_customer_id: customerId })
      .eq('id', guardian.id)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .maybeSingle();
    if (error) return failure('Could not start checkout.', 500, error.message);

    // A concurrent checkout may have won the compare-and-set. Read the row back
    // and use the canonical id rather than leaving two customers attached to one
    // guardian in our own process.
    if (!linked?.stripe_customer_id) {
      const { data: canonical, error: canonicalError } = await admin
        .from('guardian')
        .select('stripe_customer_id')
        .eq('id', guardian.id)
        .single();
      if (canonicalError || !canonical?.stripe_customer_id) {
        return failure('Could not start checkout.', 500, canonicalError?.message);
      }
      customerId = canonical.stripe_customer_id;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: guardian.id,
    metadata: { guardian_id: guardian.id },
    subscription_data: { metadata: { guardian_id: guardian.id } },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appOrigin}${returnTo}${returnTo.includes('?') ? '&' : '?'}billing=success`,
    cancel_url: `${appOrigin}${returnTo}${returnTo.includes('?') ? '&' : '?'}billing=cancelled`,
  });

  return json({ checkout_url: session.url });
}
