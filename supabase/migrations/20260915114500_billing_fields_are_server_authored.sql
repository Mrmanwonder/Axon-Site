-- ============================================================================
-- Security remediation: guardian billing state is server-authored
-- ============================================================================
--
-- Finding BILLING-001 (2026-09-15): the authenticated guardian UPDATE policy
-- correctly restricts a session to its own row, but PostgreSQL grants UPDATE on
-- every guardian column. The only existing guardian trigger protects identity
-- verification fields. That left these billing-authority fields client-writable:
--
--   subscription_status, subscription_plan, subscription_renews_at,
--   subscription_grace_until, stripe_customer_id, stripe_subscription_id
--
-- `private.guardian_is_pro()` trusts subscription_status. A modified client can
-- therefore turn its own free row into `pro` and all server-side entitlement
-- gates will honour it. Stripe ids are authority-bearing too and must not be
-- attachable by a browser.
--
-- Checkout has been changed to resolve the caller through RLS first and then use
-- service_role for the one narrow stripe_customer_id write. Stripe webhook
-- writes already use service_role. After that function is deployed, this trigger
-- makes direct browser INSERT/UPDATE of billing fields fail closed.
-- ============================================================================

create or replace function private.guardian_billing_is_server_authored()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  -- PostgREST executes a signed-in user's mutation as the `authenticated` DB
  -- role. service_role/webhook/admin writes deliberately bypass this guard.
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      -- Defaults are safe. Any non-default billing authority supplied by the
      -- client is an attempt to author server state.
      if new.subscription_status is distinct from 'free'::public.subscription_status
      or new.subscription_plan is not null
      or new.subscription_renews_at is not null
      or new.subscription_grace_until is not null
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null then
        raise exception 'billing columns are server-authored'
          using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.subscription_status is distinct from old.subscription_status
      or new.subscription_plan is distinct from old.subscription_plan
      or new.subscription_renews_at is distinct from old.subscription_renews_at
      or new.subscription_grace_until is distinct from old.subscription_grace_until
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
        raise exception 'billing columns are server-authored'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guardian_billing_is_server_authored() from public, anon, authenticated;

drop trigger if exists guardian_billing_server_authored on public.guardian;
create trigger guardian_billing_server_authored
before insert or update on public.guardian
for each row execute function private.guardian_billing_is_server_authored();

comment on function private.guardian_billing_is_server_authored is
  'Rejects authenticated-client authorship of subscription and Stripe identity fields. Only trusted server/service-role paths may change billing authority.';
comment on trigger guardian_billing_server_authored on public.guardian is
  'Billing state and Stripe linkage are server-authored even though a guardian may update ordinary fields on their own row.';
