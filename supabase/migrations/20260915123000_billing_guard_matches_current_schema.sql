-- ============================================================================
-- Billing guard must match the current guardian schema
-- ============================================================================
--
-- 20260902120000_past_due_ends_pro_immediately.sql deliberately removed
-- subscription_grace_until when the product stopped granting a payment grace
-- window. 20260915114500_billing_fields_are_server_authored.sql later added a
-- client-write guard but accidentally referenced that retired column from NEW
-- and OLD. PL/pgSQL accepts that function definition, then raises at runtime
-- when the trigger fires because the guardian row type no longer has the field.
--
-- Do not rewrite either historical migration: production may already have
-- recorded them as applied. Replace the trigger function forward so existing
-- databases and fresh databases converge on the same safe definition.
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

revoke all on function private.guardian_billing_is_server_authored() from public, anon, authenticated;

comment on function private.guardian_billing_is_server_authored is
  'Rejects authenticated-client authorship of current subscription and Stripe identity fields. Matches the post-20260902 guardian schema, where subscription_grace_until no longer exists.';
