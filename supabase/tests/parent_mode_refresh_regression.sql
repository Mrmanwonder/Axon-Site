-- Regression suite for security finding AUTH-002.
-- A background refresh must never become proof that a guardian is physically
-- present on the shared device.

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

set local role authenticated;

-- A refresh-only token is valid session maintenance, not parent presence.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'token_refresh',
        'timestamp', floor(extract(epoch from (now() - interval '10 seconds')))::bigint
      )
    )
  )::text,
  true
);
select public._t(
  'recent token_refresh alone does not unlock Parent Mode',
  private.has_fresh_auth() = false
);
select public._t(
  'refresh-only AMR has no interactive authentication age',
  private.auth_age() is null
);

-- The important real-world shape: the parent authenticated hours ago, then the
-- SDK silently refreshed the session moments ago. The newer refresh must not
-- replace the old interactive timestamp.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'otp',
        'timestamp', floor(extract(epoch from (now() - interval '4 hours')))::bigint
      ),
      jsonb_build_object(
        'method', 'token_refresh',
        'timestamp', floor(extract(epoch from (now() - interval '5 seconds')))::bigint
      )
    )
  )::text,
  true
);
select public._t(
  'new refresh cannot revive an old guardian authentication',
  private.has_fresh_auth() = false
);
select public._t(
  'auth_age still reflects the old interactive authentication',
  private.auth_age() between interval '3 hours 59 minutes' and interval '4 hours 1 minute',
  private.auth_age()::text
);

-- A real OTP remains valid even when a still-newer refresh follows it.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'amr', jsonb_build_array(
      jsonb_build_object(
        'method', 'otp',
        'timestamp', floor(extract(epoch from (now() - interval '30 seconds')))::bigint
      ),
      jsonb_build_object(
        'method', 'token_refresh',
        'timestamp', floor(extract(epoch from (now() - interval '1 second')))::bigint
      )
    )
  )::text,
  true
);
select public._t(
  'recent OTP still unlocks Parent Mode',
  private.has_fresh_auth() = true
);
select public._t(
  'newer refresh does not replace the OTP timestamp',
  private.auth_age() between interval '20 seconds' and interval '45 seconds',
  private.auth_age()::text
);

reset role;

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
from public._r;
select * from public._r where not passed order by seq;

rollback;
