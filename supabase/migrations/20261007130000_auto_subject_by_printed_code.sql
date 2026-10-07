-- AXO-214: the automatic paper subject ignored the printed syllabus code.
--
-- A 9231 paper (printed 9231/14/M/J/25) was filed under the student's 9709
-- subject because triage's free-text subject said "Mathematics" and
-- auto_assign_paper_subject matched only that text. Triage had also read
-- assessment_identity.subject_code = 9231 with high confidence.
--
-- Rule now:
--   * triage read a syllabus code   -> match by that code only, and only when
--     the code was read with high confidence; exactly one of the student's
--     subjects or nothing. The name is not consulted.
--   * no code was read              -> the name match as before.
-- An official assessment identity and the student's own choice still win
-- (unchanged: the function only fills an empty subject).

create or replace function private.auto_assign_paper_subject(p_paper_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_paper public.paper%rowtype;
  v_suggestion text;
  v_confidence text;
  v_code text;
  v_code_confidence text;
  v_norm text;
  v_matches uuid[];
  v_display text;
  v_offering_code text;
begin
  select * into v_paper from public.paper where id = p_paper_id;
  if not found or v_paper.subject_offering_id is not null or v_paper.assessment_identity_id is not null then
    return false;
  end if;

  select nullif(btrim(r.tier_routing #>> '{triage,subject}'), ''),
         r.tier_routing #>> '{triage,confidence}',
         nullif(btrim(r.tier_routing #>> '{triage,assessment_identity,subject_code}'), ''),
         r.tier_routing #>> '{triage,assessment_identity,confidence}'
    into v_suggestion, v_confidence, v_code, v_code_confidence
    from public.extraction_run r
   where r.paper_id = p_paper_id
     and (nullif(btrim(r.tier_routing #>> '{triage,subject}'), '') is not null
          or nullif(btrim(r.tier_routing #>> '{triage,assessment_identity,subject_code}'), '') is not null)
   order by r.started_at desc nulls last
   limit 1;

  if v_code is not null then
    -- A printed code decides. A code read without confidence decides nothing:
    -- falling back to the name is exactly how 9231 became 9709.
    if v_code_confidence is distinct from 'high' then
      return false;
    end if;
    select array_agg(distinct ss.subject_offering_id)
      into v_matches
      from public.student_subject ss
     where ss.student_id = v_paper.student_id
       and ss.subject_offering_id is not null
       and ss.external_code_snapshot = v_code;
  else
    -- A low-confidence guess is shown as a suggestion only; it is not assigned.
    if v_suggestion is null or v_confidence is distinct from 'high' then
      return false;
    end if;
    v_norm := lower(regexp_replace(btrim(v_suggestion), '\s+', ' ', 'g'));
    select array_agg(distinct ss.subject_offering_id)
      into v_matches
      from public.student_subject ss
     where ss.student_id = v_paper.student_id
       and ss.subject_offering_id is not null
       and (
         v_norm = lower(regexp_replace(btrim(coalesce(ss.display_name_snapshot, ss.subject)), '\s+', ' ', 'g'))
         or v_norm = lower(regexp_replace(btrim(ss.subject), '\s+', ' ', 'g'))
         or (ss.external_code_snapshot is not null and v_norm ~ ('(^|[^0-9])' || ss.external_code_snapshot || '([^0-9]|$)'))
       );
  end if;

  -- Exactly one of the student's own subjects, or nothing.
  if v_matches is null or array_length(v_matches, 1) <> 1 then
    return false;
  end if;

  select coalesce(so.display_name, ss.display_name_snapshot, ss.subject), coalesce(so.external_code, ss.external_code_snapshot)
    into v_display, v_offering_code
    from public.student_subject ss
    left join public.subject_offering so on so.id = ss.subject_offering_id
   where ss.student_id = v_paper.student_id and ss.subject_offering_id = v_matches[1]
   limit 1;

  perform set_config('axon.subject_write', 'auto', true);
  update public.paper
     set subject_offering_id = v_matches[1],
         subject_display_snapshot = v_display,
         subject_external_code_snapshot = v_offering_code,
         subject_identity_source = 'triage',
         subject_identity_confidence = 'auto',
         subject_verified_at = now()
   where id = p_paper_id and subject_offering_id is null;
  perform set_config('axon.subject_write', '', true);
  return found;
end;
$function$;

revoke all on function private.auto_assign_paper_subject(uuid) from public, anon, authenticated;

-- Correct papers this rule filed wrongly: auto-assigned by triage (never a
-- student's choice, never an official identity) where triage read a printed
-- code with high confidence that differs from the assigned subject's code.
-- Clear the subject and assign again under the new rule (which may leave it
-- empty when the student has no subject with that code).
do $$
declare
  r record;
begin
  for r in
    select p.id
      from public.paper p
      join lateral (
        select er.tier_routing
          from public.extraction_run er
         where er.paper_id = p.id
           and nullif(btrim(er.tier_routing #>> '{triage,assessment_identity,subject_code}'), '') is not null
         order by er.started_at desc nulls last
         limit 1
      ) run on true
     where p.subject_identity_source = 'triage'
       and p.subject_identity_confidence = 'auto'
       and p.assessment_identity_id is null
       and run.tier_routing #>> '{triage,assessment_identity,confidence}' = 'high'
       and btrim(run.tier_routing #>> '{triage,assessment_identity,subject_code}') is distinct from p.subject_external_code_snapshot
  loop
    perform set_config('axon.subject_write', 'auto', true);
    update public.paper
       set subject_offering_id = null, subject_display_snapshot = null, subject_external_code_snapshot = null,
           subject_identity_source = null, subject_identity_confidence = null, subject_verified_at = null
     where id = r.id;
    perform set_config('axon.subject_write', '', true);
    perform private.auto_assign_paper_subject(r.id);
  end loop;
end;
$$;
