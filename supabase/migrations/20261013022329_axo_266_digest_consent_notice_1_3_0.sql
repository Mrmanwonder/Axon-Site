-- ============================================================================
-- AXO-266: consent notice 1.3.0 (the digest note lists everything the email holds)
-- ============================================================================
--
-- 1.2.0 (applied earlier today) described the digest as first name, subjects and
-- how many questions lost marks. The email also states the total marks lost and
-- up to two command words with their sample sizes, so the note was narrower than
-- the email. 1.3.0 says all of it. No guardian was ever shown 1.2.0 (the app that
-- records the version is not deployed yet), so raising the gate to 1.3.0 excludes
-- nobody who had consented under it.
--
-- Wording is a draft for counsel (AXO-266), not legal advice.
-- ============================================================================

create or replace function private.digest_consent_current(p_guardian uuid, p_student uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case
             when not ce.granted then false
             when ce.notice_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then false
             else string_to_array(ce.notice_version, '.')::int[] >= array[1,3,0]
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
  'AXO-266: the latest weekly_parent_digest decision (student-specific first, then guardian-wide) is a grant recorded under notice 1.3.0 or later. Not callable by clients.';

insert into public.consent_notice_text (version, language, content)
values
  ('1.3.0', 'en', $notice_en$
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
          "note": "One email a week, to you: your child's first name, the subjects of the papers they read that week, how many questions lost marks and how many marks that was, and up to two command words (such as Explain) that cost the most marks, with the number of questions behind each. No scores or predictions. Sent through Resend, an email service that stores it in the United States for 30 days.",
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
  ('1.3.0', 'hi', $notice_hi$
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
