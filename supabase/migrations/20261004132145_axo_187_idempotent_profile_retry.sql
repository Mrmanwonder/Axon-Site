-- AXO-187: an idempotent profile request reuses its existing row, so it must
-- not be counted as a second profile by the BEFORE INSERT entitlement gate.
create or replace function private.enforce_student_profile_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_free_limit constant integer := 1;
begin
  if exists (select 1 from public.student where id = new.id and guardian_id = new.guardian_id) then
    return new;
  end if;
  if private.guardian_is_pro(new.guardian_id) then
    return new;
  end if;
  select count(*) into v_count from public.student where guardian_id = new.guardian_id;
  if v_count >= v_free_limit then
    raise exception 'Free includes % student profile(s). Pro adds more at no extra cost per child.', v_free_limit
      using errcode = 'P0001', hint = 'This is a parent-account limit, surfaced only in the parent''s own account area.';
  end if;
  return new;
end;
$$;
-- This is an existing trigger authority; callers still go through profile RLS.
revoke all on function private.enforce_student_profile_limit() from public,anon,authenticated;
