// The consent notice, in English and Hindi.
//
// Why this file exists at all: the DPDP Act 2023 requires the notice to be
// available in English or any language in the Eighth Schedule, at the data
// principal's option. A parent who cannot read the notice has not been
// informed, and consent that isn't informed isn't consent. Hindi is the first
// of those languages we cover; the shape here takes more without rework.
//
// Two things this module deliberately does not do:
//
//   · It does not translate at runtime. Every string is written out, because a
//     machine-translated consent notice is a legal document nobody has read.
//   · It does not carry its own version number. `CONSENT_NOTICE_VERSION` in
//     config.js covers both languages at once — they say the same thing, so a
//     change to one is a change to the notice, and both must move together.
//     If you edit any string here, bump that constant and add a migration
//     that stores the new text in public.consent_notice_text.
//
// Purpose labels are keyed by `consent_purpose.purpose`, the table's primary
// key, rather than added as a `label_hi` column. The keys are seeded in
// 20260810173906_identity_and_consent.sql and are stable; a translation that
// lives here can be corrected without a migration. The trade is that a purpose
// added in SQL and not added here falls back to its English label — which is
// handled explicitly below rather than left to produce `undefined`.

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

const STRINGS = {
  en: {
    title: 'What you\'re agreeing to',
    requiredSection: 'What we need to do',
    optionalSection: 'Optional — off unless you turn it on',
    neverSection: 'What we never do',
    requiredNote: 'Required — the app can\'t work without this',
    optionalNote: 'Optional',
    requiredTag: 'Required',
    never: 'Never',
    neverItems: [
      'Advertising of any kind',
      'Behavioural tracking',
      'Selling data to anyone',
      'Ranking against other students',
    ],
    withdrawNote:
      'You can withdraw any optional consent later in Settings — one tap, no email required.',
    action: 'Give consent',
    langLabel: 'Notice language',
  },
  hi: {
    title: 'आप किस बात के लिए सहमति दे रहे हैं',
    requiredSection: 'हमें जो करना ज़रूरी है',
    optionalSection: 'वैकल्पिक — जब तक आप चालू न करें, बंद रहेगा',
    neverSection: 'हम कभी क्या नहीं करते',
    requiredNote: 'ज़रूरी — इसके बिना ऐप काम नहीं कर सकता',
    optionalNote: 'वैकल्पिक',
    requiredTag: 'ज़रूरी',
    never: 'कभी नहीं',
    neverItems: [
      'किसी भी तरह का विज्ञापन',
      'व्यवहार पर नज़र रखना',
      'किसी को डेटा बेचना',
      'दूसरे विद्यार्थियों से तुलना या रैंकिंग',
    ],
    withdrawNote:
      'किसी भी वैकल्पिक सहमति को आप बाद में सेटिंग्स में वापस ले सकते हैं — एक टैप, कोई ईमेल नहीं।',
    action: 'सहमति दें',
    langLabel: 'सूचना की भाषा',
  },
};

// Keyed by consent_purpose.purpose. English is not repeated here: it is already
// the authoritative `label` column, and duplicating it would let the two drift.
const PURPOSE_HI = {
  store_papers: 'अपलोड किए गए पेपर सहेजना और पढ़ना',
  extract_text: 'अपलोड किए गए पेपर से लिखा हुआ निकालना',
  generate_explanations: 'कहाँ अंक कटे, यह समझाना',
  track_progress: 'समय के साथ प्रगति देखना',
  weekly_parent_digest: 'अभिभावक को साप्ताहिक सारांश',
  improve_extraction: 'सुधारों से एक्सट्रैक्शन बेहतर करना',
};

// The one-line explanation under each purpose. English only: in Hindi the
// consent step leaves them out rather than show them untranslated. Kept here,
// not in the onboarding component, because they are part of the notice text
// stored per version in public.consent_notice_text.
const PURPOSE_NOTE_EN = {
  store_papers: 'The pages you upload, kept in the account',
  extract_text: 'Reading the questions, answers and remarks',
  generate_explanations: 'Grounded in the marks the teacher gave',
  track_progress: 'So a repeated cause shows up over time',
  weekly_parent_digest: 'A short email to you, once a week',
  improve_extraction: 'Uses anonymised corrections',
};

/** The note shown under a purpose, or '' when none is shown in this language. */
export function purposeNote(purpose, lang) {
  if (lang !== 'en') return '';
  return PURPOSE_NOTE_EN[purpose] ?? '';
}

/**
 * The notice exactly as the consent step renders it, as structured data.
 *
 * This is what public.consent_notice_text stores for each version and
 * language, so a recorded decision can be read against the words the guardian
 * saw. `purposes` are consent_purpose rows ({ purpose, label, is_required,
 * sort_order }); `label` is the English label from the database.
 * tests/ui/consent-notice-text.test.ts fails if this output drifts from the
 * row stored for CONSENT_NOTICE_VERSION, which is the signal to bump the
 * version and add a migration with the new text.
 */
export function noticeContent(lang, purposes) {
  const t = STRINGS[lang];
  if (!t) throw new Error(`Unknown consent notice language: ${lang}`);
  const ordered = [...purposes].sort((a, b) => a.sort_order - b.sort_order);
  const item = (p, tag) => ({
    purpose: p.purpose,
    label: purposeLabel(p.purpose, p.label, lang),
    note: purposeNote(p.purpose, lang),
    control: tag ? 'required' : 'switch_off_by_default',
    ...(tag ? { tag } : {}),
  });
  return {
    title: t.title,
    language_label: t.langLabel,
    sections: [
      { heading: t.requiredSection, items: ordered.filter((p) => p.is_required).map((p) => item(p, t.requiredTag)) },
      { heading: t.optionalSection, items: ordered.filter((p) => !p.is_required).map((p) => item(p, null)) },
      { heading: t.neverSection, items: t.neverItems.map((label) => ({ label, tag: t.never })) },
    ],
    withdraw_note: t.withdrawNote,
    action: t.action,
  };
}

/** Notice chrome for a language. Falls back to English for an unknown code. */
export function noticeStrings(lang) {
  return STRINGS[lang] ?? STRINGS.en;
}

/**
 * The label for one purpose in one language.
 *
 * A purpose seeded in SQL but not translated here returns its English label
 * rather than a blank or a key. A parent reading a half-translated notice can
 * still tell what they are agreeing to; one reading `undefined` cannot.
 */
export function purposeLabel(purpose, englishLabel, lang) {
  if (lang === 'hi') return PURPOSE_HI[purpose] ?? englishLabel;
  return englishLabel;
}

/** True when every purpose the server knows about has a translation. */
export function noticeIsComplete(purposes, lang) {
  if (lang !== 'hi') return true;
  return purposes.every((p) => p.purpose in PURPOSE_HI);
}
