-- ============================================================================
-- Security remediation: extraction priority is an immutable entitlement snapshot
-- ============================================================================
--
-- Finding PIPELINE-001 (2026-09-15): `private.snapshot_run_priority()` sets the
-- correct free/Pro priority on INSERT, but `extraction_run_all_own` permits the
-- owner to UPDATE the run and no trigger protected the priority column. A
-- modified client could therefore change its own run from priority 0 to 10 (or
-- any smallint) after creation and bypass the server-side priority entitlement.
--
-- Existing pipeline stages still run as the user's JWT and legitimately update
-- other columns, so this patch is intentionally narrow: only the entitlement
-- snapshot is immutable to `authenticated` after INSERT.
-- ============================================================================

create or replace function private.extraction_priority_is_server_authored()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if current_user = 'authenticated'
     and new.priority is distinct from old.priority then
    raise exception 'extraction priority is server-authored'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.extraction_priority_is_server_authored() from public, anon, authenticated;

drop trigger if exists extraction_priority_server_authored on public.extraction_run;
create trigger extraction_priority_server_authored
before update on public.extraction_run
for each row execute function private.extraction_priority_is_server_authored();

comment on function private.extraction_priority_is_server_authored is
  'Prevents an authenticated owner from rewriting the Pro/free queue-priority snapshot after run creation.';
