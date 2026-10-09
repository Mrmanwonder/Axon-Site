-- AXO-216: papers save, and only flagged parts ask the student (council decision D1 and D7,
-- 7 Oct 2026; council/2026-10-07-open-decisions/RECOMMENDATION.md and ADDENDUM-01A items 2, 3, 5).
--
-- 1. The save defect. commit_extraction_run refused a whole paper when two labels matched after
--    stripping non-alphanumerics, so a bare "(c)" under question 3 and another under question 5
--    blocked the save. The unique index ignores labels without a digit, and the screen places bare
--    parts under their question, so the commit check was the only layer that refused them. Only 1
--    of 67 production runs had ever committed. The app now stores the label the student saw
--    (question_region.placed_label, from the shared placement walk placeRegions in
--    src/questionCount.js), and the check compares placed labels, and only labels with a digit,
--    the same rule as question_region_one_label_per_run. Genuine duplicates are still refused, and
--    the refusal now names them.
--
-- 2. Ask only flagged parts. Commit no longer waits for every flagged part to be confirmed. A part
--    with needs_review that the student has not confirmed is stored as `unsure`, which keeps it out
--    of attempt_analytics and mark_loss_analytics (hard rule 3). The student can fix it later on
--    the saved paper (private.fix_saved_part) or leave it ("Not now", review_deferred_at). Its
--    explanation is held back: begin_explanations skips it with the reason code held_for_check
--    instead of refusing the whole paper, and retry_failed_explanations picks it up once the
--    student has checked it.
--
-- 3. The share page reads only analytics-eligible parts: an unsure part the student has not
--    confirmed is withheld, and the paper total is withheld when any part is.
--
-- 4. D7. The scanner no longer asks "What kind of paper is this?". A new paper is a school test
--    (type_source = 'default') and becomes a past paper (Tier 2) only when triage reads a printed
--    paper code with high confidence. The student can change the type on the paper
--    (public.set_paper_type). Existing papers are recorded as the student's choice, so nothing
--    already filed is reclassified.

-- ── 1. Columns ────────────────────────────────────────────────────────────

alter table public.question_region
  add column if not exists placed_label text,
  add column if not exists review_deferred_at timestamptz;

alter table public.question_region
  add constraint question_region_placed_label_shape
  check (placed_label is null or (length(placed_label) between 1 and 24 and placed_label ~ '[0-9]'));

comment on column public.question_region.placed_label is
  'The label the student saw this part under, from the shared placement walk (placeRegions in src/questionCount.js): "3(c)" for a bare "(c)" placed under question 3. Null when the part could not be placed. commit_extraction_run checks duplicates on this, falling back to question_label (AXO-216).';
comment on column public.question_region.review_deferred_at is
  'Set when the student chose "Not now" on a flagged part of a saved paper. The part stays unsure and out of analytics; the card stops asking. Cleared when the student fixes or confirms it (AXO-216).';

-- Existing papers keep the type the student chose; new ones default to a school test.
alter table public.paper
  add column if not exists type_source text not null default 'student';
alter table public.paper
  alter column type_source set default 'default';
alter table public.paper
  add constraint paper_type_source_known check (type_source in ('default', 'triage', 'student'));

comment on column public.paper.type_source is
  'Who decided the paper type. default: nobody yet (a school test); triage: a printed paper code read with high confidence made it a past paper; student: the student chose it. Only a default type is ever changed automatically (D7, AXO-216).';

-- Changing a paper's tier moves its saved attempts with it.
alter table public.student_attempt
  drop constraint student_attempt_paper_id_paper_tier_fkey;
alter table public.student_attempt
  add constraint student_attempt_paper_id_paper_tier_fkey
  foreign key (paper_id, paper_tier) references public.paper(id, tier)
  on update cascade on delete cascade;

-- ── 2. Commit ─────────────────────────────────────────────────────────────

create or replace function public.commit_extraction_run(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_run         public.extraction_run;
  v_paper       public.paper;
  v_region      public.question_region;
  v_attempt     uuid;
  v_committed   integer := 0;
  v_dupes       integer;
  v_dupe_labels text;
  v_skipped     integer := 0;
  v_confidence  public.confidence;
begin
  select * into v_run from public.extraction_run where id = p_run_id;
  if v_run.id is null then
    raise exception 'no such extraction run' using errcode = 'P0002';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('role', true), 'none') not in ('none', 'postgres', 'service_role')
     and not private.student_scope_allows(v_run.student_id) then
    raise exception 'active student scope required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_run.paper_id::text, 0));
  select * into v_run from public.extraction_run where id = p_run_id for update;
  if v_run.id is null then raise exception 'no such extraction run' using errcode = 'P0002'; end if;
  if v_run.committed_at is not null then
    raise exception 'this run is already committed' using errcode = '23505';
  end if;

  if v_run.status not in ('needs_review', 'explaining', 'ready') then
    raise exception 'This paper is no longer ready to save. Open it from the Library.' using errcode = '42501';
  end if;
  select * into v_paper from public.paper where id = v_run.paper_id;

  perform 1 from public.question_region where run_id = p_run_id for update;
  if exists (select 1 from public.question_region where run_id = p_run_id
             and (student_id <> v_run.student_id or paper_id <> v_run.paper_id)) then
    raise exception 'Region ownership does not match its run' using errcode = '42501';
  end if;

  -- No wait for flagged parts (D1): a flagged part the student has not confirmed is stored as
  -- unsure below, and stays out of analytics until they check it.

  if coalesce((v_run.adjudication ->> 'blocks_commit')::boolean, false) then
    raise exception 'This paper needs a person to look at it first: %',
      coalesce(v_run.adjudication ->> 'blocked_reason', 'the adjudication reported a structural problem')
      using errcode = '42501';
  end if;

  -- The label the student saw, and only labels with a number: the same rule as the unique index
  -- question_region_one_label_per_run. A bare "(c)" with no question placed is not a duplicate of
  -- anything; two parts both placed as "3(c)" are.
  select count(*), string_agg(label, ', ' order by label)
    into v_dupes, v_dupe_labels
    from (
      select min(coalesce(placed_label, question_label)) as label
        from public.question_region
       where run_id = p_run_id
         and coalesce(placed_label, question_label) ~ '[0-9]'
       group by lower(regexp_replace(coalesce(placed_label, question_label), '[^A-Za-z0-9]', '', 'g'))
      having count(*) > 1
    ) d;
  if v_dupes > 0 then
    raise exception 'Two parts of this paper are both read as %, so Axon cannot tell which mark belongs to which. Choose Check the reading and change the label on one of them.', v_dupe_labels
      using errcode = '42501';
  end if;

  for v_region in
    select * from public.question_region
    where run_id = p_run_id
    order by order_index for update
  loop
    if v_region.confidence_tier = 'unreadable' then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_region.marks_awarded is null or v_region.marks_available is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- A flagged part the student has not checked is unsure, whatever its tier.
    v_confidence := case
      when v_region.needs_review and v_region.student_confirmed_at is null then 'unsure'::public.confidence
      when v_region.confidence_tier = 'confident' then 'likely'::public.confidence
      else 'unsure'::public.confidence end;

    insert into public.student_attempt (
      student_id, paper_id, paper_tier, canonical_question_id,
      question_label, question_text,
      student_answer, answer_block, marks_awarded, max_marks, marks_source, teacher_remark,
      extraction_confidence,
      student_confirmed_at
    ) values (
      v_region.student_id, v_region.paper_id, v_paper.tier,
      case when v_paper.tier = 'tier_2' then v_region.canonical_question_id end,
      coalesce(v_region.question_label, 'Q' || (v_region.order_index + 1)),
      v_region.question_text, v_region.student_answer, v_region.answer_block,
      v_region.marks_awarded, v_region.marks_available,
      'teacher_pen',
      v_region.teacher_remark,
      v_confidence,
      v_region.student_confirmed_at
    )
    returning id into v_attempt;

    update public.question_region
       set committed_attempt_id = v_attempt, updated_at = now()
     where id = v_region.id;

    insert into public.mark_loss_event (
      attempt_id, student_id, cause, marks_lost, ai_explanation, do_this_next, confidence,
      concepts,
      command_word, command_word_note, model_answer, loss_reasons,
      grounding_status, model_answer_source, depends_on_parts, unresolved_parts
    )
    select v_attempt, e.student_id, e.cause, e.marks_lost, e.body, e.do_this_next,
           v_confidence,
           coalesce(e.concepts, '{}'),
           e.command_word, e.command_word_note, e.model_answer,
           coalesce(e.loss_reasons, '[]'::jsonb),
           e.grounding_status, e.model_answer_source,
           coalesce(e.depends_on_parts, '{}'),
           coalesce(e.unresolved_parts, '{}')
      from public.region_explanation e
     where e.region_id = v_region.id
       and e.student_id = v_region.student_id
       and e.run_id = p_run_id
       and e.cause is not null
       and e.marks_lost is not null
       and e.marks_lost <= v_region.marks_available - v_region.marks_awarded;

    v_committed := v_committed + 1;
  end loop;

  -- The paper's totals are the sum of the marks saved. When the paper printed no total the figure
  -- is Axon's own addition (total_basis = 'added_up'), and it is a lower bound (total_partial) when
  -- a part's mark could not be read. Left alone when nothing committed.
  update public.paper p
     set total_awarded   = s.awarded,
         total_available = s.available,
         total_basis     = case when v_paper.reported_total is not null then 'printed' else 'added_up' end,
         reconciled = case when v_paper.reported_total is null or s.awarded is null then null
                           else s.awarded = v_paper.reported_total end,
         total_partial = v_skipped > 0 or exists (
           select 1 from public.page_unreadable u
           join public.paper_page pg on pg.paper_id = u.paper_id and pg.student_id = u.student_id and pg.page_number = u.page_number
           where u.paper_id = v_run.paper_id and u.student_id = v_run.student_id
             and pg.structure_status in ('unreadable', 'failed')
         )
    from (select sum(marks_awarded) awarded, sum(max_marks) available
            from public.student_attempt where paper_id = v_run.paper_id and student_id = v_run.student_id) s
   where p.id = v_run.paper_id and v_committed > 0;

  update public.extraction_run
     set status = 'committed', committed_at = now(), finished_at = coalesce(finished_at, now())
   where id = p_run_id;

  return jsonb_build_object(
    'run_id', p_run_id,
    'attempts_committed', v_committed,
    'reconciled', v_run.reconciled,
    'reconcile_delta', v_run.reconcile_delta
  );
end;
$function$;

-- ── 3. Explanations wait for the student's check, without holding the paper ──

create or replace function public.begin_explanations(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_regions uuid[];
begin
  perform private.run_lock(p_run_id);

  if (select status from public.extraction_run where id = p_run_id) not in ('needs_review', 'explaining') then
    return jsonb_build_object('queued', 0, 'region_ids', '[]'::jsonb);
  end if;
  perform public.run_advance(p_run_id, 'explaining');

  -- A flagged part the student has not checked is not explained yet (its explanation is not
  -- shown while it is unsure). It is held, not refused: the rest of the paper goes ahead, and
  -- retry_failed_explanations picks it up once the student has checked it.
  update public.question_region r
     set explain_status = 'skipped', explain_failure_reason = 'held_for_check'
   where r.run_id = p_run_id
     and r.explain_status = 'pending'
     and r.needs_review
     and r.student_confirmed_at is null;

  update public.question_region r
     set explain_status = 'skipped'
   where r.run_id = p_run_id
     and r.explain_status = 'pending'
     and (r.confidence_tier = 'unreadable'
          or r.marks_awarded is null or r.marks_available is null
          or r.marks_awarded >= r.marks_available);

  select array_agg(id) into v_regions from (
    select r.id from public.question_region r
     where r.run_id = p_run_id and r.explain_status = 'pending'
     order by (r.marks_available - r.marks_awarded) desc, r.order_index
  ) ordered;

  update public.question_region
     set explain_status = 'queued'
   where id = any(coalesce(v_regions, '{}'::uuid[]));

  if not exists (select 1 from public.question_region
                  where run_id = p_run_id and explain_status in ('pending', 'queued', 'running')) then
    perform public.run_advance(p_run_id, 'ready');
  end if;

  return jsonb_build_object('queued', coalesce(array_length(v_regions, 1), 0),
                             'region_ids', coalesce(to_jsonb(v_regions), '[]'::jsonb));
end; $function$;

create or replace function public.retry_failed_explanations(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_regions uuid[];
begin
  perform private.run_lock(p_run_id);

  -- Failed explanations, and explanations held for a part the student has now checked (AXO-216).
  select array_agg(id order by (marks_available - marks_awarded) desc, order_index) into v_regions
    from public.question_region
   where run_id = p_run_id
     and (explain_status = 'failed'
          or (explain_status = 'skipped' and explain_failure_reason = 'held_for_check'))
     and student_confirmed_at is not null
     and confidence_tier <> 'unreadable'
     and marks_awarded is not null and marks_available is not null
     and marks_awarded < marks_available;

  update public.question_region
     set explain_status = 'queued',
         explain_failure_reason = null,
         updated_at = now()
   where id = any(coalesce(v_regions, '{}'::uuid[]));

  -- The run's own status is left alone: an `explaining` run keeps explaining, and a run that
  -- is already ready or committed is not pulled back (run_advance would refuse anyway).
  return jsonb_build_object(
    'queued', coalesce(array_length(v_regions, 1), 0),
    'region_ids', coalesce(to_jsonb(v_regions), '[]'::jsonb));
end; $function$;

revoke all on function public.retry_failed_explanations(uuid) from public, anon, authenticated;
grant execute on function public.retry_failed_explanations(uuid) to service_role;
revoke all on function public.begin_explanations(uuid) from public, anon, authenticated;
grant execute on function public.begin_explanations(uuid) to service_role;

-- ── 4. Fix a part of a saved paper ─────────────────────────────────────────
-- "Fix this" and "That's right" after the paper is saved. The student is the authority on what
-- their paper says (Axon.md section 8): the reading is accepted at once and the part counts as
-- checked. The mark stays the teacher's (marks_source teacher_pen); this only corrects how it
-- was read. A null argument leaves that field as it is.

create or replace function private.fix_saved_part(
  p_region_id uuid,
  p_marks_awarded numeric,
  p_marks_available numeric,
  p_answer text,
  p_set_answer boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r               public.question_region;
  v_run           public.extraction_run;
  v_paper         public.paper;
  v_awarded       numeric;
  v_available     numeric;
  v_answer        text;
  v_box           jsonb;
  v_marks_changed boolean;
  v_answer_changed boolean;
  v_tier          public.confidence_tier;
  v_attempt       uuid;
  v_explain       boolean := false;
begin
  select * into r from public.question_region where id = p_region_id;
  if r.id is null or not private.student_scope_allows(r.student_id) then
    raise exception 'That part is not open in this profile.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(r.paper_id::text, 0));
  select * into r from public.question_region where id = p_region_id for update;
  select * into v_run from public.extraction_run where id = r.run_id;
  if v_run.committed_at is null then
    raise exception 'This paper is not saved yet. Fix it in Check the reading.' using errcode = '42501';
  end if;
  select * into v_paper from public.paper where id = r.paper_id;

  v_awarded := coalesce(p_marks_awarded, r.marks_awarded);
  v_available := coalesce(p_marks_available, r.marks_available);
  if v_available is not null and (v_available <= 0 or v_available <> floor(v_available)) then
    raise exception 'How many marks the part is worth has to be a whole number above 0.' using errcode = '22023';
  end if;
  if v_awarded is not null and (v_awarded < 0 or v_awarded <> floor(v_awarded)) then
    raise exception 'Choose the whole number your teacher wrote.' using errcode = '22023';
  end if;
  if v_awarded is not null and v_available is not null and v_awarded > v_available then
    raise exception 'This part is out of %, so % cannot be the mark on it.', v_available, v_awarded using errcode = '22023';
  end if;

  v_answer := case when p_set_answer then nullif(btrim(coalesce(p_answer, '')), '') else r.student_answer end;
  v_marks_changed := v_awarded is distinct from r.marks_awarded or v_available is distinct from r.marks_available;
  v_answer_changed := v_answer is distinct from r.student_answer;

  -- Provenance survives a correction: the box stays the one the value was read from or, where
  -- none was found, the part's own region, which is where the student was looking.
  if r.page_spans is not null and jsonb_typeof(r.page_spans) = 'array' and jsonb_array_length(r.page_spans) > 0 then
    v_box := jsonb_build_object('page', r.page_spans -> 0 -> 'page') || coalesce(r.page_spans -> 0 -> 'box', '{}'::jsonb);
  end if;
  if v_box is null and (
       (v_awarded is not null and r.marks_awarded_box is null)
    or (v_available is not null and r.marks_available_box is null)
    or (v_answer is not null and r.student_answer_box is null)) then
    raise exception 'This part has no place on the page to tie the reading to. Rescan the paper to read it again.' using errcode = '22023';
  end if;

  -- An unreadable part the student has now read for us is no longer unreadable.
  v_tier := case when r.confidence_tier = 'unreadable' and (v_marks_changed or v_answer_changed)
                 then 'unsure'::public.confidence_tier else r.confidence_tier end;

  update public.question_region
     set marks_awarded = v_awarded,
         marks_awarded_box = case when v_awarded is null then null else coalesce(marks_awarded_box, v_box) end,
         marks_available = v_available,
         marks_available_box = case when v_available is null then null else coalesce(marks_available_box, v_box) end,
         student_answer = v_answer,
         student_answer_box = case when v_answer is null then null else coalesce(student_answer_box, v_box) end,
         answer_block = case when v_answer_changed then null else answer_block end,
         confidence_tier = v_tier,
         student_corrected = student_corrected or v_marks_changed or v_answer_changed,
         student_confirmed_at = now(),
         review_deferred_at = null,
         updated_at = now()
   where id = r.id;

  if r.committed_attempt_id is not null then
    update public.student_attempt
       set marks_awarded = v_awarded,
           max_marks = v_available,
           student_answer = v_answer,
           answer_block = case when v_answer_changed then null else answer_block end,
           student_confirmed_at = now(),
           updated_at = now()
     where id = r.committed_attempt_id;
    v_attempt := r.committed_attempt_id;
    -- An explanation written for a mark that was misread no longer applies. The student's own
    -- rejection of a cause is kept.
    if v_marks_changed then
      delete from public.mark_loss_event where attempt_id = v_attempt and student_rejected_at is null;
    end if;
  elsif v_awarded is not null and v_available is not null and v_tier <> 'unreadable' then
    insert into public.student_attempt (
      student_id, paper_id, paper_tier, canonical_question_id,
      question_label, question_text,
      student_answer, answer_block, marks_awarded, max_marks, marks_source, teacher_remark,
      extraction_confidence, student_confirmed_at
    ) values (
      r.student_id, r.paper_id, v_paper.tier,
      case when v_paper.tier = 'tier_2' then r.canonical_question_id end,
      coalesce(r.question_label, 'Q' || (r.order_index + 1)),
      r.question_text, v_answer, case when v_answer_changed then null else r.answer_block end,
      v_awarded, v_available, 'teacher_pen', r.teacher_remark,
      case when v_tier = 'confident' then 'likely'::public.confidence else 'unsure'::public.confidence end,
      now()
    )
    returning id into v_attempt;
    update public.question_region set committed_attempt_id = v_attempt where id = r.id;
  end if;

  -- The explanation was held for this check, or the mark it explained changed: let the retry
  -- path write it now.
  if v_attempt is not null and v_awarded < v_available
     and (r.explain_status in ('pending', 'skipped') or v_marks_changed) then
    update public.question_region
       set explain_status = 'skipped', explain_failure_reason = 'held_for_check'
     where id = r.id and explain_status not in ('queued', 'running');
    v_explain := true;
  end if;

  if v_attempt is not null then
    update public.paper p
       set total_awarded   = s.awarded,
           total_available = s.available,
           total_basis     = case when v_paper.reported_total is not null then 'printed' else 'added_up' end,
           reconciled = case when v_paper.reported_total is null or s.awarded is null then null
                             else s.awarded = v_paper.reported_total end,
           total_partial = exists (
             select 1 from public.question_region q
              where q.run_id = r.run_id and q.committed_attempt_id is null
           ) or exists (
             select 1 from public.page_unreadable u
             join public.paper_page pg on pg.paper_id = u.paper_id and pg.student_id = u.student_id and pg.page_number = u.page_number
             where u.paper_id = r.paper_id and u.student_id = r.student_id
               and pg.structure_status in ('unreadable', 'failed')
           )
      from (select sum(marks_awarded) awarded, sum(max_marks) available
              from public.student_attempt where paper_id = r.paper_id and student_id = r.student_id) s
     where p.id = r.paper_id;
  end if;

  return jsonb_build_object('region_id', r.id, 'attempt_id', v_attempt, 'run_id', r.run_id, 'explain', v_explain);
end;
$function$;

revoke all on function private.fix_saved_part(uuid, numeric, numeric, text, boolean) from public, anon;
grant execute on function private.fix_saved_part(uuid, numeric, numeric, text, boolean) to authenticated;

create or replace function public.fix_saved_part(
  p_region_id uuid,
  p_marks_awarded numeric default null,
  p_marks_available numeric default null,
  p_answer text default null,
  p_set_answer boolean default false
)
returns jsonb
language sql
security invoker
set search_path to ''
as $function$
  select private.fix_saved_part(p_region_id, p_marks_awarded, p_marks_available, p_answer, p_set_answer);
$function$;

revoke all on function public.fix_saved_part(uuid, numeric, numeric, text, boolean) from public, anon;
grant execute on function public.fix_saved_part(uuid, numeric, numeric, text, boolean) to authenticated;

-- ── 5. Paper type (D7) ────────────────────────────────────────────────────

create or replace function private.promote_paper_by_printed_code()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Never let classification fail a pipeline write.
  begin
    if nullif(btrim(new.tier_routing #>> '{triage,assessment_identity,paper_code}'), '') is not null
       and nullif(btrim(new.tier_routing #>> '{triage,assessment_identity,subject_code}'), '') is not null
       and new.tier_routing #>> '{triage,assessment_identity,confidence}' = 'high' then
      update public.paper
         set type = 'pyq', tier = 'tier_2', type_source = 'triage'
       where id = new.paper_id
         and type_source = 'default';
    end if;
  exception when others then
    raise warning 'paper type from printed code skipped for paper %: %', new.paper_id, sqlerrm;
  end;
  return null;
end;
$function$;

revoke all on function private.promote_paper_by_printed_code() from public, anon, authenticated;

create trigger extraction_run_printed_code_type
  after insert or update of tier_routing on public.extraction_run
  for each row
  when (new.tier_routing is not null)
  execute function private.promote_paper_by_printed_code();

-- The student changes the type on the paper. Row-level security decides whose paper it is.
create or replace function public.set_paper_type(p_paper_id uuid, p_type public.paper_type)
returns void
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_tier public.paper_tier := case when p_type in ('pyq', 'sample_paper')
                                   then 'tier_2'::public.paper_tier else 'tier_1'::public.paper_tier end;
begin
  if not exists (select 1 from public.paper where id = p_paper_id) then
    raise exception 'That paper is not open in this profile.' using errcode = '42501';
  end if;
  -- A school test has no official question to match (tier_1_has_no_canonical_question).
  if v_tier = 'tier_1' then
    update public.student_attempt
       set canonical_question_id = null
     where paper_id = p_paper_id and canonical_question_id is not null;
  end if;
  update public.paper
     set type = p_type, tier = v_tier, type_source = 'student'
   where id = p_paper_id;
  if not found then
    raise exception 'That paper is not open in this profile.' using errcode = '42501';
  end if;
end;
$function$;

revoke all on function public.set_paper_type(uuid, public.paper_type) from public, anon;
grant execute on function public.set_paper_type(uuid, public.paper_type) to authenticated;

-- ── 6. The share page shows only checked work ─────────────────────────────

create or replace function public.resolve_academic_share(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'extensions', 'pg_temp'
as $function$
declare
  v_share private.academic_share%rowtype;
  v_result jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('found', false);
  end if;

  select *
    into v_share
    from private.academic_share
   where token_hash = digest(p_token, 'sha256')
     and revoked_at is null
     and expires_at > now()
   limit 1;

  if v_share.id is null then
    return jsonb_build_object('found', false);
  end if;

  -- Only parts that may reach analytics are shared (hard rule 3): an unsure part the student has
  -- not checked is withheld, and so is the total when any part is withheld.
  if v_share.resource_type = 'paper' then
    select jsonb_build_object(
      'found', true,
      'kind', 'paper',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
        'subject', p.subject,
        'total_awarded', case when totals.withheld = 0 then totals.total_awarded end,
        'total_available', case when totals.withheld = 0 then totals.total_available end,
        'reconciled', p.reconciled
      ),
      'withheld_parts', totals.withheld,
      'questions', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'question_label', a.question_label,
            'question_text', a.question_text,
            'student_answer', a.student_answer,
            'marks_awarded', a.marks_awarded,
            'max_marks', a.max_marks,
            'marks_source', a.marks_source,
            'teacher_remark', a.teacher_remark,
            'extraction_confidence', a.extraction_confidence,
            'feedback', case when loss.id is null then null else jsonb_build_object(
              'cause', loss.cause,
              'marks_lost', loss.marks_lost,
              'explanation', loss.ai_explanation,
              'do_this_next', loss.do_this_next,
              'command_word', loss.command_word,
              'command_word_note', loss.command_word_note,
              'loss_reasons', private.share_loss_reasons(loss.loss_reasons),
              'corrected_answer',
                case
                  when loss.model_answer is not null
                   and loss.grounding_status = 'complete'
                   and loss.model_answer_source is not null
                   and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                    then loss.model_answer
                  else null
                end,
              'corrected_answer_state',
                case
                  when loss.model_answer is not null
                   and loss.grounding_status = 'complete'
                   and loss.model_answer_source is not null
                   and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                    then 'available'
                  when loss.grounding_status <> 'complete'
                    or loss.model_answer_source is null
                    or coalesce(cardinality(loss.unresolved_parts), 0) > 0
                    then 'withheld'
                  else 'unavailable'
                end
            ) end
          )
          order by coalesce(qr.order_index, 32767), a.question_label nulls last, a.id
        )
        from public.student_attempt a
        left join lateral (
          select min(q.order_index) as order_index
            from public.question_region q
           where q.committed_attempt_id = a.id
        ) qr on true
        left join lateral (
          select m.*
            from public.mark_loss_event m
           where m.attempt_id = a.id
             and m.student_id = a.student_id
             and m.student_rejected_at is null
           order by m.created_at desc, m.id
           limit 1
        ) loss on true
        where a.paper_id = v_share.paper_id
          and a.student_id = v_share.student_id
          and (a.extraction_confidence <> 'unsure' or a.student_confirmed_at is not null)
      ), '[]'::jsonb)
    )
    into v_result
    from public.paper p
    left join lateral (
      select sum(a.marks_awarded) as total_awarded,
             sum(a.max_marks) as total_available,
             count(*) filter (where a.extraction_confidence = 'unsure' and a.student_confirmed_at is null) as withheld
        from public.student_attempt a
       where a.paper_id = p.id
         and a.student_id = p.student_id
    ) totals on true
    where p.id = v_share.paper_id
      and p.student_id = v_share.student_id;
  else
    select case
      when a.extraction_confidence = 'unsure' and a.student_confirmed_at is null then jsonb_build_object(
        'found', true,
        'kind', 'question',
        'withheld', true,
        'expires_at', v_share.expires_at,
        'paper', jsonb_build_object(
          'type', p.type,
          'tier', p.tier,
          'date_taken', p.date_taken,
          'subject', p.subject
        )
      )
      else jsonb_build_object(
      'found', true,
      'kind', 'question',
      'expires_at', v_share.expires_at,
      'paper', jsonb_build_object(
        'type', p.type,
        'tier', p.tier,
        'date_taken', p.date_taken,
        'subject', p.subject
      ),
      'question', jsonb_build_object(
        'question_label', a.question_label,
        'question_text', a.question_text,
        'student_answer', a.student_answer,
        'marks_awarded', a.marks_awarded,
        'max_marks', a.max_marks,
        'marks_source', a.marks_source,
        'teacher_remark', a.teacher_remark,
        'extraction_confidence', a.extraction_confidence,
        'feedback', case when loss.id is null then null else jsonb_build_object(
          'cause', loss.cause,
          'marks_lost', loss.marks_lost,
          'explanation', loss.ai_explanation,
          'do_this_next', loss.do_this_next,
          'command_word', loss.command_word,
          'command_word_note', loss.command_word_note,
          'loss_reasons', private.share_loss_reasons(loss.loss_reasons),
          'corrected_answer',
            case
              when loss.model_answer is not null
               and loss.grounding_status = 'complete'
               and loss.model_answer_source is not null
               and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                then loss.model_answer
              else null
            end,
          'corrected_answer_state',
            case
              when loss.model_answer is not null
               and loss.grounding_status = 'complete'
               and loss.model_answer_source is not null
               and coalesce(cardinality(loss.unresolved_parts), 0) = 0
                then 'available'
              when loss.grounding_status <> 'complete'
                or loss.model_answer_source is null
                or coalesce(cardinality(loss.unresolved_parts), 0) > 0
                then 'withheld'
              else 'unavailable'
            end
        ) end
      )
    ) end
    into v_result
    from public.student_attempt a
    join public.paper p
      on p.id = a.paper_id and p.student_id = a.student_id
    left join lateral (
      select m.*
        from public.mark_loss_event m
       where m.attempt_id = a.id
         and m.student_id = a.student_id
         and m.student_rejected_at is null
       order by m.created_at desc, m.id
       limit 1
    ) loss on true
    where a.id = v_share.attempt_id
      and a.paper_id = v_share.paper_id
      and a.student_id = v_share.student_id;
  end if;

  return coalesce(v_result, jsonb_build_object('found', false));
end;
$function$;

revoke all on function public.resolve_academic_share(text) from public;
grant execute on function public.resolve_academic_share(text) to anon, authenticated;
