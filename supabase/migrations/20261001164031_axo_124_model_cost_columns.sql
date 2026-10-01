-- AXO-124 (2/3): token, tier and cost columns. See 20261001164022_axo_124_model_price.sql.

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

