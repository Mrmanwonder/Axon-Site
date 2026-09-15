-- Regression suite for BILLING-001.
-- A guardian owns their row, but owning the row must never mean owning the
-- subscription authority carried by its billing columns.

begin;

create table public._r (
  seq serial primary key,
  name text,
  passed boolean,
  detail text
);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$
  insert into public._r (name, passed, detail) values (n, p, d);
$$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   'c3333333-3333-4333-8333-333333333333',
   'authenticated', 'authenticated', 'billing-security@test.invalid', 'x', now(), now(), now());

insert into public.guardian
  (id, auth_user_id, name, contact)
values
  ('c0000000-0000-4000-8000-000000000001',
   'c3333333-3333-4333-8333-333333333333',
   'Billing Test', 'billing-security@test.invalid');

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}';

-- Ordinary owner-editable profile state still works.
do $$ begin
  update public.guardian
     set name = 'Billing Test Updated'
   where id = 'c0000000-0000-4000-8000-000000000001';
  perform public._t('ordinary guardian profile update still works', true);
exception when others then
  perform public._t('ordinary guardian profile update still works', false, sqlerrm);
end $$;

-- The exact pre-fix privilege escalation must fail.
do $$ begin
  update public.guardian
     set subscription_status = 'pro'
   where id = 'c0000000-0000-4000-8000-000000000001';
  perform public._t('client cannot self-upgrade subscription_status', false, 'update succeeded');
exception when sqlstate '42501' then
  perform public._t('client cannot self-upgrade subscription_status', true);
when others then
  perform public._t('client cannot self-upgrade subscription_status', false, sqlstate || ': ' || sqlerrm);
end $$;

-- Stripe identity must be equally server-authored.
do $$ begin
  update public.guardian
     set stripe_customer_id = 'cus_client_supplied'
   where id = 'c0000000-0000-4000-8000-000000000001';
  perform public._t('client cannot attach a Stripe customer id', false, 'update succeeded');
exception when sqlstate '42501' then
  perform public._t('client cannot attach a Stripe customer id', true);
when others then
  perform public._t('client cannot attach a Stripe customer id', false, sqlstate || ': ' || sqlerrm);
end $$;

reset role;

-- Trusted server paths must still be able to author billing state. The local
-- suite runs this as postgres, which represents the same database trust side of
-- the boundary as service_role without embedding a service key in a test.
do $$ begin
  update public.guardian
     set subscription_status = 'pro',
         subscription_plan = 'monthly',
         stripe_customer_id = 'cus_server_authored'
   where id = 'c0000000-0000-4000-8000-000000000001';
  perform public._t(
    'trusted server write can author billing state',
    exists (
      select 1 from public.guardian
       where id = 'c0000000-0000-4000-8000-000000000001'
         and subscription_status = 'pro'
         and stripe_customer_id = 'cus_server_authored'
    )
  );
exception when others then
  perform public._t('trusted server write can author billing state', false, sqlerrm);
end $$;

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._r;
select * from public._r where not passed order by seq;

rollback;
