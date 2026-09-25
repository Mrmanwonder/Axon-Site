begin;

create table public._axo87_r (seq serial primary key, name text, passed boolean, detail text);
grant all on public._axo87_r to authenticated;
grant usage, select on sequence public._axo87_r_seq_seq to authenticated;
create or replace function public._axo87_t(n text, p boolean, d text default null)
returns void language sql as $$ insert into public._axo87_r(name,passed,detail) values(n,p,d); $$;
grant execute on function public._axo87_t(text,boolean,text) to authenticated;

create or replace function public._axo87_claims(p_sub text, p_age interval)
returns text language sql as $$
  select jsonb_build_object(
    'sub', p_sub, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object(
      'method','otp',
      'timestamp',floor(extract(epoch from (now() - p_age)))::bigint
    ))
  )::text;
$$;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','87000000-0000-4000-8000-000000000001','authenticated','authenticated','axo87a@test.invalid','x',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','87000000-0000-4000-8000-000000000002','authenticated','authenticated','axo87b@test.invalid','x',now(),now(),now());

insert into public.guardian(id,auth_user_id,name,contact) values
('87000000-0000-4000-8000-000000000011','87000000-0000-4000-8000-000000000001','Guardian A','a@test.invalid'),
('87000000-0000-4000-8000-000000000012','87000000-0000-4000-8000-000000000002','Guardian B','b@test.invalid');

insert into public.student(id,guardian_id,first_name,class_level,age_band) values
('87000000-0000-4000-8000-000000000021','87000000-0000-4000-8000-000000000011','A',10,'under_18'),
('87000000-0000-4000-8000-000000000022','87000000-0000-4000-8000-000000000012','B',10,'under_18');

insert into public.paper(id,student_id,type,tier,date_taken,subject) values
('87000000-0000-4000-8000-000000000031','87000000-0000-4000-8000-000000000021','unit_test','tier_1',current_date,'Physics');

insert into public.student_attempt(
  id,student_id,paper_id,paper_tier,question_label,marks_awarded,max_marks,marks_source,extraction_confidence
) values
('87000000-0000-4000-8000-000000000041','87000000-0000-4000-8000-000000000021','87000000-0000-4000-8000-000000000031','tier_1','Q1',2,3,'teacher_pen','confirmed'),
('87000000-0000-4000-8000-000000000042','87000000-0000-4000-8000-000000000021','87000000-0000-4000-8000-000000000031','tier_1','Q2',1,2,'teacher_pen','confirmed');

set local role authenticated;
select set_config('request.jwt.claims', public._axo87_claims('87000000-0000-4000-8000-000000000001', interval '4 hours'), true);

do $$ begin
  perform public.delete_question('87000000-0000-4000-8000-000000000041');
  perform public._axo87_t('stale Parent Mode cannot call delete_question', false, 'delete succeeded');
exception when insufficient_privilege then
  perform public._axo87_t('stale Parent Mode cannot call delete_question', true);
when others then
  perform public._axo87_t('stale Parent Mode cannot call delete_question', false, sqlerrm);
end $$;

select public._axo87_t('stale refusal leaves the question intact',
  exists(select 1 from public.student_attempt where id='87000000-0000-4000-8000-000000000041'));

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._axo87_claims('87000000-0000-4000-8000-000000000002', interval '5 seconds'), true);

do $$ begin
  perform public.delete_question('87000000-0000-4000-8000-000000000041');
  perform public._axo87_t('fresh other guardian cannot delete the question', false, 'delete succeeded');
exception when no_data_found then
  perform public._axo87_t('fresh other guardian cannot delete the question', true);
when others then
  perform public._axo87_t('fresh other guardian cannot delete the question', sqlstate='P0002', sqlerrm);
end $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', public._axo87_claims('87000000-0000-4000-8000-000000000001', interval '5 seconds'), true);

select public._axo87_t(
  'fresh owner can delete one question',
  (public.delete_question('87000000-0000-4000-8000-000000000041')->>'deleted')::boolean
);
select public._axo87_t('deleted attempt is gone',
  not exists(select 1 from public.student_attempt where id='87000000-0000-4000-8000-000000000041'));
select public._axo87_t('sibling question on same paper remains',
  exists(select 1 from public.student_attempt where id='87000000-0000-4000-8000-000000000042'));

reset role;

select count(*) as total,
       count(*) filter(where passed) as passed,
       count(*) filter(where not passed) as failed
from public._axo87_r;
select seq,name,passed,detail from public._axo87_r where not passed order by seq;

rollback;
