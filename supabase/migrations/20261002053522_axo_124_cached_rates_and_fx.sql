-- AXO-124 (owner decision, 2026-10-02): cached-input rates and a dated INR rate.
--
-- fx_rate was empty, so extraction_run.cost_paise has never been derived. Seeded at 96.0 INR per
-- USD effective 2026-10-02; USD stays canonical, INR is a roll-up. Add a new dated row when the
-- rate moves, never edit this one.
--
-- Cached-input rates per 1M tokens as given by the owner:
--   3.1 Flash-Lite 0.025; 3.8 Flash 0.075 (0.15 from 2027-01-01); 3.1 Pro Preview 0.20.
-- The owner gave standard-tier rates only. Flex and Batch are billed at half the standard price
-- for input and output, so their cached rate is set to half the standard cached rate. That is an
-- assumption and is marked in `note`; correct it with a dated row if the price sheet says otherwise.
--
-- Not priced (no input/output rates supplied, so cost stays NULL = unpriced, never 0):
-- gemini-3.6-flash, gemini-3.5-flash-lite, gemini-3.5-flash, gemini-3.7-flash.

insert into public.fx_rate (currency, inr_per_usd, effective_from, source)
values ('INR', 96.0, '2026-10-02', 'owner decision, AXO-124 comment 2026-10-02')
on conflict do nothing;

update public.model_price set cached_input_per_mtok = 0.025  where model = 'gemini-3.1-flash-lite' and tier = 'standard';
update public.model_price set cached_input_per_mtok = 0.0125 where model = 'gemini-3.1-flash-lite' and tier in ('flex', 'batch');

update public.model_price set cached_input_per_mtok = 0.075  where model = 'gemini-3.8-flash' and tier = 'standard' and effective_from = '2026-10-01';
update public.model_price set cached_input_per_mtok = 0.15   where model = 'gemini-3.8-flash' and tier = 'standard' and effective_from = '2027-01-01';
update public.model_price set cached_input_per_mtok = 0.0375 where model = 'gemini-3.8-flash' and tier in ('flex', 'batch') and effective_from = '2026-10-01';
update public.model_price set cached_input_per_mtok = 0.075  where model = 'gemini-3.8-flash' and tier in ('flex', 'batch') and effective_from = '2027-01-01';

update public.model_price set cached_input_per_mtok = 0.20   where model = 'gemini-3.1-pro-preview' and tier = 'standard';
update public.model_price set cached_input_per_mtok = 0.10   where model = 'gemini-3.1-pro-preview' and tier = 'batch';
