-- AXO-244 Phase 0 (AXO-245 to AXO-249): the foundations of the student home,
-- the practice loop and v1 analytics.
--
--   syllabus_component, syllabus_ao,  reference data read off each board's own
--   command_word_ao                   syllabus (assessment overview), with the
--                                     page it came from
--   private.printed_command_word()    AXO-247 deterministic command-word read
--   private.inferred_ao()             AXO-248 AO from paper and command word
--   private.mistake_type()            AXO-249 the four mistake types, mapped from
--                                     the seven causes (owner, 13 Oct 2026: no
--                                     new cause value)
--   error_item                        AXO-246 one row per question part that
--                                     lost marks; the backbone of home/analytics
--   student_target_grade              AXO-245 target per subject
--   student_practice_pref             timezone, opt-in for grade predictions,
--                                     one-time prompt state, experiment cohort
--   tag_eval_label                    teacher/human labels that measure the
--                                     command word, AO and mistake-type tags
--
-- Hard rule 3: every error item is derived from attempt_analytics and
-- mark_loss_analytics, never from the base tables, so an unsure or rejected
-- reading can never become something a student is asked to practise.
-- Hard rule 1: nothing here writes a mark. Re-attempt results (AXO-256) are the
-- student's own check against the explanation and live in their own table.

-- ── reference: components and assessment objectives ────────────────────────
create table public.syllabus_component (
  provider_key    text not null check (provider_key in ('cambridge', 'cbse', 'ib')),
  syllabus_code   text not null check (syllabus_code ~ '^[0-9]{4}$'),
  paper           smallint not null check (paper between 1 and 9),
  title           text not null check (length(btrim(title)) > 0),
  -- Share of the qualification, as printed. Null where the paper is not part of
  -- that qualification ("not assessed at AS Level").
  as_weight_pct   numeric(5, 2) check (as_weight_pct between 0 and 100),
  a_weight_pct    numeric(5, 2) check (a_weight_pct between 0 and 100),
  max_marks       smallint check (max_marks > 0),
  -- {"AO1": 50, "AO2": 50} — the syllabus's own AO split for this paper.
  ao_weights      jsonb not null default '{}'::jsonb check (jsonb_typeof(ao_weights) = 'object'),
  -- How a question on this paper gets an AO:
  --   whole_paper   the paper assesses one AO only (a practical), so every
  --                 question carries it
  --   command_word  the syllabus's AOs follow the task the command word sets
  --   none          the syllabus does not separate AOs question by question
  --                 (Mathematics: every question mixes them); AO stays null
  ao_inference    text not null check (ao_inference in ('whole_paper', 'command_word', 'none')),
  source_url      text not null check (source_url ~ '^https://'),
  source_page     smallint check (source_page > 0),
  syllabus_version text not null check (length(btrim(syllabus_version)) > 0),
  checked_at      timestamptz not null,
  primary key (provider_key, syllabus_code, paper),
  check (as_weight_pct is not null or a_weight_pct is not null)
);

comment on table public.syllabus_component is
  'AXO-248. Each paper of a syllabus with its printed weighting and AO split, read from the syllabus assessment overview (source_url, source_page). Reference data only; no student data.';

create table public.syllabus_ao (
  provider_key   text not null check (provider_key in ('cambridge', 'cbse', 'ib')),
  syllabus_code  text not null check (syllabus_code ~ '^[0-9]{4}$'),
  ao             text not null check (ao ~ '^AO[1-9]$'),
  name           text not null check (length(btrim(name)) > 0),
  as_weight_pct  numeric(5, 2) check (as_weight_pct between 0 and 100),
  a_weight_pct   numeric(5, 2) check (a_weight_pct between 0 and 100),
  source_url     text not null check (source_url ~ '^https://'),
  source_page    smallint check (source_page > 0),
  primary key (provider_key, syllabus_code, ao)
);

comment on table public.syllabus_ao is
  'AXO-248. The assessment objectives a syllabus names, with the syllabus''s own weighting.';

create table public.command_word_ao (
  provider_key  text not null check (provider_key in ('cambridge', 'cbse', 'ib')),
  syllabus_code text not null check (syllabus_code ~ '^[0-9]{4}$'),
  command_word  text not null,
  ao            text not null check (ao ~ '^AO[1-9]$'),
  primary key (provider_key, syllabus_code, command_word)
);

comment on table public.command_word_ao is
  'AXO-248. For syllabuses whose AOs follow the task (ao_inference = command_word): which AO a command word sets. An unlisted word leaves AO null rather than guessing. Accuracy is measured against tag_eval_label, not assumed.';

alter table public.syllabus_component enable row level security;
alter table public.syllabus_ao enable row level security;
alter table public.command_word_ao enable row level security;
create policy syllabus_component_read on public.syllabus_component for select to authenticated using (true);
create policy syllabus_ao_read on public.syllabus_ao for select to authenticated using (true);
create policy command_word_ao_read on public.command_word_ao for select to authenticated using (true);
revoke all on public.syllabus_component, public.syllabus_ao, public.command_word_ao from anon, authenticated;
grant select on public.syllabus_component, public.syllabus_ao, public.command_word_ao to authenticated;

-- Seed: the most-used syllabus codes (student_subject, 13 Oct 2026). Numbers
-- are exactly as printed in each syllabus's assessment overview.
insert into public.syllabus_component
  (provider_key, syllabus_code, paper, title, as_weight_pct, a_weight_pct, max_marks, ao_weights, ao_inference, source_url, source_page, syllabus_version, checked_at)
values
  -- 9702 Physics 2025-2027, pp. 12 and 15
  ('cambridge','9702',1,'Multiple Choice',31,15.5,40,'{"AO1":50,"AO2":50}','command_word','https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9702',2,'AS Level Structured Questions',46,23,60,'{"AO1":50,"AO2":50}','command_word','https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9702',3,'Advanced Practical Skills',23,11.5,40,'{"AO3":100}','whole_paper','https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9702',4,'A Level Structured Questions',null,38.5,100,'{"AO1":50,"AO2":50}','command_word','https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9702',5,'Planning, Analysis and Evaluation',null,11.5,30,'{"AO3":100}','whole_paper','https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  -- 9701 Chemistry 2025-2027, pp. 12 and 15
  ('cambridge','9701',1,'Multiple Choice',31,15.5,40,'{"AO1":50,"AO2":50}','command_word','https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9701',2,'AS Level Structured Questions',46,23,60,'{"AO1":50,"AO2":50}','command_word','https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9701',3,'Advanced Practical Skills',23,11.5,40,'{"AO3":100}','whole_paper','https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9701',4,'A Level Structured Questions',null,38.5,100,'{"AO1":50,"AO2":50}','command_word','https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  ('cambridge','9701',5,'Planning, Analysis and Evaluation',null,11.5,30,'{"AO3":100}','whole_paper','https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',12,'2025-2027','2026-10-13'),
  -- 9709 Mathematics 2026-2027, pp. 15-16 and 18
  ('cambridge','9709',1,'Pure Mathematics 1',60,30,75,'{"AO1":55,"AO2":45}','none','https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',15,'2026-2027','2026-10-13'),
  ('cambridge','9709',2,'Pure Mathematics 2',40,null,50,'{"AO1":55,"AO2":45}','none','https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',15,'2026-2027','2026-10-13'),
  ('cambridge','9709',3,'Pure Mathematics 3',null,30,75,'{"AO1":45,"AO2":55}','none','https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',15,'2026-2027','2026-10-13'),
  ('cambridge','9709',4,'Mechanics',40,20,50,'{"AO1":55,"AO2":45}','none','https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',15,'2026-2027','2026-10-13'),
  ('cambridge','9709',5,'Probability & Statistics 1',40,20,50,'{"AO1":55,"AO2":45}','none','https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',16,'2026-2027','2026-10-13'),
  ('cambridge','9709',6,'Probability & Statistics 2',null,20,50,'{"AO1":55,"AO2":45}','none','https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',16,'2026-2027','2026-10-13'),
  -- 9231 Further Mathematics 2026-2027, pp. 12 and 15
  ('cambridge','9231',1,'Further Pure Mathematics 1',60,30,75,'{"AO1":45,"AO2":55}','none','https://www.cambridgeinternational.org/Images/697357-2026-2027-syllabus.pdf',12,'2026-2027','2026-10-13'),
  ('cambridge','9231',2,'Further Pure Mathematics 2',null,30,75,'{"AO1":45,"AO2":55}','none','https://www.cambridgeinternational.org/Images/697357-2026-2027-syllabus.pdf',12,'2026-2027','2026-10-13'),
  ('cambridge','9231',3,'Further Mechanics',40,20,50,'{"AO1":45,"AO2":55}','none','https://www.cambridgeinternational.org/Images/697357-2026-2027-syllabus.pdf',12,'2026-2027','2026-10-13'),
  ('cambridge','9231',4,'Further Probability & Statistics',40,20,50,'{"AO1":45,"AO2":55}','none','https://www.cambridgeinternational.org/Images/697357-2026-2027-syllabus.pdf',12,'2026-2027','2026-10-13'),
  -- 9618 Computer Science 2026, pp. 11 and 13
  ('cambridge','9618',1,'Theory Fundamentals',50,25,75,'{"AO1":60,"AO2":40}','command_word','https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf',11,'2026','2026-10-13'),
  ('cambridge','9618',2,'Fundamental Problem-solving and Programming Skills',50,25,75,'{"AO2":40,"AO3":60}','command_word','https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf',11,'2026','2026-10-13'),
  ('cambridge','9618',3,'Advanced Theory',null,25,75,'{"AO1":60,"AO2":40}','command_word','https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf',11,'2026','2026-10-13'),
  ('cambridge','9618',4,'Practical',null,25,75,'{"AO3":100}','whole_paper','https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf',11,'2026','2026-10-13'),
  -- 9708 Economics 2026-2028, pp. 11 and 14. Papers 1 and 3 are multiple
  -- choice: one item can be any AO, so no per-question AO is claimed.
  ('cambridge','9708',1,'AS Level Multiple Choice',33,17,30,'{"AO1":47,"AO2":40,"AO3":13}','none','https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf',11,'2026-2028','2026-10-13'),
  ('cambridge','9708',2,'AS Level Data Response and Essays',67,33,60,'{"AO1":33,"AO2":37,"AO3":30}','command_word','https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf',11,'2026-2028','2026-10-13'),
  ('cambridge','9708',3,'A Level Multiple Choice',null,17,30,'{"AO1":47,"AO2":40,"AO3":13}','none','https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf',11,'2026-2028','2026-10-13'),
  ('cambridge','9708',4,'A Level Data Response and Essays',null,33,60,'{"AO1":33,"AO2":37,"AO3":30}','command_word','https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf',11,'2026-2028','2026-10-13');

insert into public.syllabus_ao (provider_key, syllabus_code, ao, name, as_weight_pct, a_weight_pct, source_url, source_page) values
  ('cambridge','9702','AO1','Knowledge and understanding',40,40,'https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',15),
  ('cambridge','9702','AO2','Handling, applying and evaluating information',40,40,'https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',15),
  ('cambridge','9702','AO3','Experimental skills and investigations',20,20,'https://www.cambridgeinternational.org/Images/664565-2025-2027-syllabus.pdf',15),
  ('cambridge','9701','AO1','Knowledge and understanding',40,40,'https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',15),
  ('cambridge','9701','AO2','Handling, applying and evaluating information',40,40,'https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',15),
  ('cambridge','9701','AO3','Experimental skills and investigations',20,20,'https://www.cambridgeinternational.org/Images/664563-2025-2027-syllabus.pdf',15),
  ('cambridge','9709','AO1','Knowledge and understanding',55,52,'https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',18),
  ('cambridge','9709','AO2','Application and communication',45,48,'https://www.cambridgeinternational.org/Images/697427-2026-2027-syllabus.pdf',18),
  ('cambridge','9231','AO1','Knowledge and understanding',45,45,'https://www.cambridgeinternational.org/Images/697357-2026-2027-syllabus.pdf',15),
  ('cambridge','9231','AO2','Application and communication',55,55,'https://www.cambridgeinternational.org/Images/697357-2026-2027-syllabus.pdf',15),
  ('cambridge','9618','AO1','Knowledge and understanding',30,30,'https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf',13),
  ('cambridge','9618','AO2','Application of knowledge and understanding',40,30,'https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf',13),
  ('cambridge','9618','AO3','Design, programming and evaluation',30,40,'https://www.cambridgeinternational.org/Images/697372-2026-syllabus.pdf',13),
  ('cambridge','9708','AO1','Knowledge and understanding',35,35,'https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf',14),
  ('cambridge','9708','AO2','Analysis',40,40,'https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf',14),
  ('cambridge','9708','AO3','Evaluation',25,25,'https://www.cambridgeinternational.org/Images/697423-2026-2028-syllabus.pdf',14);

-- Which AO a command word sets, for the syllabuses where that is how the AOs
-- divide. Sciences: recall words are AO1, words that ask the candidate to work
-- with information are AO2. Economics: recall, analysis, evaluation.
-- Computer Science paper 1/3 words follow the same recall/apply split; on
-- paper 2 the design and programming words are AO3.
insert into public.command_word_ao (provider_key, syllabus_code, command_word, ao)
select 'cambridge', code, w, ao
  from unnest(array['9702', '9701']) code
 cross join (values
   ('State','AO1'),('Define','AO1'),('Give','AO1'),('Identify','AO1'),('Describe','AO1'),
   ('Outline','AO1'),('Write down','AO1'),
   ('Calculate','AO2'),('Explain','AO2'),('Suggest','AO2'),('Deduce','AO2'),('Determine','AO2'),
   ('Show that','AO2'),('Predict','AO2'),('Sketch','AO2'),('Estimate','AO2'),('Compare','AO2'),
   ('Evaluate','AO2'),('Analyse','AO2'),('Work out','AO2'),('Find','AO2'),('Comment','AO2'),
   ('Justify','AO2'),('Contrast','AO2'),('Infer','AO2')
 ) m(w, ao)
union all
select 'cambridge', '9708', w, ao from (values
   ('State','AO1'),('Define','AO1'),('Give','AO1'),('Identify','AO1'),('Describe','AO1'),('Outline','AO1'),
   ('Explain','AO2'),('Analyse','AO2'),('Calculate','AO2'),('Compare','AO2'),('Contrast','AO2'),
   ('Assess','AO3'),('Evaluate','AO3'),('Discuss','AO3'),('Consider','AO3'),('Justify','AO3'),
   ('How far / To what extent','AO3'),('Comment','AO3'),('Comment on','AO3')
 ) m(w, ao)
union all
select 'cambridge', '9618', w, ao from (values
   ('State','AO1'),('Define','AO1'),('Give','AO1'),('Identify','AO1'),('Describe','AO1'),
   ('Outline','AO1'),('Write down','AO1'),
   ('Explain','AO2'),('Calculate','AO2'),('Complete','AO2'),('Show','AO2'),('Compare','AO2'),
   ('Suggest','AO2'),('Trace','AO2'),('Deduce','AO2'),('Analyse','AO2'),
   ('Write','AO3'),('Design','AO3'),('Develop','AO3'),('Refine','AO3'),('Evaluate','AO3'),
   ('Justify','AO3'),('Test','AO3'),('Plan','AO3')
 ) m(w, ao)
on conflict do nothing;

-- ── AXO-247: the printed command word ──────────────────────────────────────
-- The closed list is the backend's (shared/src/command_words.ts). A printed
-- command word starts a sentence: the question text is scanned for list words
-- that open a clause, the stem's own sentences ("A ball is dropped…") never
-- match. One distinct word is a confident read. Two or more distinct words
-- ("Calculate … Explain …") is a multi-task part; the read is ambiguous and the
-- caller falls back to the explain stage's tag (the LLM fallback). Nothing is
-- guessed from a word buried mid-sentence.
create or replace function private.printed_command_word(p_text text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text  text;
  v_found text[];
  v_word  text;
begin
  if p_text is null or length(btrim(p_text)) = 0 then return null; end if;
  -- Drop a leading part label ("3", "(a)", "(ii)", "3(b)(ii)") and mark
  -- allocations ("[2]"), which are not sentences.
  v_text := regexp_replace(p_text, '^\s*(\(?[0-9]{1,2}\)?|\([a-z]{1,4}\)|[a-z]{1,4}\))(\s*(\([a-z]{1,4}\)|\([0-9]{1,2}\)))*\s*', '');
  v_text := regexp_replace(v_text, '\[\s*[0-9]+\s*\]', ' ', 'g');

  select array_agg(distinct canon order by canon) into v_found
    from (
      select case m[1]
               when 'How far' then 'How far / To what extent'
               when 'To what extent' then 'How far / To what extent'
               else m[1] end as canon
        from regexp_matches(
          v_text,
          '(?:^|[.?!;:]\s+|\n\s*)(Show that|Show your working|Write down|Work out|Comment on|How far|To what extent|Advise|Analyse|Annotate|Argue|Assess|Calculate|Comment|Compare|Consider|Contrast|Deduce|Define|Describe|Design|Determine|Develop|Devise|Discuss|Estimate|Evaluate|Experiment|Explain|Explore|Find|Give|Hence|Identify|Infer|Justify|Locate|Outline|Plan|Predict|Prove|Refine|Reflect|Sketch|State|Suggest|Summarise|Test|Trace|Verify|Write)\M',
          'g') m
    ) words
   -- "Show your working" is an instruction about presentation, and "Hence"
   -- introduces the real command word ("Hence find …"); neither is the task.
   where canon not in ('Show your working', 'Hence');

  -- After "Hence" the command word is printed in lower case ("Hence find x",
  -- "Hence, or otherwise, show that …"). Read it as the clause's command word.
  select array_agg(distinct w order by w) into v_found
    from (
      select unnest(coalesce(v_found, '{}')) as w
      union
      select case lower(m[1]) when 'show that' then 'Show that' when 'write down' then 'Write down'
                              when 'work out' then 'Work out' else initcap(m[1]) end
        from regexp_matches(
          v_text,
          '(?:^|[.?!;:]\s+|\n\s*)Hence,?\s+(?:or otherwise,?\s+)?(show that|write down|work out|find|deduce|determine|calculate|sketch|prove|state|explain|verify|estimate|give|suggest)\M',
          'g') m
    ) x
   where w is not null;

  if v_found is null or cardinality(v_found) = 0 then
    -- "Hence" on its own ("Hence, or otherwise, …") is the task.
    if v_text ~ '(?:^|[.?!;:]\s+|\n\s*)Hence\M' then return 'Hence'; end if;
    return null;
  end if;
  if cardinality(v_found) > 1 then return null; end if;
  v_word := v_found[1];
  return v_word;
end;
$$;

comment on function private.printed_command_word is
  'AXO-247. The Cambridge command word printed at the start of a clause in the question, from the closed list in axon-backend shared/src/command_words.ts. Null when there is none, or when two different command words make the read ambiguous.';

-- ── AXO-248: AO for one question ───────────────────────────────────────────
create or replace function private.inferred_ao(
  p_provider text, p_syllabus text, p_paper smallint, p_command_word text)
returns text
language sql
stable
set search_path = ''
as $$
  select case c.ao_inference
           when 'whole_paper' then (select k from jsonb_each(c.ao_weights) e(k, v) where v::numeric = 100 limit 1)
           when 'command_word' then (
             select m.ao from public.command_word_ao m
              where m.provider_key = c.provider_key and m.syllabus_code = c.syllabus_code
                and m.command_word = p_command_word
                -- An AO the paper does not assess is never assigned to it.
                and c.ao_weights ? m.ao)
           else null end
    from public.syllabus_component c
   where c.provider_key = p_provider and c.syllabus_code = p_syllabus and c.paper = p_paper;
$$;

-- ── AXO-249: the four mistake types, mapped from the seven causes ──────────
-- Owner decision 13 Oct 2026: keep the fixed cause enum; derive mistake types.
--   careless       procedural_slip, misread_question
--   technique      presentation, keyword_miss, incomplete, timed_out
--   misconception  conceptual_gap where the student wrote an answer
--   knowledge_gap  conceptual_gap where the answer is blank
-- The split of conceptual_gap rests on evidence already stored (the answer
-- was blank or it was not), never on a model's guess.
create or replace function private.mistake_type(p_cause public.loss_cause, p_answer_blank boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_cause
           when 'procedural_slip' then 'careless'
           when 'misread_question' then 'careless'
           when 'presentation' then 'technique'
           when 'keyword_miss' then 'technique'
           when 'incomplete' then 'technique'
           when 'timed_out' then 'technique'
           when 'conceptual_gap' then case when coalesce(p_answer_blank, false) then 'knowledge_gap' else 'misconception' end
         end;
$$;

-- ── flags ─────────────────────────────────────────────────────────────────
insert into private.feature_flag (key, enabled, note) values
  ('mistake_type_ui', false, 'AXO-249/253: mistake-type labels stay hidden from students until the teacher-labelled evaluation passes its bar (tag_eval_report).'),
  ('if_then_prompt', false, 'AXO-258: the "when will you do this?" prompt and its A/B split.')
on conflict (key) do nothing;

create or replace function public.practice_flags()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mistake_type_ui', private.flag('mistake_type_ui'),
    'if_then_prompt', private.flag('if_then_prompt'));
$$;
revoke all on function public.practice_flags() from public, anon;
grant execute on function public.practice_flags() to authenticated;

-- ── AXO-246: error items ───────────────────────────────────────────────────
create table public.error_item (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references public.student (id) on delete cascade,
  -- See private.sync_error_items: dedupe_key is this paper and part, fixed at
  -- creation; group_key joins a second scan of the same assessment to it.
  dedupe_key           text not null check (length(dedupe_key) > 0),
  group_key            text not null check (length(group_key) > 0),
  paper_id             uuid not null references public.paper (id) on delete cascade,
  -- Null once the attempt row is gone (a re-commit replaces attempts); the
  -- next sync either re-links the item or leaves it withdrawn, and the
  -- practice history survives either way.
  attempt_id           uuid references public.student_attempt (id) on delete set null,
  -- The eligible loss event that explains it, when the explain stage wrote one.
  mark_loss_event_id   uuid references public.mark_loss_event (id) on delete set null,
  question_label       text not null,
  marks_lost           numeric not null check (marks_lost > 0),
  marks_available      numeric not null check (marks_available > 0),
  subject              text,
  syllabus_code        text,
  paper_number         smallint,
  topic_id             uuid references public.syllabus_topic (id) on delete set null,
  ao                   text check (ao ~ '^AO[1-9]$'),
  command_word         text,
  command_word_source  text check (command_word_source in ('printed', 'model')),
  cause                public.loss_cause,
  mistake_type         text check (mistake_type in ('careless', 'technique', 'misconception', 'knowledge_gap')),
  paper_date           date not null,
  -- Practice state (AXO-252). Only the re-attempt RPC moves these.
  status               text not null default 'open' check (status in ('open', 'retried', 'fixed')),
  attempts             integer not null default 0 check (attempts >= 0),
  consecutive_passes   integer not null default 0 check (consecutive_passes >= 0),
  interval_step        smallint not null default 0 check (interval_step between 0 and 4),
  last_attempt_at      timestamptz,
  last_pass_at         timestamptz,
  next_review_at       timestamptz not null,
  -- Distinct papers in which the same topic (or command word) lost marks to
  -- the same cause. 1 means this paper only.
  recurrence_count     integer not null default 1 check (recurrence_count >= 1),
  -- Set when the source stops being eligible (rejected, reverted to unsure,
  -- deleted). The row and its practice history stay; it stops being shown.
  withdrawn_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (student_id, dedupe_key),
  check (marks_lost <= marks_available)
);

create index error_item_student_due_idx on public.error_item (student_id, next_review_at) where withdrawn_at is null;
create index error_item_attempt_idx on public.error_item (attempt_id);
create index error_item_paper_idx on public.error_item (paper_id);
create index error_item_loss_idx on public.error_item (mark_loss_event_id);
create index error_item_topic_idx on public.error_item (topic_id);
create index error_item_group_idx on public.error_item (student_id, group_key);

comment on table public.error_item is
  'AXO-246. One row per question part that lost marks, derived only from attempt_analytics and mark_loss_analytics (hard rule 3). Kept in step by private.sync_error_items; practice state is moved only by public.record_reattempt.';

alter table public.error_item enable row level security;
create policy error_item_select on public.error_item
  for select to authenticated using (private.student_scope_allows(student_id));
revoke all on public.error_item from anon, authenticated;
grant select on public.error_item to authenticated;

-- Which students need a re-sync. Pipeline writes only mark a student dirty
-- (one tiny upsert per row), so nothing heavy runs inside a commit and a
-- failure here can never fail a paper. The sync runs on the next read.
create table private.error_item_dirty (
  student_id uuid primary key,
  marked_at  timestamptz not null default now()
);
revoke all on private.error_item_dirty from public, anon, authenticated;

create or replace function private.mark_error_items_dirty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid;
begin
  if tg_op = 'DELETE' then v_student := old.student_id; else v_student := new.student_id; end if;
  if v_student is not null then
    insert into private.error_item_dirty (student_id) values (v_student)
    on conflict (student_id) do update set marked_at = now();
  end if;
  if tg_op = 'UPDATE' and old.student_id is distinct from new.student_id and old.student_id is not null then
    insert into private.error_item_dirty (student_id) values (old.student_id)
    on conflict (student_id) do update set marked_at = now();
  end if;
  return null;
end;
$$;
revoke all on function private.mark_error_items_dirty() from public, anon, authenticated;

create trigger error_item_dirty_attempt
  after insert or update or delete on public.student_attempt
  for each row execute function private.mark_error_items_dirty();
create trigger error_item_dirty_loss
  after insert or update or delete on public.mark_loss_event
  for each row execute function private.mark_error_items_dirty();
create trigger error_item_dirty_topic
  after insert or update or delete on public.region_topic
  for each row execute function private.mark_error_items_dirty();
create trigger error_item_dirty_paper
  after update of subject, exam_date, date_taken, assessment_identity_id, subject_offering_id or delete on public.paper
  for each row execute function private.mark_error_items_dirty();

-- Every existing student starts dirty, so the first read backfills them.
insert into private.error_item_dirty (student_id)
select id from public.student where deleted_at is null
on conflict do nothing;

-- The paper number of an identified paper ("component 42" is paper 4).
create or replace function private.paper_number_of(p_component text, p_paper_code text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when p_component ~ '^[0-9]{2}$' then
      case when left(p_component, 1) = '0' then right(p_component, 1)::smallint else left(p_component, 1)::smallint end
    when p_paper_code ~ '^[0-9]{1,2}$' then
      case when length(p_paper_code) = 2 and left(p_paper_code, 1) <> '0' then left(p_paper_code, 1)::smallint
           else right(p_paper_code, 1)::smallint end
    else null end;
$$;

-- Every eligible attempt of a student with what Axon can say about it: its
-- syllabus and paper, its command word (printed first, the explain stage's
-- closed-list tag as the fallback), its AO, its topic, and the eligible loss
-- event that explains it. Read only from attempt_analytics,
-- mark_loss_analytics and topic_evidence (hard rule 3). Shared by the error
-- items and the command-word/AO scorecard so the two can never disagree.
create or replace function private.attempt_tags(p_student uuid)
returns table (
  attempt_id uuid, paper_id uuid, question_label text, question_text text,
  answer_blank boolean, marks_awarded numeric, max_marks numeric,
  subject text, assessment_identity_id uuid, paper_date date, total_partial boolean,
  syllabus_code text, provider_key text, programme_key text, paper_number smallint,
  loss_id uuid, cause public.loss_cause, command_word text, command_word_source text,
  ao text, topic_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select a.id as attempt_id, a.paper_id, a.question_label, a.question_text, a.answer_blank,
           a.marks_awarded, a.max_marks,
           p.subject, p.assessment_identity_id,
           coalesce(p.exam_date, p.date_taken, p.created_at::date) as paper_date,
           coalesce(p.total_partial, false) as total_partial,
           coalesce(
             case when so.external_code ~ '^[0-9]{4}$' then so.external_code end,
             case when p.subject_external_code_snapshot ~ '^[0-9]{4}$' then p.subject_external_code_snapshot end,
             (select ss.syllabus_code from public.student_subject ss
               where ss.student_id = a.student_id and ss.subject = p.subject and ss.syllabus_code ~ '^[0-9]{4}$' limit 1)
           ) as syllabus_code,
           coalesce(pr.key, 'cambridge') as provider_key,
           cp.key as programme_key,
           private.paper_number_of(ai.component_code, ai.paper_code) as paper_number,
           private.printed_command_word(a.question_text) as printed_cw
      from public.attempt_analytics a
      join public.paper p on p.id = a.paper_id
      join public.student s on s.id = a.student_id
      left join public.curriculum_programme cp on cp.id = s.programme_id
      left join public.curriculum_provider pr on pr.id = cp.provider_id
      left join public.subject_offering so on so.id = p.subject_offering_id
      left join public.assessment_identity ai on ai.id = p.assessment_identity_id
     where a.student_id = p_student
       and a.marks_awarded is not null and a.max_marks is not null and a.max_marks > 0
  ),
  explained as (
    -- The eligible event carrying the most marks explains the part.
    select distinct on (m.attempt_id) m.attempt_id, m.id as loss_id, m.cause, m.command_word
      from public.mark_loss_analytics m
     where m.student_id = p_student
     order by m.attempt_id, m.marks_lost desc, m.created_at desc
  ),
  topic as (
    select distinct on (t.attempt_id) t.attempt_id, t.topic_id
      from public.topic_evidence t
     where t.student_id = p_student
     order by t.attempt_id, t.is_primary desc, (t.confidence = 'confirmed') desc, t.topic_id
  )
  select b.attempt_id, b.paper_id, b.question_label, b.question_text, b.answer_blank,
         b.marks_awarded, b.max_marks, b.subject, b.assessment_identity_id, b.paper_date, b.total_partial,
         b.syllabus_code, b.provider_key, b.programme_key, b.paper_number,
         e.loss_id, e.cause,
         coalesce(b.printed_cw, e.command_word),
         case when b.printed_cw is not null then 'printed' when e.command_word is not null then 'model' end,
         private.inferred_ao(b.provider_key, b.syllabus_code, b.paper_number, coalesce(b.printed_cw, e.command_word)),
         t.topic_id
    from base b
    left join explained e on e.attempt_id = b.attempt_id
    left join topic t on t.attempt_id = b.attempt_id;
$$;
revoke all on function private.attempt_tags(uuid) from public, anon, authenticated;

create or replace function private.sync_error_items(p_student uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_id uuid;
  v_touched uuid[] := '{}';
begin
  -- Serialise syncs per student: two tabs loading Home at once must not race.
  perform pg_advisory_xact_lock(hashtextextended('error_item_sync:' || p_student::text, 0));

  -- Two keys per part:
  --   dedupe_key  this paper and part label; fixed when the item is created
  --   group_key   the paper's official identity (when known, else the paper)
  --               and the label; a second scan of the same assessment shares it
  -- An existing item is found by group first, then by its own paper, so a
  -- paper identified after the fact keeps its item and its practice history.
  for r in
    select distinct on (x.group_key) x.*
      from (
        select t.*,
               t.paper_id::text || '|' || lower(regexp_replace(coalesce(t.question_label, ''), '\s+', '', 'g')) as dedupe_key,
               coalesce(t.assessment_identity_id, t.paper_id)::text || '|' ||
                 lower(regexp_replace(coalesce(t.question_label, ''), '\s+', '', 'g')) as group_key
          from private.attempt_tags(p_student) t
         where t.marks_awarded < t.max_marks
      ) x
     -- The latest scan of one assessment is the reading that counts.
     order by x.group_key, x.paper_date desc, x.attempt_id
  loop
    select e.id into v_id from public.error_item e
     where e.student_id = p_student and (e.group_key = r.group_key or e.dedupe_key = r.dedupe_key)
     order by (e.group_key = r.group_key) desc, e.withdrawn_at nulls first, e.created_at
     limit 1;

    if v_id is null then
      insert into public.error_item (
        student_id, dedupe_key, group_key, paper_id, attempt_id, mark_loss_event_id, question_label,
        marks_lost, marks_available, subject, syllabus_code, paper_number, topic_id, ao,
        command_word, command_word_source, cause, mistake_type, paper_date, next_review_at)
      values (
        p_student, r.dedupe_key, r.group_key, r.paper_id, r.attempt_id, r.loss_id, coalesce(r.question_label, ''),
        r.max_marks - r.marks_awarded, r.max_marks, r.subject, r.syllabus_code, r.paper_number, r.topic_id, r.ao,
        r.command_word, r.command_word_source, r.cause,
        case when r.cause is not null then private.mistake_type(r.cause, r.answer_blank) end,
        r.paper_date,
        -- First re-attempt a day after the paper; an older backfilled part is
        -- simply due now.
        greatest(now(), r.paper_date::timestamptz + interval '1 day'))
      returning id into v_id;
    else
      update public.error_item e set
        group_key = r.group_key,
        paper_id = r.paper_id,
        attempt_id = r.attempt_id,
        mark_loss_event_id = r.loss_id,
        question_label = coalesce(r.question_label, ''),
        marks_lost = r.max_marks - r.marks_awarded,
        marks_available = r.max_marks,
        subject = r.subject,
        syllabus_code = r.syllabus_code,
        paper_number = r.paper_number,
        topic_id = r.topic_id,
        ao = r.ao,
        command_word = r.command_word,
        command_word_source = r.command_word_source,
        cause = r.cause,
        mistake_type = case when r.cause is not null then private.mistake_type(r.cause, r.answer_blank) end,
        paper_date = r.paper_date,
        withdrawn_at = null,
        updated_at = now()
       where e.id = v_id
         and (e.group_key, e.paper_id, e.attempt_id, e.mark_loss_event_id, e.marks_lost, e.marks_available,
              e.topic_id, e.ao, e.command_word, e.cause, e.subject, e.syllabus_code, e.paper_number, e.paper_date)
             is distinct from
             (r.group_key, r.paper_id, r.attempt_id, r.loss_id, r.max_marks - r.marks_awarded, r.max_marks,
              r.topic_id, r.ao, r.command_word, r.cause, r.subject, r.syllabus_code, r.paper_number, r.paper_date)
            or e.withdrawn_at is not null;
    end if;
    v_touched := v_touched || v_id;
  end loop;

  -- No longer eligible (rejected, back to unsure, deleted, or replaced by a
  -- later scan of the same assessment): withdraw, keep the history.
  update public.error_item e
     set withdrawn_at = now(), updated_at = now()
   where e.student_id = p_student and e.withdrawn_at is null and not (e.id = any (v_touched));

  -- Recurrence: distinct papers in which the same pattern (topic, else
  -- command word) lost marks to the same cause. A part with neither has no
  -- pattern to recur and stays at 1.
  update public.error_item ei
     set recurrence_count = r2.n
    from (
      select e.id,
             greatest(1, case when e.topic_id is null and e.command_word is null then 1
                  else (select count(distinct o.paper_id)::int from public.error_item o
                         where o.student_id = e.student_id and o.withdrawn_at is null
                           and o.cause is not distinct from e.cause
                           and coalesce(o.subject, '') = coalesce(e.subject, '')
                           and (case when e.topic_id is not null then o.topic_id = e.topic_id
                                     else o.topic_id is null and o.command_word = e.command_word end))
             end) as n
        from public.error_item e
       where e.student_id = p_student and e.withdrawn_at is null
    ) r2
   where ei.id = r2.id and ei.recurrence_count is distinct from r2.n;

  delete from private.error_item_dirty where student_id = p_student;
  return cardinality(v_touched);
end;
$$;

revoke all on function private.sync_error_items(uuid) from public, anon, authenticated;

-- Runs the sync only when something changed for the student since last time.
create or replace function private.ensure_error_items(p_student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.error_item_dirty where student_id = p_student)
     or not exists (select 1 from public.error_item where student_id = p_student) then
    perform private.sync_error_items(p_student);
  end if;
end;
$$;
revoke all on function private.ensure_error_items(uuid) from public, anon, authenticated;

create or replace function private.require_scope(p_student uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_student is null or not private.student_scope_allows(p_student) then
    raise exception 'student not in scope' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.require_scope(uuid) from public, anon;
grant execute on function private.require_scope(uuid) to authenticated;

create or replace function public.refresh_error_items(p_student uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_scope(p_student);
  perform private.ensure_error_items(p_student);
  return (select count(*)::int from public.error_item where student_id = p_student and withdrawn_at is null);
end;
$$;
revoke all on function public.refresh_error_items(uuid) from public, anon;
grant execute on function public.refresh_error_items(uuid) to authenticated;

-- ── AXO-245: target grade per subject ──────────────────────────────────────
-- The scale is the board's own, best first. Cambridge AS grades are printed in
-- lower case; IGCSE syllabuses grade either A*-G or 9-1.
create or replace function private.grade_scale(p_programme_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_programme_key
    when 'cambridge_a_level' then array['A*','A','B','C','D','E']
    when 'cambridge_as' then array['a','b','c','d','e']
    when 'cambridge_igcse' then array['A*','A','B','C','D','E','F','G','9','8','7','6','5','4','3','2','1']
    when 'cbse_secondary' then array['A1','A2','B1','B2','C1','C2','D1','D2','E']
    when 'cbse_senior_secondary' then array['A1','A2','B1','B2','C1','C2','D1','D2','E']
    when 'ibdp' then array['7','6','5','4','3','2','1']
  end;
$$;

create table public.student_target_grade (
  student_id  uuid not null references public.student (id) on delete cascade,
  subject     text not null,
  grade       text not null check (length(btrim(grade)) between 1 and 3),
  -- What Axon suggested when the student chose, if they had asked for one.
  -- Kept so the suggestion can be told apart from the choice later.
  suggested   text,
  updated_at  timestamptz not null default now(),
  primary key (student_id, subject),
  foreign key (student_id, subject) references public.student_subject (student_id, subject) on delete cascade
);

comment on table public.student_target_grade is
  'AXO-245. The grade the student is aiming for, per subject, in the board''s own scale. Set and changed only through public.set_target_grade.';

alter table public.student_target_grade enable row level security;
create policy student_target_grade_select on public.student_target_grade
  for select to authenticated using (private.student_scope_allows(student_id));
revoke all on public.student_target_grade from anon, authenticated;
grant select on public.student_target_grade to authenticated;

create table public.student_practice_pref (
  student_id                 uuid primary key references public.student (id) on delete cascade,
  -- IANA zone the student's day is counted in (streaks, "today"). Written by
  -- the device; a bad value is refused.
  timezone                   text not null default 'UTC',
  -- AXO-245/262: grade suggestions and the outlook range are predictions, so
  -- they are opt-in and off by default (hard rule; owner, 13 Oct 2026).
  outlook_opt_in             boolean not null default false,
  target_prompt_dismissed_at timestamptz,
  -- AXO-258 experiment arm, fixed the first time the student is eligible.
  if_then_cohort             text check (if_then_cohort in ('prompt', 'control')),
  updated_at                 timestamptz not null default now()
);

alter table public.student_practice_pref enable row level security;
create policy student_practice_pref_select on public.student_practice_pref
  for select to authenticated using (private.student_scope_allows(student_id));
revoke all on public.student_practice_pref from anon, authenticated;
grant select on public.student_practice_pref to authenticated;

create or replace function public.set_target_grade(p_student uuid, p_subject text, p_grade text, p_suggested text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scale text[];
begin
  perform private.require_scope(p_student);
  select private.grade_scale(cp.key) into v_scale
    from public.student s left join public.curriculum_programme cp on cp.id = s.programme_id
   where s.id = p_student;
  if not exists (select 1 from public.student_subject where student_id = p_student and subject = p_subject) then
    raise exception 'not one of this student''s subjects' using errcode = '23514';
  end if;
  if p_grade is null then
    delete from public.student_target_grade where student_id = p_student and subject = p_subject;
    return;
  end if;
  if v_scale is null or not (p_grade = any (v_scale)) then
    raise exception 'grade % is not on this qualification''s scale', p_grade using errcode = '23514';
  end if;
  if p_suggested is not null and not (p_suggested = any (v_scale)) then
    raise exception 'suggested grade is not on the scale' using errcode = '23514';
  end if;
  insert into public.student_target_grade (student_id, subject, grade, suggested)
  values (p_student, p_subject, p_grade, p_suggested)
  on conflict (student_id, subject) do update
    set grade = excluded.grade, suggested = excluded.suggested, updated_at = now();
end;
$$;
revoke all on function public.set_target_grade(uuid, text, text, text) from public, anon;
grant execute on function public.set_target_grade(uuid, text, text, text) to authenticated;

create or replace function public.target_grade_scale(p_student uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_scope(p_student);
  return (select private.grade_scale(cp.key)
            from public.student s left join public.curriculum_programme cp on cp.id = s.programme_id
           where s.id = p_student);
end;
$$;
revoke all on function public.target_grade_scale(uuid) from public, anon;
grant execute on function public.target_grade_scale(uuid) to authenticated;

create or replace function public.set_practice_pref(
  p_student uuid,
  p_timezone text default null,
  p_outlook_opt_in boolean default null,
  p_dismiss_target_prompt boolean default null)
returns public.student_practice_pref
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.student_practice_pref;
begin
  perform private.require_scope(p_student);
  if p_timezone is not null and not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
  insert into public.student_practice_pref (student_id) values (p_student) on conflict do nothing;
  update public.student_practice_pref
     set timezone = coalesce(p_timezone, timezone),
         outlook_opt_in = coalesce(p_outlook_opt_in, outlook_opt_in),
         target_prompt_dismissed_at = case when p_dismiss_target_prompt then coalesce(target_prompt_dismissed_at, now())
                                           when p_dismiss_target_prompt is false then null
                                           else target_prompt_dismissed_at end,
         updated_at = now()
   where student_id = p_student
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.set_practice_pref(uuid, text, boolean, boolean) from public, anon;
grant execute on function public.set_practice_pref(uuid, text, boolean, boolean) to authenticated;

-- ── measuring the tags (AXO-247, 248, 249) ─────────────────────────────────
-- A person's label for one tag on one part. The report compares the automatic
-- tag with it, per class. Labels are entered by the owner or a teacher through
-- the service role (scripts/eval/tag-labels.mjs), never by a student.
create table public.tag_eval_label (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('command_word', 'ao', 'mistake_type')),
  attempt_id  uuid not null references public.student_attempt (id) on delete cascade,
  label       text not null check (length(btrim(label)) > 0),
  labelled_by text not null check (length(btrim(labelled_by)) > 0),
  labelled_at timestamptz not null default now(),
  unique (kind, attempt_id, labelled_by)
);
alter table public.tag_eval_label enable row level security;
revoke all on public.tag_eval_label from anon, authenticated;

-- Agreement per class; an empty result means nobody has labelled yet, which
-- is not the same as zero agreement.
create or replace function private.tag_eval_report(p_kind text)
returns table (class text, labelled integer, agreed integer, agreement numeric)
language sql
stable
security definer
set search_path = ''
as $$
  with pairs as (
    select l.label as truth,
           case p_kind when 'command_word' then e.command_word
                       when 'ao' then e.ao
                       when 'mistake_type' then e.mistake_type end as predicted
      from public.tag_eval_label l
      join public.error_item e on e.attempt_id = l.attempt_id and e.withdrawn_at is null
     where l.kind = p_kind
  )
  select coalesce(truth, '(all)'), count(*)::int, count(*) filter (where predicted = truth)::int,
         round(count(*) filter (where predicted = truth)::numeric / nullif(count(*), 0), 3)
    from pairs
   group by grouping sets ((truth), ())
   order by 1;
$$;
revoke all on function private.tag_eval_report(text) from public, anon, authenticated;
grant execute on function private.tag_eval_report(text) to service_role;
