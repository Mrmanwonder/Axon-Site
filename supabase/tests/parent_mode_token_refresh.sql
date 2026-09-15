-- Regression test for 20260915110000_parent_mode_ignore_token_refresh.sql.
-- A fresh token_refresh AMR entry must not replace the age of the last actual
-- authentication event. Parent Mode is a proof-of-presence gate, not a token
-- lifetime gate.

begin;

create table public._r_refresh (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r_refresh to authenticated, anon;
grant usage, select on sequence public._r_refresh_seq_seq to authenticated, anon;

create or replace function public._t_refresh(n text, p boolean, d text default null)
returns void language sql as $$
  insert into public._r_refresh (name, passed, detail) values (n, p, d);
$$;
grant execute on function public._t_refresh(text, boolean, text) to authenticated, anon;

set local role authenticated;

-- Four-hour-old OTP plus a token refresh seconds ago: still stale.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'amr', jsonb_build_array(
      jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from (now() - interval '4 hours')))::bigint),
      jsonb_build_object('method', 'token_refresh', 'timestamp', floor(extract(epoch from (now() - interval '5 seconds')))::bigint)
    )
  )::text,
  true
);
select public._t_refresh(
  'a fresh token refresh cannot reopen stale Parent Mode',
  private.has_fresh_auth() = false,
  private.auth_age()::text
);
select public._t_refresh(
  'auth age follows the last real authentication, not token rotation',
  private.auth_age() between interval '3 hours 59 minutes' and interval '4 hours 1 minute',
  private.auth_age()::text
);

-- A genuinely recent OTP remains fresh even when a refresh is newer.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'amr', jsonb_build_array(
      jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from (now() - interval '30 seconds')))::bigint),
      jsonb_build_object('method', 'token_refresh', 'timestamp', floor(extract(epoch from (now() - interval '5 seconds')))::bigint)
    )
  )::text,
  true
);
select public._t_refresh(
  'a genuinely recent authentication still opens Parent Mode',
  private.has_fresh_auth() = true,
  private.auth_age()::text
);

-- A token containing only token_refresh proves no person was present.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'role', 'authenticated',
    'amr', jsonb_build_array(
      jsonb_build_object('method', 'token_refresh', 'timestamp', floor(extract(epoch from now()))::bigint)
    )
  )::text,
  true
);
select public._t_refresh(
  'token_refresh by itself fails closed',
  private.has_fresh_auth() = false and private.auth_age() is null
);

reset role;

select count(*) as total,
       count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed
  from public._r_refresh;
select seq, name, detail from public._r_refresh where not passed order by seq;

rollback;
