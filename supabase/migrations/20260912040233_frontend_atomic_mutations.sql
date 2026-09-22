-- Frontend atomic operations. Invoker rights preserve existing RLS and consent triggers.
-- Curriculum rows generated from src/curriculum.js; update both with curriculum changes.
create table private.profile_subject_catalog (
  class_level smallint not null, subject text not null, syllabus_code text not null,
  primary key(class_level, subject)
);
alter table private.profile_subject_catalog enable row level security;
create policy profile_subject_catalog_read on private.profile_subject_catalog for select to authenticated using (true);
grant select on private.profile_subject_catalog to authenticated;
insert into private.profile_subject_catalog values
(9, 'Mathematics', '0580'),
(9, 'Additional Mathematics', '0606'),
(9, 'Physics', '0625'),
(9, 'Chemistry', '0620'),
(9, 'Biology', '0610'),
(9, 'Combined Science', '0653'),
(9, 'Computer Science', '0478'),
(9, 'Economics', '0455'),
(9, 'Business Studies', '0450'),
(9, 'Accounting', '0452'),
(9, 'English — First Language', '0500'),
(9, 'English as a Second Language', '0510'),
(9, 'English Literature', '0475'),
(9, 'Geography', '0460'),
(9, 'History', '0470'),
(9, 'ICT', '0417'),
(10, 'Mathematics', '0580'),
(10, 'Additional Mathematics', '0606'),
(10, 'Physics', '0625'),
(10, 'Chemistry', '0620'),
(10, 'Biology', '0610'),
(10, 'Combined Science', '0653'),
(10, 'Computer Science', '0478'),
(10, 'Economics', '0455'),
(10, 'Business Studies', '0450'),
(10, 'Accounting', '0452'),
(10, 'English — First Language', '0500'),
(10, 'English as a Second Language', '0510'),
(10, 'English Literature', '0475'),
(10, 'Geography', '0460'),
(10, 'History', '0470'),
(10, 'ICT', '0417'),
(11, 'Mathematics', '9709'),
(11, 'Further Mathematics', '9231'),
(11, 'Physics', '9702'),
(11, 'Chemistry', '9701'),
(11, 'Biology', '9700'),
(11, 'Computer Science', '9618'),
(11, 'Economics', '9708'),
(11, 'Business', '9609'),
(11, 'Accounting', '9706'),
(11, 'English Language', '9093'),
(11, 'English Literature', '9695'),
(11, 'Psychology', '9990'),
(11, 'Geography', '9696'),
(11, 'History', '9489'),
(11, 'Sociology', '9699'),
(12, 'Mathematics', '9709'),
(12, 'Further Mathematics', '9231'),
(12, 'Physics', '9702'),
(12, 'Chemistry', '9701'),
(12, 'Biology', '9700'),
(12, 'Computer Science', '9618'),
(12, 'Economics', '9708'),
(12, 'Business', '9609'),
(12, 'Accounting', '9706'),
(12, 'English Language', '9093'),
(12, 'English Literature', '9695'),
(12, 'Psychology', '9990'),
(12, 'Geography', '9696'),
(12, 'History', '9489'),
(12, 'Sociology', '9699');

create or replace function public.create_student_profile(
  p_request_id uuid, p_first_name text, p_class_level smallint, p_board public.board, p_subjects jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  guardian uuid := private.current_guardian_id();
  profile public.student;
  item jsonb;
begin
  if auth.uid() is null or guardian is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_request_id is null or p_board <> 'CAIE' or p_class_level not between 9 and 12 or length(btrim(p_first_name)) = 0 then
    raise exception 'Invalid profile';
  end if;
  if p_subjects is null or jsonb_typeof(p_subjects) <> 'array' or jsonb_array_length(p_subjects) = 0 then raise exception 'Choose subjects'; end if;
  for item in select value from jsonb_array_elements(p_subjects) loop
    if not exists (select 1 from private.profile_subject_catalog c where c.class_level = p_class_level and c.subject = item->>'subject' and c.syllabus_code = item->>'syllabus_code') then
      raise exception 'Invalid subject or syllabus code';
    end if;
  end loop;
  -- The PK is the request identity, so concurrent or uncertain retries converge.
  insert into public.student(id, guardian_id, first_name, class_level, board, age_band)
    values(p_request_id, guardian, btrim(p_first_name), p_class_level, p_board, 'under_18')
    on conflict(id) do nothing returning * into profile;
  if found then
    insert into public.student_subject(student_id, subject, syllabus_code)
      select profile.id, value->>'subject', value->>'syllabus_code' from jsonb_array_elements(p_subjects);
  else
    select * into strict profile from public.student where id = p_request_id and guardian_id = guardian;
  end if;
  return to_jsonb(profile) || jsonb_build_object('subjects', (select coalesce(jsonb_agg(subject order by subject), '[]'::jsonb) from public.student_subject where student_id = profile.id));
end;
$$;
revoke all on function public.create_student_profile(uuid,text,smallint,public.board,jsonb) from public, anon;
grant execute on function public.create_student_profile(uuid,text,smallint,public.board,jsonb) to authenticated;

create or replace function public.create_link_paper(
  p_request_id uuid, p_student_id uuid, p_type public.paper_type, p_date date, p_url text
) returns public.paper language plpgsql security invoker set search_path = '' as $$
declare result public.paper;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_request_id is null or p_url is null or p_url !~* '^https?://[^[:space:]]+$' then raise exception 'Invalid link'; end if;
  insert into public.paper(id,student_id,type,tier,date_taken)
    values(p_request_id,p_student_id,p_type,case when p_type in ('pyq','sample_paper') then 'tier_2'::public.paper_tier else 'tier_1'::public.paper_tier end,p_date)
    on conflict(id) do nothing returning * into result;
  if found then
    insert into public.paper_page(paper_id,student_id,page_number,source_kind,source_url,status)
      values(result.id,p_student_id,1,'link',p_url,'pending');
  else
    select * into strict result from public.paper where id = p_request_id and student_id = p_student_id;
  end if;
  return result;
end;
$$;
revoke all on function public.create_link_paper(uuid,uuid,public.paper_type,date,text) from public, anon;
grant execute on function public.create_link_paper(uuid,uuid,public.paper_type,date,text) to authenticated;
