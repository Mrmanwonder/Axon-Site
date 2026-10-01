-- AXO-124: model_call.cost_usd was null on 160 of 162 calls and extraction_run.cost_paise
-- was 0 on every run. Google's OpenAI-compatible endpoint does not return usage.cost,
-- which callModel relied on, so cost per paper could not be measured.
--
-- Cost is now computed in the database from token counts and a versioned price table,
-- so every writer gets it and the run total is always the sum of its calls:
--
--   billed output = completion + thinking tokens (thinking is billed as output)
--   cost = (input - cached) * input_price + cached * cached_price + output * output_price
--
-- A model with no price row is recorded as cost_basis = 'unpriced' with a NULL cost,
-- never as zero, so a missing price is visible instead of looking free.

create table if not exists public.model_price (
  model                 text          not null,
  -- standard, flex (service_tier = 'flex', 50% off, best effort) or batch (Batch API, 50% off).
  tier                  text          not null default 'standard' check (tier in ('standard', 'flex', 'batch')),
  effective_from        date          not null,
  input_per_mtok        numeric(10,4) not null check (input_per_mtok >= 0),
  output_per_mtok       numeric(10,4) not null check (output_per_mtok >= 0),
  -- NULL means "bill cached tokens at the full input price" (an overestimate)
  -- until the cached rate is confirmed.
  cached_input_per_mtok numeric(10,4) check (cached_input_per_mtok >= 0),
  source                text          not null,
  primary key (model, tier, effective_from)
);

create table if not exists public.fx_rate (
  currency       text          not null,
  inr_per_usd    numeric(10,4) not null check (inr_per_usd > 0),
  effective_from date          not null,
  source         text          not null,
  primary key (currency, effective_from),
  check (currency = 'INR')
);

alter table public.model_price enable row level security;
alter table public.fx_rate     enable row level security;
revoke all on public.model_price from anon, authenticated;
revoke all on public.fx_rate     from anon, authenticated;

comment on table public.model_price is
  'Versioned per-1M-token prices per service tier. The row in force for a call is the latest effective_from on or before the call date for its model and tier. Service role only.';
comment on table public.fx_rate is
  'USD to INR rate used to derive extraction_run.cost_paise. No row means cost_paise is left untouched; cost_usd is always kept. Owner-supplied. Service role only.';

-- Prices per 1M tokens (paid tier). Flex and Batch are 50% of standard. A tier with no row
-- for a model stays unpriced rather than being guessed. cached_input is left NULL until the
-- cached rate is confirmed (cached tokens then bill at the full input rate, an overestimate).
-- gemini-3.8-flash doubles on 2027-01-01. gemini-3.1-pro-preview is an offline eval judge only.
insert into public.model_price (model, tier, effective_from, input_per_mtok, output_per_mtok, cached_input_per_mtok, source) values
  ('gemini-3.1-flash-lite',   'standard', '2026-10-01', 0.2500,  1.5000, null, 'AXO-125, standard paid tier, valid through 2026-12-31'),
  ('gemini-3.1-flash-lite',   'flex',     '2026-10-01', 0.1250,  0.7500, null, 'AXO-125, flex = 50% of standard'),
  ('gemini-3.1-flash-lite',   'batch',    '2026-10-01', 0.1250,  0.7500, null, 'AXO-125, batch = 50% of standard'),
  ('gemini-3.8-flash',        'standard', '2026-10-01', 0.7500,  3.7500, null, 'AXO-125, standard paid tier, valid through 2026-12-31'),
  ('gemini-3.8-flash',        'flex',     '2026-10-01', 0.3750,  1.8750, null, 'AXO-125, flex = 50% of standard'),
  ('gemini-3.8-flash',        'batch',    '2026-10-01', 0.3750,  1.8750, null, 'AXO-125, batch = 50% of standard'),
  ('gemini-3.8-flash',        'standard', '2027-01-01', 1.5000,  7.5000, null, 'AXO-125: announced doubling on 2027-01-01'),
  ('gemini-3.8-flash',        'flex',     '2027-01-01', 0.7500,  3.7500, null, 'flex = 50% of the 2027 standard price'),
  ('gemini-3.8-flash',        'batch',    '2027-01-01', 0.7500,  3.7500, null, 'batch = 50% of the 2027 standard price'),
  ('gemini-3.1-pro-preview',  'standard', '2026-10-01', 2.0000, 12.0000, null, 'AXO-125: offline eval judge only, preview pricing'),
  ('gemini-3.1-pro-preview',  'batch',    '2026-10-01', 1.0000,  6.0000, null, 'AXO-125: batch = 50% of standard')
on conflict do nothing;

