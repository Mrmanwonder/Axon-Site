-- ============================================================================
-- Test suite: AXO-125 model_route.provider
-- ============================================================================
-- Rolls back; safe against any database.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_125_model_route_provider.sql
--   Pass: the counts line reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

select public._t('every existing route defaults to ai_studio',
  (select count(*) > 0 and bool_and(provider = 'ai_studio') from public.model_route));

select public._t('provider is NOT NULL',
  (select is_nullable = 'NO' from information_schema.columns
    where table_schema = 'public' and table_name = 'model_route' and column_name = 'provider'));

do $$ begin begin
  update public.model_route set provider = 'openrouter' where stage = 'explain';
  perform public._t('an unknown provider is refused', false, 'update succeeded');
exception when check_violation then
  perform public._t('an unknown provider is refused', true);
end; end $$;

update public.model_route set provider = 'vertex' where stage = 'explain';
select public._t('vertex is an accepted provider',
  (select provider = 'vertex' from public.model_route where stage = 'explain'));

select count(*) as total, count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed from public._r;
select seq, name, passed, detail from public._r where not passed order by seq;

rollback;
