-- ============================================================================
-- AXO-266: the weekly digest says what the student did and how they are doing
-- ============================================================================
--
-- Owner's call (13 Oct 2026): the email should answer what the student did that
-- week and how they are improving. Adds, to the payload only:
--   by_subject          per subject read this week: papers, questions counted,
--                       questions that lost marks, marks lost (up to 6)
--   earlier_questions / earlier_lost / trend
--                       this week against the student's earlier papers, both
--                       counts shown; only when each side has 10+ questions;
--                       trend is fewer | similar | more (a difference under a
--                       tenth of the questions reads as similar). Never a score,
--                       percentage, rank or prediction. Null means not enough
--                       yet, not zero.
-- Gate moves to notice 1.4.0, which lists these contents.
-- Wording is a draft for counsel (AXO-266), not legal advice.
-- ============================================================================

create or replace function private.build_parent_digest(p_student uuid, p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_first     text;
  v_from      timestamptz := (p_start::timestamp at time zone 'UTC');
  v_to        timestamptz := ((p_end + 1)::timestamp at time zone 'UTC');
  v_papers    integer;
  v_subjects  text[];
  v_counted   integer;
  v_lost_q    integer;
  v_lost_m    integer;
  v_ready     record;
  v_areas     jsonb := '[]'::jsonb;
  v_subj      jsonb := '[]'::jsonb;
  v_eq        integer;
  v_el        integer;
  v_trend     text;
begin
  select s.first_name into v_first
    from public.student s
   where s.id = p_student and s.deleted_at is null;
  if v_first is null then return null; end if;

  with wp as (
    select distinct r.paper_id
      from public.extraction_run r
     where r.student_id = p_student
       and r.status::text = 'committed'
       and r.committed_at >= v_from and r.committed_at < v_to
  ),
  att as (
    select a.id
      from public.attempt_analytics a
      join wp on wp.paper_id = a.paper_id
     where a.student_id = p_student
  ),
  loss as (
    select m.attempt_id, m.marks_lost
      from public.mark_loss_analytics m
      join att on att.id = m.attempt_id
     where m.student_id = p_student
  )
  select (select count(*) from wp)::int,
         (select count(*) from att)::int,
         (select count(distinct attempt_id) from loss)::int,
         (select coalesce(round(sum(marks_lost)), 0) from loss)::int
    into v_papers, v_counted, v_lost_q, v_lost_m;

  select coalesce(array_agg(distinct btrim(p.subject)) filter (where btrim(p.subject) <> ''), '{}')
    into v_subjects
    from public.paper p
   where p.id in (
     select r.paper_id from public.extraction_run r
      where r.student_id = p_student and r.status::text = 'committed'
        and r.committed_at >= v_from and r.committed_at < v_to);

  select rd.papers_counted, rd.questions_counted, rd.has_enough_data
    into v_ready
    from public.student_analytics_readiness rd
   where rd.student_id = p_student;

  if coalesce(v_ready.has_enough_data, false) then
    select coalesce(jsonb_agg(x order by x.marks_lost desc, x.questions desc, x.name), '[]'::jsonb)
      into v_areas
      from (
        select 'command_word'::text                         as kind,
               initcap(lower(btrim(m.command_word)))        as name,
               count(distinct m.attempt_id)::int            as questions,
               count(distinct a.paper_id)::int              as papers,
               round(sum(m.marks_lost))::int                as marks_lost
          from public.mark_loss_analytics m
          join public.attempt_analytics a on a.id = m.attempt_id
         where m.student_id = p_student
           and btrim(coalesce(m.command_word, '')) <> ''
         group by lower(btrim(m.command_word))
        having count(distinct m.attempt_id) >= 3
           and count(distinct a.paper_id) >= 2
         order by sum(m.marks_lost) desc, count(distinct m.attempt_id) desc, lower(btrim(m.command_word))
         limit 2
      ) x;
  end if;


  -- What they read, subject by subject (counts only: no scores, no percentages).
  select coalesce(jsonb_agg(x order by x.questions desc, x.subject), '[]'::jsonb)
    into v_subj
    from (
      select btrim(p.subject)                                   as subject,
             count(distinct a.paper_id)::int                    as papers,
             count(distinct a.id)::int                          as questions,
             count(distinct l.attempt_id)::int                  as lost_questions,
             coalesce(round(sum(l.marks_lost)), 0)::int         as marks_lost
        from public.attempt_analytics a
        join public.paper p on p.id = a.paper_id
        left join public.mark_loss_analytics l on l.attempt_id = a.id and l.student_id = p_student
       where a.student_id = p_student
         and btrim(coalesce(p.subject, '')) <> ''
         and a.paper_id in (
           select r.paper_id from public.extraction_run r
            where r.student_id = p_student and r.status::text = 'committed'
              and r.committed_at >= v_from and r.committed_at < v_to)
       group by btrim(p.subject)
       order by count(distinct a.id) desc, btrim(p.subject)
       limit 6
    ) x;

  -- Earlier work, to compare this week with. Papers first committed before this
  -- week and not touched in it. Shown only when both sides are large enough to
  -- mean something (10 questions each), and always with both counts.
  select count(distinct a.id)::int, count(distinct l.attempt_id)::int
    into v_eq, v_el
    from public.attempt_analytics a
    left join public.mark_loss_analytics l on l.attempt_id = a.id and l.student_id = p_student
   where a.student_id = p_student
     and a.paper_id in (
       select r.paper_id from public.extraction_run r
        where r.student_id = p_student and r.status::text = 'committed' and r.committed_at < v_from)
     and a.paper_id not in (
       select r.paper_id from public.extraction_run r
        where r.student_id = p_student and r.status::text = 'committed'
          and r.committed_at >= v_from and r.committed_at < v_to);

  if v_counted >= 10 and v_eq >= 10 then
    -- share of questions that lost marks, compared by cross-multiplying;
    -- a difference under a tenth of the questions reads as "about the same".
    v_trend := case
      when (v_el::numeric * v_counted - v_lost_q::numeric * v_eq) >= 0.10 * v_counted * v_eq then 'fewer'
      when (v_lost_q::numeric * v_eq - v_el::numeric * v_counted) >= 0.10 * v_counted * v_eq then 'more'
      else 'similar' end;
  end if;

  return jsonb_build_object(
    'first_name',       v_first,
    'period_start',     p_start,
    'period_end',       p_end,
    'papers_committed', v_papers,
    'subjects',         to_jsonb(v_subjects),
    'questions_counted', v_counted,
    'questions_lost',   v_lost_q,
    'marks_lost',       v_lost_m,
    'papers_counted',   coalesce(v_ready.papers_counted, 0),
    'has_enough_data',  coalesce(v_ready.has_enough_data, false),
    'areas',            v_areas,
    'by_subject',       v_subj,
    'earlier_questions', case when v_trend is null then null else v_eq end,
    'earlier_lost',     case when v_trend is null then null else v_el end,
    'trend',            v_trend
  );
end;
$$;

revoke all on function private.build_parent_digest(uuid, date, date) from public, anon, authenticated;

create or replace function private.digest_consent_current(p_guardian uuid, p_student uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case
             when not ce.granted then false
             when ce.notice_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then false
             else string_to_array(ce.notice_version, '.')::int[] >= array[1,4,0]
           end
      from public.consent_event ce
     where ce.guardian_id = p_guardian
       and ce.purpose = 'weekly_parent_digest'
       and (ce.student_id = p_student or ce.student_id is null)
     order by (ce.student_id is not null) desc, ce.seq desc
     limit 1
  ), false);
$$;

comment on function private.digest_consent_current(uuid, uuid) is
  'AXO-266: the latest weekly_parent_digest decision (student-specific first, then guardian-wide) is a grant recorded under notice 1.4.0 or later. Not callable by clients.';

-- ── 1.4.0, English and Hindi ────────────────────────────────────────────────
-- Generated from noticeContent('en' | 'hi', consent_purpose rows) in
-- src/notice.js at this commit. Append-only table; a re-run is a no-op.

insert into public.consent_notice_text (version, language, content)
values
  ('1.4.0', 'en', $notice_en$
{
  "title": "What you're agreeing to",
  "language_label": "Notice language",
  "sections": [
    {
      "heading": "What we need to do",
      "items": [
        {
          "purpose": "store_papers",
          "label": "Storing and reading uploaded papers",
          "note": "The pages you upload, kept in the account",
          "control": "required",
          "tag": "Required"
        },
        {
          "purpose": "extract_text",
          "label": "Extracting text from uploaded papers",
          "note": "Reading the questions, answers and remarks",
          "control": "required",
          "tag": "Required"
        },
        {
          "purpose": "generate_explanations",
          "label": "Explaining where marks were lost",
          "note": "Grounded in the marks the teacher gave",
          "control": "required",
          "tag": "Required"
        },
        {
          "purpose": "track_progress",
          "label": "Tracking progress over time",
          "note": "So a repeated cause shows up over time",
          "control": "required",
          "tag": "Required"
        }
      ]
    },
    {
      "heading": "Optional — off unless you turn it on",
      "items": [
        {
          "purpose": "weekly_parent_digest",
          "label": "Weekly summary to the parent",
          "note": "One email a week, to you: your child's first name, the subjects and number of papers they read that week, for each subject how many questions lost marks and how many marks that was, up to two command words (such as Explain) that cost the most marks, and, once there is enough earlier work, how this week compares with their earlier papers, shown as counts. No scores, percentages, rankings or predictions. Sent through Resend, an email service that stores it in the United States for 30 days.",
          "control": "switch_off_by_default"
        },
        {
          "purpose": "improve_extraction",
          "label": "Improving extraction accuracy from corrections",
          "note": "Uses anonymised corrections",
          "control": "switch_off_by_default"
        }
      ]
    },
    {
      "heading": "What we never do",
      "items": [
        {
          "label": "Advertising of any kind",
          "tag": "Never"
        },
        {
          "label": "Behavioural tracking",
          "tag": "Never"
        },
        {
          "label": "Selling data to anyone",
          "tag": "Never"
        },
        {
          "label": "Ranking against other students",
          "tag": "Never"
        }
      ]
    }
  ],
  "withdraw_note": "You can withdraw any optional consent later in Settings — one tap, no email required.",
  "action": "Give consent"
}
$notice_en$::jsonb),
  ('1.4.0', 'hi', $notice_hi$
{
  "title": "आप किस बात के लिए सहमति दे रहे हैं",
  "language_label": "सूचना की भाषा",
  "sections": [
    {
      "heading": "हमें जो करना ज़रूरी है",
      "items": [
        {
          "purpose": "store_papers",
          "label": "अपलोड किए गए पेपर सहेजना और पढ़ना",
          "note": "",
          "control": "required",
          "tag": "ज़रूरी"
        },
        {
          "purpose": "extract_text",
          "label": "अपलोड किए गए पेपर से लिखा हुआ निकालना",
          "note": "",
          "control": "required",
          "tag": "ज़रूरी"
        },
        {
          "purpose": "generate_explanations",
          "label": "कहाँ अंक कटे, यह समझाना",
          "note": "",
          "control": "required",
          "tag": "ज़रूरी"
        },
        {
          "purpose": "track_progress",
          "label": "समय के साथ प्रगति देखना",
          "note": "",
          "control": "required",
          "tag": "ज़रूरी"
        }
      ]
    },
    {
      "heading": "वैकल्पिक — जब तक आप चालू न करें, बंद रहेगा",
      "items": [
        {
          "purpose": "weekly_parent_digest",
          "label": "अभिभावक को साप्ताहिक सारांश",
          "note": "",
          "control": "switch_off_by_default"
        },
        {
          "purpose": "improve_extraction",
          "label": "सुधारों से एक्सट्रैक्शन बेहतर करना",
          "note": "",
          "control": "switch_off_by_default"
        }
      ]
    },
    {
      "heading": "हम कभी क्या नहीं करते",
      "items": [
        {
          "label": "किसी भी तरह का विज्ञापन",
          "tag": "कभी नहीं"
        },
        {
          "label": "व्यवहार पर नज़र रखना",
          "tag": "कभी नहीं"
        },
        {
          "label": "किसी को डेटा बेचना",
          "tag": "कभी नहीं"
        },
        {
          "label": "दूसरे विद्यार्थियों से तुलना या रैंकिंग",
          "tag": "कभी नहीं"
        }
      ]
    }
  ],
  "withdraw_note": "किसी भी वैकल्पिक सहमति को आप बाद में सेटिंग्स में वापस ले सकते हैं — एक टैप, कोई ईमेल नहीं।",
  "action": "सहमति दें"
}
$notice_hi$::jsonb)
on conflict (version, language) do nothing;
