-- ============================================================================
-- AXO-87 / AXO-88 / AXO-89 — narrow the privileged RPC surface
-- ============================================================================
-- Supabase's database advisor correctly warns when a SECURITY DEFINER function
-- lives in an exposed API schema. The AXO-87 owner operations genuinely need a
-- privileged body (they touch private state or must delete data even when an
-- archive SELECT gate hides it), but that body does not need to be exposed by
-- PostgREST.
--
-- Authenticated users already have USAGE on the private schema from
-- 20260810174749_harden_helpers_into_private_schema.sql. Move the privileged
-- bodies there and leave tiny SECURITY INVOKER wrappers in public.
--
-- The anonymous resolve_academic_share() endpoint is intentionally different:
-- it is the bearer-capability API itself. Moving it behind private would require
-- granting anon USAGE on the whole private schema, which is a wider boundary
-- and is not acceptable while older private helpers retain historical default
-- EXECUTE grants. Its SECURITY DEFINER advisor warning is therefore an
-- intentional, documented exception with a deliberately narrow return shape.
-- ============================================================================

-- ── question deletion ──────────────────────────────────────────────────────

alter function public.delete_question(uuid) set schema private;

revoke all on function private.delete_question(uuid) from public, anon;
grant execute on function private.delete_question(uuid) to authenticated;

create function public.delete_question(p_attempt_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.delete_question(p_attempt_id);
$$;

revoke all on function public.delete_question(uuid) from public, anon;
grant execute on function public.delete_question(uuid) to authenticated;

comment on function public.delete_question(uuid) is
  'AXO-87 public SECURITY INVOKER facade. Privileged deletion body lives in private.delete_question; authenticated callers still require ownership and fresh Parent Mode inside that body.';

-- ── authenticated share ownership operations ──────────────────────────────

alter function public.create_academic_share(text, uuid, integer) set schema private;
alter function public.active_academic_share(text, uuid) set schema private;
alter function public.revoke_academic_share(uuid) set schema private;

revoke all on function private.create_academic_share(text, uuid, integer) from public, anon;
revoke all on function private.active_academic_share(text, uuid) from public, anon;
revoke all on function private.revoke_academic_share(uuid) from public, anon;

grant execute on function private.create_academic_share(text, uuid, integer) to authenticated;
grant execute on function private.active_academic_share(text, uuid) to authenticated;
grant execute on function private.revoke_academic_share(uuid) to authenticated;

create function public.create_academic_share(
  p_resource_type text,
  p_resource_id uuid,
  p_expires_minutes integer default 1440
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_academic_share(p_resource_type, p_resource_id, p_expires_minutes);
$$;

create function public.active_academic_share(
  p_resource_type text,
  p_resource_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.active_academic_share(p_resource_type, p_resource_id);
$$;

create function public.revoke_academic_share(p_share_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.revoke_academic_share(p_share_id);
$$;

revoke all on function public.create_academic_share(text, uuid, integer) from public, anon;
revoke all on function public.active_academic_share(text, uuid) from public, anon;
revoke all on function public.revoke_academic_share(uuid) from public, anon;

grant execute on function public.create_academic_share(text, uuid, integer) to authenticated;
grant execute on function public.active_academic_share(text, uuid) to authenticated;
grant execute on function public.revoke_academic_share(uuid) to authenticated;

comment on function public.create_academic_share(text, uuid, integer) is
  'AXO-89 public SECURITY INVOKER facade. The privileged body is private and enforces guardian ownership plus fresh Parent Mode.';
comment on function public.active_academic_share(text, uuid) is
  'AXO-89 public SECURITY INVOKER facade. Returns only owner-visible share metadata; privileged body is private.';
comment on function public.revoke_academic_share(uuid) is
  'AXO-89 public SECURITY INVOKER facade. The privileged body is private and enforces guardian ownership plus fresh Parent Mode.';
