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

alter table public.model_call
  add column if not exists service_tier         text not null default 'standard' check (service_tier in ('standard', 'flex', 'batch')),
  add column if not exists cached_tokens        integer,
  add column if not exists billed_output_tokens integer,
  add column if not exists cost_basis           text
    check (cost_basis in ('provider', 'price_table', 'unpriced', 'no_usage'));

alter table public.extraction_run
  add column if not exists cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0);

comment on column public.model_call.service_tier is
  'The provider service tier the call was made on; selects the model_price row.';
comment on column public.model_call.cached_tokens is
  'Prompt tokens served from the provider cache (implicit prefix caching), when reported.';
comment on column public.model_call.billed_output_tokens is
  'Output tokens billed for the call including thinking (total_tokens - prompt_tokens when the provider reports them).';
comment on column public.model_call.cost_basis is
  'provider: cost_usd came from the provider; price_table: computed from model_price; unpriced: tokens present but no price row (cost_usd NULL); no_usage: failed before any tokens were billed (cost_usd 0).';
comment on column public.extraction_run.cost_usd is
  'Sum of model_call.cost_usd for this run. cost_paise is derived from it when an fx_rate row exists.';

create or replace function private.model_call_cost_usd(
  p_model text, p_tier text, p_input integer, p_cached integer, p_output integer, p_at timestamptz)
returns numeric
language sql stable set search_path = ''
as $$
  select ((greatest(coalesce(p_input, 0) - coalesce(p_cached, 0), 0) * mp.input_per_mtok
         + least(coalesce(p_cached, 0), coalesce(p_input, 0)) * coalesce(mp.cached_input_per_mtok, mp.input_per_mtok)
         + coalesce(p_output, 0) * mp.output_per_mtok) / 1000000.0)::numeric(12,6)
  from public.model_price mp
  where mp.model = p_model
    and mp.tier = coalesce(p_tier, 'standard')
    and mp.effective_from <= (p_at at time zone 'utc')::date
  order by mp.effective_from desc
  limit 1
$$;

create or replace function private.model_call_price()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.cost_usd is not null then
    new.cost_basis := coalesce(new.cost_basis, 'provider');
    return new;
  end if;

  if new.input_tokens is null and new.output_tokens is null and new.billed_output_tokens is null then
    if new.ok then
      new.cost_basis := 'unpriced';
    else
      new.cost_usd := 0;
      new.cost_basis := 'no_usage';
    end if;
    return new;
  end if;

  new.cost_usd := private.model_call_cost_usd(
    new.model_id, new.service_tier, new.input_tokens, new.cached_tokens,
    coalesce(new.billed_output_tokens, coalesce(new.output_tokens, 0) + coalesce(new.reasoning_tokens, 0)),
    new.created_at);
  new.cost_basis := case when new.cost_usd is null then 'unpriced' else 'price_table' end;
  return new;
end;
$$;

create or replace function private.model_call_rollup_cost()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  fx numeric;
begin
  if new.run_id is null or new.cost_usd is null or new.cost_usd = 0 then
    return new;
  end if;

  select f.inr_per_usd into fx
    from public.fx_rate f
   where f.currency = 'INR' and f.effective_from <= current_date
   order by f.effective_from desc
   limit 1;

  update public.extraction_run r
     set cost_usd   = r.cost_usd + new.cost_usd,
         cost_paise = case when fx is null then r.cost_paise
                           else round((r.cost_usd + new.cost_usd) * fx * 100)::integer end
   where r.id = new.run_id;
  return new;
end;
$$;

revoke all on function private.model_call_cost_usd(text, text, integer, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function private.model_call_price()       from public, anon, authenticated;
revoke all on function private.model_call_rollup_cost() from public, anon, authenticated;

drop trigger if exists model_call_price on public.model_call;
create trigger model_call_price
  before insert on public.model_call
  for each row execute function private.model_call_price();

drop trigger if exists model_call_rollup_cost on public.model_call;
create trigger model_call_rollup_cost
  after insert on public.model_call
  for each row execute function private.model_call_rollup_cost();
