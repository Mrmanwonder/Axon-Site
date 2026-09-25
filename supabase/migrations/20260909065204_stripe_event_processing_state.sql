-- ============================================================================
-- A Stripe event is "seen" and "processed" at different moments
-- ============================================================================
-- Remediation P0-009. The webhook inserted the event id into stripe_event
-- BEFORE doing anything with it, and treated any insert error as a duplicate:
--
--     const { error: dupeError } = await sb.from('stripe_event').insert(...)
--     if (dupeError) return json({ received: true, deduplicated: true });
--
-- That is idempotent in the sense that nothing runs twice. It is also
-- idempotent in the sense that something can run zero times and never be
-- noticed:
--
--   1. the event is recorded;
--   2. the guardian update throws — a network blip, a 503, anything;
--   3. the handler returns 500 and Stripe retries, as designed;
--   4. the retry's insert conflicts on the primary key;
--   5. the handler reads that conflict as "already handled" and returns 2xx.
--
-- Stripe stops retrying. The row says the event was seen. The subscription was
-- never updated. A parent who paid is on the free tier, or a parent who
-- cancelled is still being treated as Pro, and nothing anywhere is red.
--
-- The same line also swallows every non-conflict insert error: a database
-- outage during that insert was reported to Stripe as successful deduplication.
--
-- So "seen" and "processed" become two different facts with two different
-- columns, and only the second one ends Stripe's retries.
-- ============================================================================

alter table public.stripe_event
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at          timestamptz,
  add column if not exists attempt_count         int not null default 0,
  add column if not exists last_error            text;

comment on column public.stripe_event.processed_at is
  'When the subscription mutation this event describes actually succeeded. Null means the event has been seen and NOT applied — the only state that may end in a retry. Nothing but finish_stripe_event() sets this.';
comment on column public.stripe_event.processing_started_at is
  'Start of the current in-flight attempt, and the lease a concurrent redelivery loses. Cleared on failure so the next delivery can reclaim immediately.';
comment on column public.stripe_event.last_error is
  'Why the last attempt failed. Kept so an unprocessed event can be diagnosed without correlating logs by timestamp.';

-- Rows that predate this migration were written by the old handler, which
-- recorded before processing — so whether their mutation succeeded is not
-- recoverable from the data. They are marked processed rather than left
-- pending, deliberately: replaying a months-old subscription event would write
-- a stale status over the current one, and a wrong "Pro is paused" shown to a
-- parent who is paying is worse than an unrepaired historical gap. Any real
-- drift is repaired by the next live event for that subscription.
update public.stripe_event
   set processed_at = received_at
 where processed_at is null;

-- ── claiming ───────────────────────────────────────────────────────────────

create or replace function public.claim_stripe_event(p_id text, p_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_processed timestamptz;
  v_started   timestamptz;
  v_rows      int;
begin
  insert into public.stripe_event (id, type) values (p_id, p_type)
  on conflict (id) do nothing;

  select se.processed_at, se.processing_started_at
    into v_processed, v_started
    from public.stripe_event se
   where se.id = p_id
     for update;

  -- The genuine duplicate: this event's mutation already succeeded. This is
  -- the only path that may report success without doing anything.
  if v_processed is not null then
    return 'duplicate';
  end if;

  -- Someone else is mid-attempt. Five minutes is well past any handler that is
  -- still alive, so a lease older than that belonged to one that died.
  update public.stripe_event se
     set processing_started_at = now(),
         attempt_count         = se.attempt_count + 1
   where se.id = p_id
     and se.processed_at is null
     and (se.processing_started_at is null
          or se.processing_started_at < now() - interval '5 minutes');

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 'in_flight';
  end if;

  return 'claimed';
end;
$$;

revoke all on function public.claim_stripe_event(text, text) from public, anon, authenticated;

comment on function public.claim_stripe_event is
  'Records the event if new and claims the right to process it. Returns duplicate (already applied — safe to 2xx), in_flight (another attempt holds the lease — retry later), or claimed. Never reports duplicate for an event whose mutation has not succeeded.';

-- ── finishing ──────────────────────────────────────────────────────────────

create or replace function public.finish_stripe_event(p_id text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_error is null then
    update public.stripe_event
       set processed_at = now(), processing_started_at = null, last_error = null
     where id = p_id;
  else
    -- Lease released, processed_at untouched. The next delivery reclaims
    -- immediately rather than waiting out a lease that nobody holds.
    update public.stripe_event
       set processing_started_at = null, last_error = left(p_error, 2000)
     where id = p_id;
  end if;

  if not found then
    raise exception 'no stripe_event row for %', p_id using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.finish_stripe_event(text, text) from public, anon, authenticated;

comment on function public.finish_stripe_event is
  'Marks an event applied, or records why it was not. Called with an error, it leaves processed_at null so Stripe''s next retry is accepted rather than deduplicated away.';

-- ── what is stuck ──────────────────────────────────────────────────────────
--
-- P0-009 asks for an operational view listing unprocessed events. Without one,
-- the failure this migration exists to prevent is invisible even after it is
-- possible to detect: nobody queries a table they have no reason to think
-- about.

create or replace view private.stripe_event_unprocessed as
  select id, type, received_at, processing_started_at, attempt_count, last_error,
         now() - received_at as age
    from public.stripe_event
   where processed_at is null
   order by received_at;

revoke all on private.stripe_event_unprocessed from public, anon, authenticated;

comment on view private.stripe_event_unprocessed is
  'Stripe events seen but not applied. A non-empty row older than a few minutes means a family''s entitlement does not match what they have paid for. Alert on the oldest age, per the observability spec.';

create index if not exists stripe_event_unprocessed_idx
  on public.stripe_event (received_at)
  where processed_at is null;
