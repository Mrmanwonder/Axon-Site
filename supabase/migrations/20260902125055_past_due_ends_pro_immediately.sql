-- ============================================================================
-- 0024 · A past-due account loses Pro immediately
-- ============================================================================
-- Reverses the 7-day grace window introduced in 0011. The decision is explicit:
-- a failed payment ends Pro entitlement at the moment Stripe reports it, not
-- seven days later. Stripe's own Smart Retries still run and a successful retry
-- restores Pro on the next `customer.subscription.updated` — what changes here
-- is only what the account is entitled to *while* the invoice is unpaid.
--
-- Three things this migration is careful about:
--
--   1. The line moves in exactly one place. `private.guardian_is_pro` is still
--      the only function that answers "is this account Pro", so every gate
--      (archive depth, cross-subject patterns, parent reports, profile limit,
--      queue priority) follows without being touched.
--   2. `subscription_grace_until` is dropped rather than left unread. A column
--      no code honours is an invitation to quietly reintroduce a grace period
--      on one gate and not the others; there is nothing left to disagree with.
--   3. The downgrade is never silent. `get_entitlements()` now also reports the
--      raw billing state, so the parent surface can say "the payment failed and
--      Pro is paused" instead of a free tier appearing out of nowhere. That
--      reason code is parent-facing only — the student's scan → understand →
--      act loop is unchanged and ungated, as it is on every tier.
--
-- Not changed, deliberately: nothing already created under Pro is taken away.
-- A guardian who added a second student profile keeps both children (the limit
-- trigger fires on INSERT only), and every paper stays in the library with its
-- date and marks. What lapses is depth on OLD papers and the four Pro reads.
-- ============================================================================

create or replace function private.guardian_is_pro(p_guardian uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select g.subscription_status in ('pro', 'pro_annual')
     from public.guardian g where g.id = p_guardian),
    false);
$$;

comment on function private.guardian_is_pro is
  'The single yes/no this whole gating layer reduces to. past_due resolves false immediately: a failed payment ends Pro entitlement the moment Stripe reports it, with no grace window. A successful Stripe retry flips the status back to pro and restores access on the same call path.';

alter table public.guardian drop column subscription_grace_until;

comment on type public.subscription_status is
  'free/past_due/canceled all resolve to the free tier. pro and pro_annual are the two paid plans. past_due is a paid plan whose invoice is unpaid — it is retained as a distinct value from free so the parent surface can explain the downgrade, not because it carries any entitlement.';

-- ── entitlements now carry their own reason code ────────────────────────────
-- Dropped and recreated rather than replaced: the composite return type gains
-- an attribute, and the function has to be out of the way while it does.

drop function public.get_entitlements();

alter type public.entitlements add attribute billing_state text;

comment on type public.entitlements is
  'billing_state is the guardian''s raw subscription_status, carried alongside the resolved tier so a downgrade can be explained rather than merely applied. It is a reason code for parent-facing copy — never a gate. Every gate reads tier/booleans, which are already resolved.';

create or replace function public.get_entitlements()
returns public.entitlements
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (
    select private.current_guardian_id() as guardian_id
  ), state as (
    select private.guardian_is_pro(me.guardian_id) as is_pro,
           (select g.subscription_status from public.guardian g where g.id = me.guardian_id) as status
    from me
  )
  select (
    case when state.is_pro then 'pro' else 'free' end,
    state.is_pro,
    state.is_pro,
    state.is_pro,
    state.is_pro,
    case when state.is_pro then null else 1 end,
    coalesce(state.status::text, 'free')
  )::public.entitlements
  from state;
$$;

comment on function public.get_entitlements is
  'The one function every Pro-gated feature (client and server alike) calls. Resolves from auth.uid() via current_guardian_id() — nothing to pass, nothing to spoof.';

revoke all on function public.get_entitlements() from public, anon;
grant execute on function public.get_entitlements() to authenticated;
