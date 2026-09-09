// Stripe webhook: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_failed.
//
// The one deliberate service_role exception in this codebase. AGENTS.md's
// "nothing in the pipeline runs as service_role" is about the scanning
// pipeline, where a service-role bug could write one student's marks onto
// another student's paper. Stripe carries no Supabase user JWT -- there is no
// caller session to build an RLS-scoped client from -- so this function has no
// other way to run. The blast radius is kept narrow on purpose: every write
// below touches only public.guardian's four subscription columns and
// public.stripe_event, by primary key, from fields Stripe itself reports.
// Nothing here ever reads or writes a paper, an attempt, a mark or an
// explanation.
//
// ── Idempotency, and the difference between seen and applied ──────────────
//
// This handler used to insert the event id before doing any work and treat any
// insert error as a duplicate. That made a failed event permanently
// deduplicated: the mutation threw, the 500 asked Stripe to retry, and the
// retry hit the primary key it had already written and was told the event was
// handled. Stripe stopped. The subscription was never updated, and nothing
// anywhere said so.
//
// So the ledger now records two different facts. `claim_stripe_event` returns:
//
//   duplicate  the mutation already SUCCEEDED. The only case that may 2xx
//              without doing anything.
//   in_flight  another delivery holds the lease. 409, so Stripe comes back.
//   claimed    ours to process.
//
// and `finish_stripe_event` sets processed_at only on success. A failure
// leaves it null and releases the lease, so the next retry is accepted rather
// than swallowed. private.stripe_event_unprocessed lists whatever is stuck.
//
// The other half of P0-009 is that every Supabase result below is checked.
// `const { data } = await ...` turns a database outage into "no such guardian"
// and then into a silently skipped update, which is the same class of bug one
// layer down.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@18';
import { CORS, json } from '../_shared/http.ts';
import { planForPriceId, stripeClient } from '../_shared/stripe.ts';

type ServiceClient = ReturnType<typeof serviceClient>;

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** A Postgres error is not an empty result. Everything that matters to a
    family's entitlement goes through here, so a failure becomes a throw --
    which becomes an unprocessed event and a Stripe retry -- rather than a
    variable that happens to be null. */
function must<T>(result: { data: T; error: unknown }, context: string): T {
  if (result.error) {
    const e = result.error as { message?: string; code?: string };
    throw new Error(`${context}: ${e.code ? `[${e.code}] ` : ''}${e.message ?? String(result.error)}`);
  }
  return result.data;
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
    // Not retryable and not ours: an unverifiable body is never processed, so
    // it never reaches the ledger.
    return json({ error: `signature verification failed: ${(err as Error).message}` }, 400);
  }

  const sb = serviceClient();

  // Claim. A failure here is a database failure, not a duplicate, and must
  // reach Stripe as one -- reporting success would drop the event for good.
  let claim: string;
  try {
    claim = must(
      await sb.rpc('claim_stripe_event', { p_id: event.id, p_type: event.type }),
      'claim_stripe_event',
    ) as string;
  } catch (err) {
    return json({ error: (err as Error).message }, 503);
  }

  if (claim === 'duplicate') return json({ received: true, deduplicated: true });
  if (claim === 'in_flight') {
    return json({ error: 'another delivery of this event is being processed' }, 409);
  }

  try {
    await handle(sb, stripe, event);
  } catch (err) {
    const message = (err as Error).message;
    // Record why, best-effort: if even this write fails the event simply stays
    // unprocessed with a stale lease, which the five-minute lease window in
    // claim_stripe_event releases on the next delivery. Either way processed_at
    // stays null, which is the property that matters.
    await sb.rpc('finish_stripe_event', { p_id: event.id, p_error: message })
      .then(({ error }) => { if (error) console.error('finish_stripe_event failed', error); });
    return json({ error: message }, 500);
  }

  // Only now is the event applied. If this write fails, Stripe retries and the
  // handler runs again -- every mutation below is a set-to-a-known-state, so a
  // second application is a no-op rather than a compounding change.
  const { error } = await sb.rpc('finish_stripe_event', { p_id: event.id, p_error: null });
  if (error) {
    return json({ error: `finish_stripe_event: ${error.message}` }, 500);
  }

  return json({ received: true });
});

async function handle(sb: ServiceClient, stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const guardianId = session.client_reference_id ?? session.metadata?.guardian_id;
      if (!guardianId || !session.subscription) return;
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      await applySubscriptionState(sb, guardianId, subscription);
      return;
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const guardianId = await guardianIdFor(sb, subscription);
      if (guardianId) await applySubscriptionState(sb, guardianId, subscription);
      return;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const guardianId = await guardianIdFor(sb, subscription);
      if (!guardianId) return;
      must(
        await sb.from('guardian').update({
          subscription_status: 'canceled',
          subscription_plan: null,
          subscription_renews_at: null,
        }).eq('id', guardianId).select('id'),
        'guardian cancel update',
      );
      return;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      // maybeSingle, not single: no guardian for this customer is a real and
      // legitimate state (an invoice for an account since deleted), whereas
      // single() reports it as an error indistinguishable from a failed read.
      const guardian = must(
        await sb.from('guardian')
          .select('id, subscription_status').eq('stripe_customer_id', customerId).maybeSingle(),
        'guardian lookup by customer',
      );
      if (!guardian) return;
      // A failed payment ends Pro entitlement here, on the first failure --
      // there is no grace window (see migration 0024). Stripe's Smart
      // Retries keep running; a retry that succeeds arrives as
      // customer.subscription.updated with status active and restores Pro
      // through applySubscriptionState below.
      //
      // Guarded on the current status so a late-arriving failed invoice for
      // an already-canceled subscription cannot resurrect it as past_due,
      // which would read to the parent as "your payment failed" about a
      // subscription they deliberately ended.
      if (guardian.subscription_status !== 'canceled') {
        must(
          await sb.from('guardian')
            .update({ subscription_status: 'past_due' }).eq('id', guardian.id).select('id'),
          'guardian past_due update',
        );
      }
      return;
    }
    default:
      // Every other event type is a deliberate no-op: this handler only
      // ever exists to keep subscription_status in sync.
      return;
  }
}

async function guardianIdFor(sb: ServiceClient, subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.guardian_id) return subscription.metadata.guardian_id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;
  const data = must(
    await sb.from('guardian').select('id').eq('stripe_customer_id', customerId).maybeSingle(),
    'guardian lookup by customer',
  );
  return data?.id ?? null;
}

async function applySubscriptionState(
  sb: ServiceClient, guardianId: string, subscription: Stripe.Subscription,
) {
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const plan = planForPriceId(priceId);
  // Basil (2025-03-31.basil, pinned in _shared/stripe.ts) removed
  // current_period_end from Subscription and put it on each subscription ITEM.
  // Read the item first and keep the legacy field as a fallback, so a redelivery
  // of an event serialised under the old version still resolves rather than
  // silently writing a null renewal date -- which would read to a parent as a
  // subscription with no next payment.
  const periodEndUnix = subscription.items.data[0]?.current_period_end
    ?? (subscription as unknown as { current_period_end?: number }).current_period_end;
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;

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

  // Derived wholly from the subscription object Stripe sent, so applying the
  // same event twice writes the same row -- which is what makes a retry after
  // a partial failure safe.
  const updated = must(
    await sb.from('guardian').update({
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      subscription_status: status,
      subscription_plan: plan,
      subscription_renews_at: periodEnd,
      // Status is the whole story now: past_due resolves to the free tier the
      // moment it is written, and active/trialing restores Pro the moment the
      // retry clears. Nothing is deferred, so there is no deadline to carry.
    }).eq('id', guardianId).select('id'),
    'guardian subscription update',
  );

  // An update that matched nothing is not a success. It means this event names
  // a guardian that does not exist, and silently returning 2xx would retire the
  // event with the subscription state never written anywhere.
  if (!updated || updated.length === 0) {
    throw new Error(`no guardian ${guardianId} to apply subscription ${subscription.id} to`);
  }
}
