-- ============================================================================
-- AXO-217 (council D2): store the exact text of each consent notice version
-- ============================================================================
--
-- Every consent_event records notice_version and notice_language, but until now
-- nothing recorded what a version actually said. The notice wording changed
-- several times while the version stayed '1.0.0' (10 Aug, 24 Aug, 22 Sep, and
-- PR #224 on 6 Oct), so a decision could not be read against the words the
-- guardian saw. From 1.1.0 on, each version's text is stored here, per
-- language, and the application constant (src/config.js) names a row here.
--
-- Shape: one row per (version, language). `content` is the notice as the
-- consent step renders it, as structured JSON built by noticeContent() in
-- src/notice.js: title, the required and optional purposes with their labels,
-- one-line notes and controls, the "never" list, the withdrawal note and the
-- action. `sha256` is the hex SHA-256 of content::text, set by a trigger, so a
-- hash quoted in a record or a dispute can be checked against the row.
-- tests/ui/consent-notice-text.test.ts fails when src/notice.js no longer
-- matches the row for the current version.
--
-- 1.0.0 is deliberately NOT seeded. 1.0.0 covered several different wordings
-- between 10 Aug and 6 Oct 2026 (commits 5772dee, 2d4982a, 30ad111, 848d01a,
-- 7114000, which changed "Never: behavioural tracking" to "behavioural
-- advertising" on 22 Sep, and f169961), and production holds 1.0.0 consents
-- from before and after those changes (36 before 24 Aug, 123 from 24 Aug to
-- 22 Sep, 87 after 22 Sep, at the time of writing). The
-- English purpose labels came from the database at render time. No single
-- text can be stated as "the 1.0.0 notice" without picking one wording and
-- presenting it as what every 1.0.0 guardian saw. All 1.0.0 consent rows in
-- production are language 'en' and predate PR #224's merge.
--
-- Rules:
--   · Append-only. UPDATE, DELETE and TRUNCATE raise. A wording change is a new
--     version, never an edit.
--   · Written only by migration. RLS is on with a single SELECT policy for
--     `authenticated`; anon and authenticated hold no write privilege, and
--     there is no RPC that writes here.
--   · Existing consents stay valid. Nothing compares notice_version with the
--     current version to decide whether to ask again; the bump to 1.1.0 forces
--     no re-consent.
--   · No SECURITY DEFINER function is added. The two trigger functions run as
--     the caller and pin search_path to ''.
-- ============================================================================

create table if not exists public.consent_notice_text (
  version     text        not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  language    text        not null check (language in ('en', 'hi')),
  content     jsonb       not null check (jsonb_typeof(content) = 'object'),
  sha256      text        not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  primary key (version, language)
);

comment on table public.consent_notice_text is
  'Exact text of each consent notice version, per language, as the consent step renders it (built by noticeContent in src/notice.js). Append-only; written only by migration. Read with consent_event.notice_version and notice_language.';
comment on column public.consent_notice_text.content is
  'The rendered notice as structured JSON: title, sections (required and optional purposes with label, note and control; the never list), withdraw_note, action.';
comment on column public.consent_notice_text.sha256 is
  'Hex SHA-256 of content::text, set by trigger on insert.';

create or replace function private.consent_notice_text_hash()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.sha256 := encode(pg_catalog.sha256(pg_catalog.convert_to(new.content::text, 'UTF8')), 'hex');
  return new;
end;
$$;

create or replace function private.consent_notice_text_is_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception
    'consent_notice_text is append-only: % is not permitted. A wording change is a new notice version.', tg_op
    using errcode = '42501';
end;
$$;

revoke all on function private.consent_notice_text_hash() from public, anon, authenticated;
revoke all on function private.consent_notice_text_is_append_only() from public, anon, authenticated;

drop trigger if exists consent_notice_text_hash on public.consent_notice_text;
create trigger consent_notice_text_hash
  before insert on public.consent_notice_text
  for each row execute function private.consent_notice_text_hash();

drop trigger if exists consent_notice_text_no_update on public.consent_notice_text;
create trigger consent_notice_text_no_update
  before update on public.consent_notice_text
  for each row execute function private.consent_notice_text_is_append_only();

drop trigger if exists consent_notice_text_no_delete on public.consent_notice_text;
create trigger consent_notice_text_no_delete
  before delete on public.consent_notice_text
  for each row execute function private.consent_notice_text_is_append_only();

drop trigger if exists consent_notice_text_no_truncate on public.consent_notice_text;
create trigger consent_notice_text_no_truncate
  before truncate on public.consent_notice_text
  for each statement execute function private.consent_notice_text_is_append_only();

alter table public.consent_notice_text enable row level security;

revoke all on public.consent_notice_text from anon, authenticated;
grant select on public.consent_notice_text to authenticated;

drop policy if exists consent_notice_text_read on public.consent_notice_text;
create policy consent_notice_text_read on public.consent_notice_text
  for select to authenticated using (true);

-- ── 1.1.0, English and Hindi ────────────────────────────────────────────────
-- Generated from noticeContent('en' | 'hi', consent_purpose rows) in
-- src/notice.js at this commit. `on conflict do nothing` keeps a re-run a
-- no-op; it never rewrites a stored version.

insert into public.consent_notice_text (version, language, content)
values
  ('1.1.0', 'en', $notice_en$
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
          "note": "A short email to you, once a week",
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
  ('1.1.0', 'hi', $notice_hi$
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
