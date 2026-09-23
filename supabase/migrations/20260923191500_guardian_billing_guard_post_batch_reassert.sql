-- ============================================================================
-- Reassert guardian billing guard after late-applied security migrations
-- ============================================================================
--
-- Production applied 20260915123000_billing_guard_matches_current_schema before
-- 20260915114500_billing_fields_are_server_authored. The latter therefore
-- replaced the corrected trigger function with its older definition, which
-- references the retired subscription_grace_until column. Any authenticated
-- guardian INSERT/UPDATE then failed at runtime with:
--
--   record "new" has no field "subscription_grace_until"
--
-- Keep this as a forward migration. Do not rewrite historical migrations:
-- existing databases have already recorded them as applied.
-- ============================================================================

create or replace function private.guardian_billing_is_server_authored()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  -- PostgREST executes signed-in user mutations as the authenticated DB role.
  -- Trusted service-role/webhook/admin writes deliberately bypass this guard.
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.subscription_status is distinct from 'free'::public.subscription_status
      or new.subscription_plan is not null
      or new.subscription_renews_at is not null
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null then
        raise exception 'billing columns are server-authored'
          using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.subscription_status is distinct from old.subscription_status
      or new.subscription_plan is distinct from old.subscription_plan
      or new.subscription_renews_at is distinct from old.subscription_renews_at
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

revoke all on function private.guardian_billing_is_server_authored()
  from public, anon, authenticated;

comment on function private.guardian_billing_is_server_authored is
  'Rejects authenticated-client authorship of current subscription and Stripe identity fields. Reasserted after the late-applied billing security migration reintroduced a reference to retired subscription_grace_until.';
