-- ============================================================================
-- Test suite: a Stripe event is seen and applied at different moments
-- ============================================================================
-- Remediation P0-009. The bug this suite exists to keep fixed is a sequence,
-- not a state, so the assertions walk it step by step:
--
--   1. Stripe delivers evt_1.
--   2. The handler claims it and starts work.
--   3. The guardian update fails.
--   4. The handler returns 500. Stripe will retry.
--   5. Stripe retries evt_1.
--
-- Under the old ledger step 5 found the primary key already written and
-- reported the event as a duplicate, so Stripe stopped and the subscription
-- was never updated. A parent who paid stayed on the free tier, permanently,
-- with nothing anywhere showing a problem. The assertion that matters is that
-- step 5 now returns 'claimed'.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/stripe_event_processing.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._r to authenticated, anon;
grant usage, select on sequence public._r_seq_seq to authenticated, anon;
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;
grant execute on function public._t(text, boolean, text) to authenticated, anon;

-- ══════════════════════════════════════════════════════════════════════════
-- The failure-then-retry sequence
-- ══════════════════════════════════════════════════════════════════════════

select public._t('a new event is claimed',
  public.claim_stripe_event('evt_fail_then_retry', 'customer.subscription.updated') = 'claimed');

select public._t('claiming records the event as seen',
  (select count(*) = 1 from public.stripe_event where id = 'evt_fail_then_retry'));

select public._t('but not as applied',
  (select processed_at is null from public.stripe_event where id = 'evt_fail_then_retry'));

-- Step 3: the mutation fails and the handler says so.
select public.finish_stripe_event('evt_fail_then_retry', 'guardian subscription update: [57014] canceling statement');

select public._t('a failed event is still not applied',
  (select processed_at is null from public.stripe_event where id = 'evt_fail_then_retry'));

select public._t('and records why',
  (select last_error like '%57014%' from public.stripe_event where id = 'evt_fail_then_retry'));

select public._t('and releases its lease, so the retry need not wait it out',
  (select processing_started_at is null from public.stripe_event where id = 'evt_fail_then_retry'));

-- Step 5. THE assertion. Under the old handler this was a duplicate.
select public._t('Stripe''s retry of a failed event is claimed, not deduplicated',
  public.claim_stripe_event('evt_fail_then_retry', 'customer.subscription.updated') = 'claimed');

select public._t('the retry counts as a second attempt',
  (select attempt_count = 2 from public.stripe_event where id = 'evt_fail_then_retry'));

select public.finish_stripe_event('evt_fail_then_retry', null);

select public._t('a successful attempt marks the event applied',
  (select processed_at is not null from public.stripe_event where id = 'evt_fail_then_retry'));

select public._t('and clears the error it recovered from',
  (select last_error is null from public.stripe_event where id = 'evt_fail_then_retry'));

-- ══════════════════════════════════════════════════════════════════════════
-- The genuine duplicate
-- ══════════════════════════════════════════════════════════════════════════
-- Deduplication still has to work, or this fix has traded a silent gap for
-- double-applied subscription changes.

select public._t('a redelivery after success is a duplicate',
  public.claim_stripe_event('evt_fail_then_retry', 'customer.subscription.updated') = 'duplicate');

select public._t('and does not count as another attempt',
  (select attempt_count = 2 from public.stripe_event where id = 'evt_fail_then_retry'));

-- ══════════════════════════════════════════════════════════════════════════
-- Two deliveries at once
-- ══════════════════════════════════════════════════════════════════════════
-- Stripe can deliver the same event twice concurrently. The second must not
-- run the mutation alongside the first, and must not be told it is done.

select public._t('a fresh event is claimed once',
  public.claim_stripe_event('evt_concurrent', 'customer.subscription.updated') = 'claimed');

select public._t('a delivery arriving mid-flight is held off, not deduplicated',
  public.claim_stripe_event('evt_concurrent', 'customer.subscription.updated') = 'in_flight');

-- A handler that died holding the lease must not block the event forever.
update public.stripe_event
   set processing_started_at = now() - interval '10 minutes'
 where id = 'evt_concurrent';

select public._t('an expired lease from a dead handler is reclaimable',
  public.claim_stripe_event('evt_concurrent', 'customer.subscription.updated') = 'claimed');

-- ══════════════════════════════════════════════════════════════════════════
-- Operational visibility
-- ══════════════════════════════════════════════════════════════════════════
-- A failure nobody can see is only marginally better than one that cannot
-- happen to be noticed.

select public._t('an unapplied event is listed as unprocessed',
  (select count(*) = 1 from private.stripe_event_unprocessed where id = 'evt_concurrent'));

select public._t('an applied event is not',
  (select count(*) = 0 from private.stripe_event_unprocessed where id = 'evt_fail_then_retry'));

-- ══════════════════════════════════════════════════════════════════════════
-- Nothing but the service role
-- ══════════════════════════════════════════════════════════════════════════
-- These two functions can retire a billing event. They are SECURITY DEFINER,
-- so a stray grant would be a way for any signed-in browser to mark a
-- subscription event handled.

select public._t('authenticated cannot claim an event',
  not has_function_privilege('authenticated', 'public.claim_stripe_event(text,text)', 'execute'));
select public._t('authenticated cannot finish an event',
  not has_function_privilege('authenticated', 'public.finish_stripe_event(text,text)', 'execute'));
select public._t('anon cannot claim an event',
  not has_function_privilege('anon', 'public.claim_stripe_event(text,text)', 'execute'));

-- Finishing an event that was never claimed is a bug in the caller, not a
-- silent no-op: it means the ledger and the handler disagree about what exists.
do $$ begin
  perform public.finish_stripe_event('evt_never_seen', null);
  perform public._t('finishing an unknown event raises', false, 'the call succeeded');
exception when no_data_found then
  perform public._t('finishing an unknown event raises', true);
when others then
  perform public._t('finishing an unknown event raises', false, sqlerrm);
end $$;

-- ── report ─────────────────────────────────────────────────────────────────

select count(*) as total,
       count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed
from public._r;

select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
