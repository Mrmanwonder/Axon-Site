-- ============================================================================
-- Test suite: AXO-123 explain/adjudicate route rollback
-- ============================================================================
-- Gemini 3.x counts thinking tokens against max_tokens, so a route that sets a
-- high thinking level with a small budget produces truncated JSON. Pin the
-- rolled-back routes so nobody reintroduces that pairing silently.
--
--   Run:  psql "$DATABASE_URL" -f supabase/tests/axo_123_explain_route.sql
--   Pass: final SELECT reports failed = 0.
-- ============================================================================

begin;

create table public._r (seq serial primary key, name text, passed boolean, detail text);
create or replace function public._t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._r (name, passed, detail) values (n, p, d); $$;

select public._t(
  'explain and adjudicate route to gemini-3.1-flash-lite at low thinking with 4096 tokens',
  (select count(*) = 2 from public.model_route
    where stage in ('explain', 'adjudicate')
      and primary_model = 'gemini-3.1-flash-lite'
      and thinking_level = 'low'
      and max_tokens = 4096
      and allow_training = false),
  (select string_agg(stage || ':' || primary_model || '/' || coalesce(thinking_level, '-') || '/' || max_tokens, ', ') from public.model_route));

select public._t(
  'model_call records reasoning_tokens',
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'model_call' and column_name = 'reasoning_tokens'));

select name, passed, detail from public._r order by seq;
select count(*) filter (where not passed) as failed, count(*) as total from public._r;

rollback;
