-- Normalized profile mutations for Cambridge, CBSE and IBDP.
alter type public.board add value if not exists 'IBDP';
alter table public.student alter column class_level drop not null;

create or replace function public.create_student_profile_v2(
  p_request_id uuid,
  p_first_name text,
  p_programme_key text,
  p_stage_key text,
  p_avatar_key text,
  p_subjects jsonb
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_guardian uuid := private.current_guardian_id();
  v_programme public.curriculum_programme;
  v_provider public.curriculum_provider;
  v_stage public.curriculum_stage;
  v_profile public.student;
  v_item jsonb;
  v_offering public.subject_offering;
  v_level text;
  v_legacy_board public.board;
  v_legacy_class smallint;
begin
  if auth.uid() is null or v_guardian is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_request_id is null or nullif(btrim(p_first_name),'') is null then
    raise exception 'Invalid profile' using errcode='22023';
  end if;
  if p_avatar_key is null or p_avatar_key !~ '^[a-zA-Z][a-zA-Z0-9]{0,39}$' then
    raise exception 'Invalid avatar choice' using errcode='22023';
  end if;
  if p_subjects is null or jsonb_typeof(p_subjects) <> 'array' or jsonb_array_length(p_subjects)=0 then
    raise exception 'Choose at least one subject' using errcode='22023';
  end if;

  select pr.* into v_programme from public.curriculum_programme pr
    where pr.key=p_programme_key and pr.active;
  if not found then raise exception 'Invalid programme' using errcode='22023'; end if;

  select cp.* into v_provider from public.curriculum_provider cp where cp.id=v_programme.provider_id and cp.active;
  if not found then raise exception 'Invalid provider' using errcode='22023'; end if;

  select st.* into v_stage from public.curriculum_stage st
    where st.key=p_stage_key and st.programme_id=v_programme.id and st.active;
  if not found then raise exception 'Invalid stage' using errcode='22023'; end if;

  v_legacy_board := case v_provider.key
    when 'cambridge' then 'CAIE'::public.board
    when 'cbse' then 'CBSE'::public.board
    when 'ib' then 'IBDP'::public.board
    else null
  end;
  if v_legacy_board is null then raise exception 'Unsupported provider' using errcode='22023'; end if;
  v_legacy_class := v_stage.legacy_class_level;

  for v_item in select value from jsonb_array_elements(p_subjects) loop
    if nullif(v_item->>'offering_id','') is null then
      raise exception 'Subject offering is required' using errcode='22023';
    end if;
    select so.* into v_offering
      from public.subject_offering so
      where so.id=(v_item->>'offering_id')::uuid
        and so.programme_id=v_programme.id
        and so.stage_id=v_stage.id
        and so.availability='active';
    if not found then raise exception 'Subject is not available at this stage' using errcode='22023'; end if;

    v_level := nullif(v_item->>'level','');
    if cardinality(v_offering.levels_supported)>0 then
      if v_level is null or not (v_level=any(v_offering.levels_supported)) then
        raise exception 'Unsupported subject level' using errcode='22023';
      end if;
    elsif v_level is not null then
      raise exception 'This subject does not use SL/HL' using errcode='22023';
    end if;
  end loop;

  insert into public.student(
    id, guardian_id, first_name, board, class_level, age_band,
    avatar_seed, programme_id, stage_id, curriculum_version
  ) values (
    p_request_id, v_guardian, btrim(p_first_name), v_legacy_board, v_legacy_class, 'under_18',
    p_avatar_key, v_programme.id, v_stage.id, coalesce(
      (select max(cs.version_label) from public.curriculum_source cs where cs.provider_id=v_provider.id and cs.active),
      'normalized-v2'
    )
  )
  on conflict(id) do nothing returning * into v_profile;

  if found then
    insert into public.student_subject(
      student_id, subject, syllabus_code, subject_offering_id, selected_level,
      display_name_snapshot, external_code_snapshot
    )
    select
      v_profile.id,
      so.display_name,
      case when so.external_code_kind='syllabus_code' then so.external_code else null end,
      so.id,
      nullif(x.level,''),
      so.display_name,
      so.external_code
    from jsonb_to_recordset(p_subjects) as x(offering_id uuid, level text)
    join public.subject_offering so on so.id=x.offering_id;
  else
    select * into strict v_profile from public.student
      where id=p_request_id and guardian_id=v_guardian;
  end if;

  return to_jsonb(v_profile) || jsonb_build_object(
    'programme_key', v_programme.key,
    'programme_label', v_programme.label,
    'provider_key', v_provider.key,
    'provider_label', v_provider.name,
    'stage_key', v_stage.key,
    'stage_label', v_stage.label,
    'school_year_label', v_stage.school_year_label,
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'offering_id',ss.subject_offering_id,
        'subject',ss.display_name_snapshot,
        'external_code',ss.external_code_snapshot,
        'level',ss.selected_level
      ) order by ss.display_name_snapshot),'[]'::jsonb)
      from public.student_subject ss where ss.student_id=v_profile.id
    )
  );
end;
$$;

revoke all on function public.create_student_profile_v2(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.create_student_profile_v2(uuid,text,text,text,text,jsonb) to authenticated;

create or replace function public.update_student_profile_v2(
  p_student_id uuid,
  p_first_name text,
  p_programme_key text,
  p_stage_key text,
  p_avatar_key text,
  p_subjects jsonb
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_current public.student;
  v_programme public.curriculum_programme;
  v_old_programme public.curriculum_programme;
  v_provider public.curriculum_provider;
  v_stage public.curriculum_stage;
  v_item jsonb;
  v_offering public.subject_offering;
  v_level text;
  v_legacy_board public.board;
  v_paper_count bigint;
begin
  select s.* into v_current from public.student s where s.id=p_student_id;
  if not found then raise exception 'Student profile was not found' using errcode='P0002'; end if;
  if nullif(btrim(p_first_name),'') is null then raise exception 'Student first name is required' using errcode='22023'; end if;
  if p_subjects is null or jsonb_typeof(p_subjects)<>'array' or jsonb_array_length(p_subjects)=0 then
    raise exception 'Choose at least one subject' using errcode='22023';
  end if;

  select pr.* into v_programme from public.curriculum_programme pr where pr.key=p_programme_key and pr.active;
  if not found then raise exception 'Invalid programme' using errcode='22023'; end if;
  select cp.* into v_provider from public.curriculum_provider cp where cp.id=v_programme.provider_id and cp.active;
  select st.* into v_stage from public.curriculum_stage st where st.key=p_stage_key and st.programme_id=v_programme.id and st.active;
  if not found then raise exception 'Invalid stage' using errcode='22023'; end if;

  if v_current.programme_id is not null and v_current.programme_id<>v_programme.id then
    select pr.* into v_old_programme from public.curriculum_programme pr where pr.id=v_current.programme_id;
    select count(*) into v_paper_count from public.paper p where p.student_id=p_student_id;
    if v_paper_count>0 and v_old_programme.provider_id<>v_programme.provider_id then
      raise exception 'Curriculum provider changes require migration when papers already exist' using errcode='22023';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_subjects) loop
    select so.* into v_offering from public.subject_offering so
      where so.id=(v_item->>'offering_id')::uuid
        and so.programme_id=v_programme.id and so.stage_id=v_stage.id and so.availability='active';
    if not found then raise exception 'Subject is not available at this stage' using errcode='22023'; end if;
    v_level := nullif(v_item->>'level','');
    if cardinality(v_offering.levels_supported)>0 then
      if v_level is null or not (v_level=any(v_offering.levels_supported)) then
        raise exception 'Unsupported subject level' using errcode='22023';
      end if;
    elsif v_level is not null then
      raise exception 'This subject does not use SL/HL' using errcode='22023';
    end if;
  end loop;

  v_legacy_board := case v_provider.key
    when 'cambridge' then 'CAIE'::public.board
    when 'cbse' then 'CBSE'::public.board
    when 'ib' then 'IBDP'::public.board
  end;

  update public.student
  set first_name=btrim(p_first_name),
      programme_id=v_programme.id,
      stage_id=v_stage.id,
      board=v_legacy_board,
      class_level=v_stage.legacy_class_level,
      avatar_seed=coalesce(p_avatar_key,avatar_seed),
      updated_at=now()
  where id=p_student_id;

  delete from public.student_subject where student_id=p_student_id;
  insert into public.student_subject(
    student_id,subject,syllabus_code,subject_offering_id,selected_level,
    display_name_snapshot,external_code_snapshot
  )
  select p_student_id,so.display_name,
         case when so.external_code_kind='syllabus_code' then so.external_code else null end,
         so.id,nullif(x.level,''),so.display_name,so.external_code
  from jsonb_to_recordset(p_subjects) as x(offering_id uuid,level text)
  join public.subject_offering so on so.id=x.offering_id;

  return (
    select to_jsonb(s) || jsonb_build_object(
      'programme_key',v_programme.key,'programme_label',v_programme.label,
      'provider_key',v_provider.key,'provider_label',v_provider.name,
      'stage_key',v_stage.key,'stage_label',v_stage.label,'school_year_label',v_stage.school_year_label,
      'subjects',coalesce((
        select jsonb_agg(jsonb_build_object(
          'offering_id',ss.subject_offering_id,'subject',ss.display_name_snapshot,
          'external_code',ss.external_code_snapshot,'level',ss.selected_level
        ) order by ss.display_name_snapshot)
        from public.student_subject ss where ss.student_id=s.id
      ),'[]'::jsonb)
    )
    from public.student s where s.id=p_student_id
  );
end;
$$;

revoke all on function public.update_student_profile_v2(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.update_student_profile_v2(uuid,text,text,text,text,jsonb) to authenticated;
