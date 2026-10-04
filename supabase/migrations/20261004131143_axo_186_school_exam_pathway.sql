-- AXO-186: school pathway is distinct from the provider of the actual exams.
-- Existing v2 callers and canonical Cambridge identities remain compatible.
alter table public.student add column school_pathway text
  check (school_pathway is null or school_pathway = 'ib_school_igcse');

create function private.validate_school_pathway() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.school_pathway is not null and not exists (
    select 1 from public.curriculum_programme p
    join public.curriculum_stage s on s.programme_id = p.id
    where p.id = new.programme_id and s.id = new.stage_id
      and p.key = 'cambridge_igcse' and s.legacy_class_level in (9,10)
  ) then
    -- A legacy editor may advance a student to DP without knowing this field.
    if tg_op = 'UPDATE' and new.school_pathway is not distinct from old.school_pathway
      and (new.programme_id is distinct from old.programme_id or new.stage_id is distinct from old.stage_id) then
      new.school_pathway := null;
    else
      raise exception 'IB school IGCSE pathway requires a Cambridge IGCSE stage' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validate_school_pathway() from public, anon, authenticated;
create trigger student_school_pathway before insert or update on public.student
for each row execute function private.validate_school_pathway();

-- Exact named-argument overloads avoid changing the six-argument v2 contracts.
create function public.create_student_profile_v2(
  p_request_id uuid, p_first_name text, p_programme_key text,
  p_stage_key text, p_avatar_key text, p_subjects jsonb, p_school_pathway text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if p_school_pathway is not null and (p_school_pathway <> 'ib_school_igcse' or p_programme_key <> 'cambridge_igcse') then
    raise exception 'Invalid school pathway' using errcode = '22023';
  end if;
  v_result := public.create_student_profile_v2(p_request_id,p_first_name,p_programme_key,p_stage_key,p_avatar_key,p_subjects);
  update public.student set school_pathway = p_school_pathway
    where id = (v_result->>'id')::uuid;
  if not found then raise exception 'Profile could not be updated' using errcode = '42501'; end if;
  return v_result || jsonb_build_object('school_pathway',p_school_pathway);
end;
$$;

create function public.update_student_profile_v2(
  p_student_id uuid, p_first_name text, p_programme_key text,
  p_stage_key text, p_avatar_key text, p_subjects jsonb, p_school_pathway text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if p_school_pathway is not null and (p_school_pathway <> 'ib_school_igcse' or p_programme_key <> 'cambridge_igcse') then
    raise exception 'Invalid school pathway' using errcode = '22023';
  end if;
  v_result := public.update_student_profile_v2(p_student_id,p_first_name,p_programme_key,p_stage_key,p_avatar_key,p_subjects);
  update public.student set school_pathway = p_school_pathway
    where id = (v_result->>'id')::uuid;
  if not found then raise exception 'Profile could not be updated' using errcode = '42501'; end if;
  return v_result || jsonb_build_object('school_pathway',p_school_pathway);
end;
$$;
revoke all on function public.create_student_profile_v2(uuid,text,text,text,text,jsonb,text) from public,anon;
revoke all on function public.update_student_profile_v2(uuid,text,text,text,text,jsonb,text) from public,anon;
grant execute on function public.create_student_profile_v2(uuid,text,text,text,text,jsonb,text) to authenticated;
grant execute on function public.update_student_profile_v2(uuid,text,text,text,text,jsonb,text) to authenticated;
