-- ============================================================================
-- AXO-266: consent notice 1.2.0, and a digest that needs it
-- ============================================================================
--
-- The owner's call (13 Oct 2026): the wording of the weekly-digest consent
-- ("A short email to you, once a week") is not specific enough for an email that
-- names the child and the marks lost. 1.2.0 says what the email contains, that
-- it carries no scores or predictions, and where it is stored.
--
-- Gate: a guardian is eligible for the digest only if the latest decision for
-- the purpose is a grant recorded under notice 1.2.0 or later. Grants given
-- under 1.0.0 or 1.1.0 stay valid for everything else, and are not deleted or
-- rewritten; they simply do not start a digest until the guardian confirms the
-- clearer wording (turns the Settings switch off and on, or is asked again).
-- Checked when the digest is queued and again when it is claimed for sending.
--
-- Wording is a draft for counsel (AXO-266), not legal advice. Hindi shows the
-- label only, as before, because purpose notes are English only by design.
-- ============================================================================

create or replace function private.digest_consent_current(p_guardian uuid, p_student uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case
             when not ce.granted then false
             when ce.notice_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' then false
             else string_to_array(ce.notice_version, '.')::int[] >= array[1,2,0]
           end
      from public.consent_event ce
     where ce.guardian_id = p_guardian
       and ce.purpose = 'weekly_parent_digest'
       and (ce.student_id = p_student or ce.student_id is null)
     order by (ce.student_id is not null) desc, ce.seq desc
     limit 1
  ), false);
$$;

revoke all on function private.digest_consent_current(uuid, uuid) from public, anon, authenticated;
comment on function private.digest_consent_current(uuid, uuid) is
  'AXO-266: the latest weekly_parent_digest decision (student-specific first, then guardian-wide) is a grant recorded under notice 1.2.0 or later. Not callable by clients.';

create or replace function public.queue_parent_digests(
  p_period_end date default ((now() at time zone 'utc')::date)
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_start date := p_period_end - 6;
  v_from  timestamptz := (v_start::timestamp at time zone 'UTC');
  v_to    timestamptz := ((p_period_end + 1)::timestamp at time zone 'UTC');
  v_n     integer;
begin
  insert into private.parent_digest_delivery (guardian_id, student_id, period_start, period_end)
  select g.id, s.id, v_start, p_period_end
    from public.student s
    join public.guardian g on g.id = s.guardian_id
   where s.deleted_at is null
     and g.deleted_at is null
     and g.auth_user_id is not null
     and private.digest_consent_current(g.id, s.id)
     and exists (
       select 1 from public.extraction_run r
        where r.student_id = s.id and r.status::text = 'committed'
          and r.committed_at >= v_from and r.committed_at < v_to)
  on conflict (student_id, period_end) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.claim_parent_digests(p_limit integer default 25)
returns table (delivery_id uuid, to_email text, payload jsonb)
language plpgsql security definer set search_path = '' as $$
declare
  r         record;
  v_email   text;
  v_payload jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'limit must be 1 to 100' using errcode = '22023';
  end if;

  -- Out of attempts: say so in the table instead of retrying forever.
  update private.parent_digest_delivery d
     set status = 'failed', claimed_until = null,
         last_error = coalesce(d.last_error, 'attempts exhausted')
   where d.status = 'pending' and d.send_attempts >= 5
     and (d.claimed_until is null or d.claimed_until < now());

  for r in
    select d.id, d.guardian_id, d.student_id, d.period_start, d.period_end
      from private.parent_digest_delivery d
     where d.status = 'pending'
       and d.available_at <= now()
       and (d.claimed_until is null or d.claimed_until < now())
       and d.send_attempts < 5
     order by d.created_at
     limit p_limit
     for update skip locked
  loop
    select u.email into v_email
      from public.guardian g
      join auth.users u on u.id = g.auth_user_id
     where g.id = r.guardian_id and g.deleted_at is null;

    -- A withdrawal (or erasure) after queueing wins over the queue.
    if v_email is null or btrim(v_email) = '' then
      update private.parent_digest_delivery
         set status = 'skipped', skip_reason = 'no_recipient', claimed_until = null
       where id = r.id;
      continue;
    end if;
    if not private.digest_consent_current(r.guardian_id, r.student_id) then
      update private.parent_digest_delivery
         set status = 'skipped', skip_reason = 'consent_withdrawn', claimed_until = null
       where id = r.id;
      continue;
    end if;

    v_payload := private.build_parent_digest(r.student_id, r.period_start, r.period_end);
    if v_payload is null then
      update private.parent_digest_delivery
         set status = 'skipped', skip_reason = 'student_erased', claimed_until = null
       where id = r.id;
      continue;
    end if;

    update private.parent_digest_delivery
       set claimed_until = now() + interval '10 minutes',
           send_attempts = send_attempts + 1
     where id = r.id;

    delivery_id := r.id;
    to_email    := v_email;
    payload     := v_payload;
    return next;
  end loop;
end;
$$;

-- ── 1.2.0, English and Hindi ────────────────────────────────────────────────
-- Generated from noticeContent('en' | 'hi', consent_purpose rows) in
-- src/notice.js at this commit. Append-only table; a re-run is a no-op.

insert into public.consent_notice_text (version, language, content)
values
  ('1.2.0', 'en', $notice_en$
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
          "note": "One email a week, to you: your child's first name, the subjects of the papers they read that week, and how many questions lost marks. No scores or predictions. Sent through Resend, an email service that stores it in the United States for 30 days.",
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
  ('1.2.0', 'hi', $notice_hi$
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
