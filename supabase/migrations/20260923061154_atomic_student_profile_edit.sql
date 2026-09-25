-- A class change and its Cambridge subject-code remap are one edit in the UI.
-- Keep them one transaction here too: deleting the old subjects and then
-- losing the connection must not leave a student with an empty curriculum.

create or replace function public.update_student_profile(
  p_student_id uuid,
  p_first_name text,
  p_class_level smallint,
  p_subjects jsonb
)
returns public.student
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student public.student;
begin
  if nullif(btrim(p_first_name), '') is null then
    raise exception 'Student first name is required' using errcode = '22023';
  end if;
  if p_class_level not between 9 and 12 then
    raise exception 'Class level is outside the supported range' using errcode = '22023';
  end if;
  if jsonb_typeof(p_subjects) <> 'array' or jsonb_array_length(p_subjects) = 0 then
    raise exception 'Choose at least one subject' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_subjects) as x(subject text, syllabus_code text)
    where nullif(btrim(x.subject), '') is null
       or x.syllabus_code !~ '^[0-9]{4}$'
  ) then
    raise exception 'Every subject needs a four-digit syllabus code' using errcode = '22023';
  end if;

  update public.student
     set first_name = btrim(p_first_name),
         class_level = p_class_level,
         updated_at = now()
   where id = p_student_id
   returning * into v_student;

  -- RLS makes a missing row and somebody else's row indistinguishable.
  if not found then
    raise exception 'Student profile was not found' using errcode = 'P0002';
  end if;

  delete from public.student_subject where student_id = p_student_id;
  insert into public.student_subject (student_id, subject, syllabus_code)
  select p_student_id, btrim(x.subject), x.syllabus_code
  from jsonb_to_recordset(p_subjects) as x(subject text, syllabus_code text);

  return v_student;
end;
$$;

revoke all on function public.update_student_profile(uuid, text, smallint, jsonb) from public, anon;
grant execute on function public.update_student_profile(uuid, text, smallint, jsonb) to authenticated;

comment on function public.update_student_profile(uuid, text, smallint, jsonb) is
  'Edits a guardian-owned student and replaces subjects atomically; runs as caller so table RLS remains authoritative.';
