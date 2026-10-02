-- Live in production (applied outside the migration tool; function bodies and both
-- triggers verified identical to this file on 2026-10-02 and recorded in the ledger under
-- this version then). See docs/claude_migration-ledger-2026-10-02.md.
-- AXO-124 (3/3): price each model_call from its tokens and roll the cost up onto the run.
-- See 20261001164022_axo_124_model_price.sql for the design.

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

-- Security invoker on purpose: the pipeline workers insert model_call rows as service_role,
-- which can already update extraction_run. No elevated privilege is needed or granted.
create or replace function private.model_call_rollup_cost()
returns trigger
language plpgsql set search_path = ''
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
