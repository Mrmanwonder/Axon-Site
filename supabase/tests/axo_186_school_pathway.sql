begin;
create temporary table axo186_fixture(auth_id uuid,guardian_id uuid,student_id uuid);
insert into axo186_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select on axo186_fixture to authenticated;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
 select '00000000-0000-0000-0000-000000000000',auth_id,'authenticated','authenticated',auth_id::text||'@test.invalid','x',now(),now(),now() from axo186_fixture;
insert into public.guardian(id,auth_user_id,name,contact)
 select guardian_id,auth_id,'AXO186 rollback fixture',auth_id::text||'@test.invalid' from axo186_fixture;
insert into public.consent_event(guardian_id,student_id,purpose,granted,notice_version,method)
 select f.guardian_id,null,cp.purpose,true,'v1.0','in_app_itemised' from axo186_fixture f cross join public.consent_purpose cp where cp.is_required;
select set_config('request.jwt.claims',jsonb_build_object('sub',auth_id,'role','authenticated','session_id','axo186-rollback','amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',floor(extract(epoch from now()))::bigint)))::text,true) from axo186_fixture;
set local role authenticated;
do $$
declare sid uuid; subj jsonb; result jsonb;
begin
 select student_id into sid from axo186_fixture;
 select jsonb_build_array(jsonb_build_object('offering_id',o.id,'level',null)) into subj
 from public.subject_offering o join public.curriculum_stage s on s.id=o.stage_id
 where s.key='cambridge_igcse_y10' and o.external_code='0580' and o.availability='active' limit 1;
 result:=public.create_student_profile_v2(sid,'Test Student','cambridge_igcse','cambridge_igcse_y10','dreamBloom',subj,'ib_school_igcse');
 if result->>'provider_key'<>'cambridge' or result->>'school_pathway'<>'ib_school_igcse' then raise exception 'Wrong creation identity'; end if;
 result:=public.create_student_profile_v2(sid,'Test Student','cambridge_igcse','cambridge_igcse_y10','dreamBloom',subj,'ib_school_igcse');
 if (select count(*) from public.student where id=sid)<>1 then raise exception 'Retry created duplicate'; end if;
 if (select school_pathway from public.student where id=sid)<>'ib_school_igcse' then raise exception 'Pathway not persisted'; end if;
 select jsonb_build_array(jsonb_build_object('offering_id',o.id,'level',null)) into subj
 from public.subject_offering o join public.curriculum_stage s on s.id=o.stage_id
 where s.key='cambridge_igcse_y11' and o.external_code='0580' and o.availability='active' limit 1;
 result:=public.update_student_profile_v2(sid,'Test Student','cambridge_igcse','cambridge_igcse_y11','dreamBloom',subj,'ib_school_igcse');
 if (result->>'class_level')::int<>10 or result->>'school_pathway'<>'ib_school_igcse' then raise exception 'Wrong Class 10 identity'; end if;
  begin
    perform public.create_student_profile_v2(gen_random_uuid(),'Second Student','cambridge_igcse','cambridge_igcse_y11','dreamBloom',subj,'ib_school_igcse');
    raise exception 'Free plan allowed a second profile' using errcode='XX000';
  exception when sqlstate 'P0001' then
    if position('Free includes' in sqlerrm)=0 then raise; end if;
  end;
end $$;
reset role;
select 'PASS: authenticated creation, idempotent retry, persisted pathway, Class 10 update; transaction rolled back' as result;
select 5 as total, 5 as passed, 0 as failed;
rollback;
