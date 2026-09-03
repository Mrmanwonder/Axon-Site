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
  try {
    return await checkout(req);
  } catch (err) {
    // Everything below can throw: a missing secret (stripeClient, priceIdFor),
    // or Stripe itself. Unhandled, that reaches the client as "Edge Function
    // returned a non-2xx status code", which tells a parent nothing and sends
    // whoever debugs it looking in the wrong place. Hard rule 4 applies to
    // errors as much as to pages: say what is missing.
    return failure((err as Error).message || 'Checkout could not be started.', 500);
  }
});

/**
 * The origin Stripe returns the payer to.
 *
 * MASTERY_APP_ORIGIN is the billing-specific override and wins where it is set.
 * AXON_SITE_URL is the project-wide site origin that DEPLOY.md §1 has always
 * asked for and that `_shared/openrouter.ts` already reads — billing was the
 * only thing in the codebase demanding a second, differently-branded name for
 * the same value, which is exactly how it came to be unset while everything
 * else worked.
 *
 * Trailing slashes are trimmed because every caller appends an absolute path:
 * an origin stored as "https://site/" would otherwise produce "https://site//".
 */
function originForReturn(): string {
  const raw = Deno.env.get('MASTERY_APP_ORIGIN') ?? Deno.env.get('AXON_SITE_URL') ?? '';
  return raw.trim().replace(/\/+$/, '');
}

async function checkout(req: Request): Promise<Response> {
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

  const { data: guardian, error: guardianError } = await sb.from('guardian')
    .select('id, name, contact, stripe_customer_id').single();
  // A failed QUERY and a missing ROW are different answers, and reporting both
  // as "no guardian account" once cost a day: the billing migration had not
  // been applied, PostgREST said `column guardian.stripe_customer_id does not
  // exist`, and the error was dropped on the floor while a parent with a
  // perfectly good account was told they had none. PGRST116 is the only code
  // that actually means no row.
  if (guardianError && guardianError.code !== 'PGRST116') {
    return failure('Could not read your account.', 500, guardianError.message);
  }
  if (!guardian) return failure('No guardian account for this session.', 404);

  const appOrigin = originForReturn();
  if (!appOrigin) {
    return failure('Checkout is not configured yet.', 500,
      'Set AXON_SITE_URL (or MASTERY_APP_ORIGIN, which overrides it) on the project.');
  }

  // Resolved before a Stripe Customer is created, and reported in words rather
  // than by letting priceIdFor throw the name of an environment variable at a
  // parent. A plan whose price has not been configured yet is a real state --
  // the annual price may simply not exist in the Stripe account -- and it is
  // the one thing here a parent can act on: the other plan still works.
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
    line_items: [{ price: priceId, quantity: 1 }],
    // No automatic_tax. Both prices carry tax_behavior: inclusive, and the
    // launch decision is explicit: the price a parent is quoted is the price
    // they pay, with no separate tax calculation layer built for this launch.
    //
    // It is also not optional to leave it off right now. Stripe Tax on this
    // account is status: pending (no head_office), and Checkout rejects a
    // session requesting automatic_tax while Tax is inactive -- which is a
    // 500 at the moment a parent presses Subscribe, not a warning anywhere
    // earlier. Turning it back on is one line here PLUS activating Tax on the
    // account; doing the line alone breaks checkout outright.
    success_url: `${appOrigin}${returnTo}${returnTo.includes('?') ? '&' : '?'}billing=success`,
    cancel_url: `${appOrigin}${returnTo}${returnTo.includes('?') ? '&' : '?'}billing=cancelled`,
  });

  return json({ checkout_url: session.url });
}
