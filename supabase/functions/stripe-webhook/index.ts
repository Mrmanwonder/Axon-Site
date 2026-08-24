// Stripe webhook: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_failed.
//
// The one deliberate service_role exception in this codebase. AGENTS.md's
// "nothing in the pipeline runs as service_role" is about the scanning
// pipeline, where a service-role bug could write one student's marks onto
// another student's paper. Stripe carries no Supabase user JWT -- there is no
// caller session to build an RLS-scoped client from -- so this function has no
// other way to run. The blast radius is kept narrow on purpose: every write
// below touches only public.guardian's five subscription columns and
// public.stripe_event, by primary key, from fields Stripe itself reports.
// Nothing here ever reads or writes a paper, an attempt, a mark or an
// explanation.
//
// Idempotent by construction: every event id is written to stripe_event
// (primary key) before any guardian row is touched, and a duplicate delivery
// (Stripe retries on anything but a 2xx) short-circuits on the insert conflict.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';
import { CORS, json } from '../_shared/http.ts';
import { planForPriceId, stripeClient } from '../_shared/stripe.ts';

const GRACE_PERIOD_DAYS = 7;

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const signature = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !secret) return json({ error: 'Webhook is not configured.' }, 500);

  const rawBody = await req.text();
  const stripe = stripeClient();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    return json({ error: `signature verification failed: ${(err as Error).message}` }, 400);
  }

  const sb = serviceClient();

  // Idempotency gate. A duplicate delivery loses the insert race and this
  // returns success without touching guardian a second time.
  const { error: dupeError } = await sb.from('stripe_event').insert({ id: event.id, type: event.type });
  if (dupeError) {
    return json({ received: true, deduplicated: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const guardianId = session.client_reference_id ?? session.metadata?.guardian_id;
        if (!guardianId || !session.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await applySubscriptionState(sb, guardianId, subscription);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const guardianId = await guardianIdFor(sb, subscription);
        if (guardianId) await applySubscriptionState(sb, guardianId, subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const guardianId = await guardianIdFor(sb, subscription);
        if (guardianId) {
          await sb.from('guardian').update({
            subscription_status: 'canceled',
            subscription_plan: null,
            subscription_renews_at: null,
            subscription_grace_until: null,
          }).eq('id', guardianId);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;
        const { data: guardian } = await sb.from('guardian')
          .select('id, subscription_grace_until').eq('stripe_customer_id', customerId).single();
        if (!guardian) break;
        // Only set the grace deadline on the FIRST failure of a billing cycle
        // -- a retry that also fails must not keep pushing the deadline out,
        // or the 7-day grace period the thesis specifies never actually ends.
        if (!guardian.subscription_grace_until) {
          await sb.from('guardian').update({
            subscription_status: 'past_due',
            subscription_grace_until: new Date(Date.now() + GRACE_PERIOD_DAYS * 86_400_000).toISOString(),
          }).eq('id', guardian.id);
        }
        break;
      }
      default:
        // Every other event type is a deliberate no-op: this handler only
        // ever exists to keep subscription_status in sync.
        break;
    }
  } catch (err) {
    // The event stays recorded in stripe_event either way, so a processing
    // error surfaces as a 500 (Stripe retries) rather than a silent gap.
    return json({ error: (err as Error).message }, 500);
  }

  return json({ received: true });
});

async function guardianIdFor(sb: ReturnType<typeof serviceClient>, subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.guardian_id) return subscription.metadata.guardian_id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;
  const { data } = await sb.from('guardian').select('id').eq('stripe_customer_id', customerId).single();
  return data?.id ?? null;
}

async function applySubscriptionState(
  sb: ReturnType<typeof serviceClient>, guardianId: string, subscription: Stripe.Subscription,
) {
  const { data: current } = await sb.from('guardian')
    .select('subscription_status, subscription_grace_until').eq('id', guardianId).single();

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan = planForPriceId(priceId);
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  let status: 'pro' | 'pro_annual' | 'past_due' | 'canceled' | 'free';
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      status = plan === 'annual' ? 'pro_annual' : 'pro';
      break;
    case 'past_due':
    case 'unpaid':
      status = 'past_due';
      break;
    case 'canceled':
    case 'incomplete_expired':
      status = 'canceled';
      break;
    default:
      status = 'free';
  }

  await sb.from('guardian').update({
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    subscription_status: status,
    subscription_plan: plan,
    subscription_renews_at: periodEnd,
    // A subscription reporting healthy again (e.g. the retry succeeded)
    // clears any grace deadline from a previous failure. Staying past_due
    // across repeat deliveries keeps the ORIGINAL deadline -- same reasoning
    // as invoice.payment_failed below: a retry must not keep pushing the
    // 7-day grace window out indefinitely.
    subscription_grace_until: status === 'past_due'
      ? (current?.subscription_status === 'past_due' && current.subscription_grace_until
          ? current.subscription_grace_until
          : new Date(Date.now() + GRACE_PERIOD_DAYS * 86_400_000).toISOString())
      : null,
  }).eq('id', guardianId);
}
