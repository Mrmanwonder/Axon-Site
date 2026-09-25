-- ============================================================================
-- Realtime for the library
-- ============================================================================
-- The client read its library exactly once, on mount, and had no way to learn
-- that anything had changed since. Two visible consequences:
--
--   · A paper scanned in the current session did not appear until a full
--     reload, because committing a run inserts rows nobody asked about again.
--   · A paper uploaded on the phone never appeared on the laptop. Not a sync
--     problem — both devices are already reading these same rows through the
--     same account. The laptop simply was not told.
--
-- Adding these four tables to the `supabase_realtime` publication is what lets
-- the server say when. The client re-reads on the nudge; it never renders the
-- payload. That matters here beyond tidiness: a WAL row is the base table, and
-- hard rule 3 says analytics come from `attempt_analytics` and
-- `mark_loss_analytics` and never from the base tables. A client that painted
-- from the payload would be reading around the very views that hold `unsure`
-- rows back. Nudge, then re-read through the same queries as before.
--
-- Only these four. `mark_loss_event` is deliberately NOT here: it is the table
-- an unconfirmed diagnosis lands in, and a live feed of it is the one feed that
-- could put an `unsure` explanation on screen ahead of the student confirming
-- it. The library learns a paper changed from `student_attempt`, which is
-- enough to re-read, and the re-read goes through the analytics views.
--
-- Replica identity is left at the default (primary key). Realtime applies RLS
-- to every delivered row, and the default is sufficient for INSERT and UPDATE,
-- which is all the library reacts to. `replica identity full` would ship every
-- old column value of every row into the WAL — including student answers and
-- teacher remarks — to support DELETE payloads nothing subscribes to.
-- ============================================================================

do $$
declare
  t text;
begin
  -- The publication exists on a stock Supabase project, but not on a bare
  -- Postgres — `supabase db reset` against a plain image would fail on the
  -- `alter` below with a message that does not name this file.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['paper', 'paper_page', 'student_attempt', 'extraction_run']
  loop
    -- Idempotent: adding a table already in the publication is an error, and
    -- this migration has to be safe to re-run against a project where realtime
    -- was switched on by hand in the dashboard first.
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
