-- ============================================================================
-- Test suite: guardian verification is server-authored
-- ============================================================================
-- Remediation P0-001. The build guard in src/verification.js stops the bundle
-- we ship from selecting a development adapter. It does nothing at all about a
-- bundle we did not ship — a tampered copy, a console call, a replayed
-- request — because all three speak to the database directly, as the
-- `authenticated` role, with a perfectly valid session.
--
-- So the claim under test here is the one the build guard cannot make:
--
--   a signed-in guardian cannot declare themselves verified.
--
-- Every assertion below runs as `authenticated` with a real JWT claim, which
-- is exactly the authority a browser has. Nothing here is about the UI.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/guardian_verification.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ── fixtures ───────────────────────────────────────────────────────────────
-- One unverified guardian, because the interesting question is how they become
-- verified rather than what a verified one can do.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','d4444444-4444-4444-8444-444444444444','authenticated','authenticated','verify@test.invalid','x',now(),now(),now());

insert into public.guardian (id, auth_user_id, name, contact) values
 ('dddddddd-0000-4000-8000-000000000001','d4444444-4444-4444-8444-444444444444','Guardian D','d@test.invalid');

-- ══════════════════════════════════════════════════════════════════════════
-- The default a fresh database gets
-- ══════════════════════════════════════════════════════════════════════════
-- This is the assertion that matters most, and it is about the migration
-- rather than about any function: production must be safe because it applied
-- the migration, not because someone remembered to set something afterwards.

select public._t('a fresh database refuses methods that prove nothing',
  private.config_flag('allow_unverified_verification_methods') = false);

select public._t('the stub is not a method that proves identity',
  private.verification_method_proves_identity('stub') = false);

select public._t('digilocker is a method that proves identity',
  private.verification_method_proves_identity('digilocker') = true);

select public._t('a null method proves nothing',
  private.verification_method_proves_identity(null) = false);

-- ══════════════════════════════════════════════════════════════════════════
-- As the browser: a guardian with a valid session
-- ══════════════════════════════════════════════════════════════════════════

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';

select public._t('the guardian can see their own row',
  (select count(*) = 1 from public.guardian));

select public._t('and starts unverified',
  (select verified_at is null from public.guardian where id='dddddddd-0000-4000-8000-000000000001'));

-- The exact call that used to work. It is the whole of P0-001's second half:
-- `sb.from('guardian').update({ verified_at, verification_method, ... })`.
do $$ begin
  update public.guardian
     set verified_at = now(), verification_method = 'digilocker', verification_ref = 'forged'
   where id = 'dddddddd-0000-4000-8000-000000000001';
  perform public._t('a guardian cannot write their own verification columns', false,
    'the UPDATE succeeded');
exception when insufficient_privilege then
  perform public._t('a guardian cannot write their own verification columns', true);
when others then
  perform public._t('a guardian cannot write their own verification columns', false, sqlerrm);
end $$;

-- Back-dating deserves its own test rather than being assumed to fall out of
-- the one above: a verification timed before a consent notice changed would
-- read as covering a notice it never saw.
do $$ begin
  update public.guardian
     set verified_at = now() - interval '400 days',
         verification_method = 'digilocker',
         verification_ref = 'backdated'
   where id = 'dddddddd-0000-4000-8000-000000000001';
  perform public._t('a guardian cannot back-date a verification', false, 'the UPDATE succeeded');
exception when insufficient_privilege then
  perform public._t('a guardian cannot back-date a verification', true);
when others then
  perform public._t('a guardian cannot back-date a verification', false, sqlerrm);
end $$;

-- The rest of the row still has to work, or this fix has broken the profile
-- screen to protect one column.
do $$ begin
  update public.guardian set name = 'Guardian D2'
   where id = 'dddddddd-0000-4000-8000-000000000001';
  perform public._t('an ordinary profile edit still works',
    (select name = 'Guardian D2' from public.guardian where id='dddddddd-0000-4000-8000-000000000001'));
exception when others then
  perform public._t('an ordinary profile edit still works', false, sqlerrm);
end $$;

-- ── the RPC, which is the only way in ─────────────────────────────────────

do $$ begin
  perform public.record_guardian_verification('stub', 'stub:whatever');
  perform public._t('the RPC refuses the stub on a production-default database', false,
    'the call succeeded');
exception when insufficient_privilege then
  perform public._t('the RPC refuses the stub on a production-default database', true);
when others then
  perform public._t('the RPC refuses the stub on a production-default database', false, sqlerrm);
end $$;

do $$ begin
  perform public.record_guardian_verification('not_a_method', 'ref');
  perform public._t('the RPC refuses a method outside the enum', false, 'the call succeeded');
exception when invalid_parameter_value then
  perform public._t('the RPC refuses a method outside the enum', true);
when others then
  perform public._t('the RPC refuses a method outside the enum', false, sqlerrm);
end $$;

do $$ begin
  perform public.record_guardian_verification('digilocker', '   ');
  perform public._t('the RPC refuses a blank reference', false, 'the call succeeded');
exception when invalid_parameter_value then
  perform public._t('the RPC refuses a blank reference', true);
when others then
  perform public._t('the RPC refuses a blank reference', false, sqlerrm);
end $$;

do $$ declare v_before timestamptz := now(); begin
  perform public.record_guardian_verification('digilocker', 'dl:real-reference');
  perform public._t('the RPC records a real method',
    (select verification_method = 'digilocker' and verification_ref = 'dl:real-reference'
       from public.guardian where id='dddddddd-0000-4000-8000-000000000001'));
  -- The caller never supplies the timestamp, so it cannot be anything but the
  -- server's own clock at the moment of the call.
  perform public._t('verified_at comes from the server clock',
    (select verified_at >= v_before from public.guardian where id='dddddddd-0000-4000-8000-000000000001'));
exception when others then
  perform public._t('the RPC records a real method', false, sqlerrm);
end $$;

-- Clearing one is a write too, and it has to be tested against a guardian who
-- is actually verified — null-to-null is not a change and would pass whatever
-- the trigger did. A guardian who could null these could shed a verification
-- and re-run onboarding against a newer notice version.
do $$ begin
  update public.guardian
     set verified_at = null, verification_method = null, verification_ref = null
   where id = 'dddddddd-0000-4000-8000-000000000001';
  perform public._t('a guardian cannot clear a verification they have', false,
    'the UPDATE succeeded');
exception when insufficient_privilege then
  perform public._t('a guardian cannot clear a verification they have', true);
when others then
  perform public._t('a guardian cannot clear a verification they have', false, sqlerrm);
end $$;

reset role;

-- ══════════════════════════════════════════════════════════════════════════
-- The opt-in, from the other side
-- ══════════════════════════════════════════════════════════════════════════
-- A local database is allowed to accept the stub. Asserting that the switch
-- actually switches is what stops it from being a decorative row that nobody
-- would notice had stopped working.

update private.app_config set value = 'true'::jsonb
 where key = 'allow_unverified_verification_methods';

select public._t('the opt-in flips',
  private.config_flag('allow_unverified_verification_methods') = true);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';

do $$ begin
  perform public.record_guardian_verification('stub', 'stub:dev');
  perform public._t('with the opt-in, a development database accepts the stub',
    (select verification_method = 'stub' from public.guardian where id='dddddddd-0000-4000-8000-000000000001'));
exception when others then
  perform public._t('with the opt-in, a development database accepts the stub', false, sqlerrm);
end $$;

reset role;

-- A missing row must read as "not permitted". A switch that fails open is
-- worse than no switch, because it looks like protection.
delete from private.app_config where key = 'allow_unverified_verification_methods';
select public._t('a missing switch reads as not permitted',
  private.config_flag('allow_unverified_verification_methods') = false);

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
