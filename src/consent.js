// Consent.
//
// Two rules shape this file:
//   · Consent state is never cached optimistically. Every read goes to the
//     server. If the network is down we report "unknown" rather than assume a
//     grant — a stale yes is the one failure mode that must not happen.
//   · Withdrawal is a new row, never an update. The ledger is append-only, and
//     the database enforces it, so this module cannot corrupt the record even
//     with a bug.

import { sb } from './supabase.js';
import { CONSENT_NOTICE_VERSION } from './config.js';
import { LANGUAGES } from './notice.js';

const NOTICE_LANGUAGES = LANGUAGES.map((l) => l.code);

/* In-flight de-duplication (review #2). Concurrent readers of consent_current
   for the same guardian share ONE request; nothing is kept after it settles,
   so every later read still goes to the server ("never cached"). Writes clear
   any in-flight entry so a read started after a write is not served from a
   request that began before it. */
const inflight = new Map();
let consentRevision = 0;
export function readConsentCurrentRows(guardianId) {
  const hit = inflight.get(guardianId);
  if (hit) return hit;
  const revision = consentRevision;
  const req = (async () => {
    const { data, error } = await sb
      .from('consent_current')
      .select('purpose,granted,student_id,notice_version')
      .eq('guardian_id', guardianId);
    if (error) throw error;
    if (revision !== consentRevision) throw new Error("Consent changed while reading. Read the current decision again.");
    return data ?? [];
  })();
  inflight.set(guardianId, req);
  const clear = () => { if (inflight.get(guardianId) === req) inflight.delete(guardianId); };
  req.then(clear, clear);
  return req;
}
export function forgetInflightConsent() { ++consentRevision; inflight.clear(); }
globalThis.addEventListener?.("axon:local-data", forgetInflightConsent);

/** Catalogue of purposes, with the required/optional split. */
export async function listPurposes() {
  const { data, error } = await sb
    .from('consent_purpose')
    .select('purpose,label,is_required,sort_order')
    .order('sort_order');
  if (error) throw error;
  return data;
}

/**
 * Current state, read authoritatively.
 * @returns {Promise<Record<string, boolean>>} purpose -> granted
 */
export async function readConsentState(guardianId, studentId = null) {
  const data = await readConsentCurrentRows(guardianId);

  // Most specific scope wins, matching private.consent_is_granted() in SQL: a
  // student-scoped decision is not overridden by a guardian-scope one.
  const guardianScope = {};
  const studentScope = {};
  for (const row of data) {
    if (row.student_id === null) guardianScope[row.purpose] = row.granted;
    else if (row.student_id === studentId) studentScope[row.purpose] = row.granted;
  }
  return { ...guardianScope, ...studentScope };
}

/**
 * Record an itemised set of decisions. One row per purpose — never a single
 * blanket agreement, which would not be compliant.
 *
 * @param {Object} args
 * @param {string} args.guardianId
 * @param {string|null} args.studentId  null during onboarding, before the profile exists
 * @param {Record<string, boolean>} args.decisions
 * @param {'in_app_itemised'|'in_app_withdrawal'} args.method
 * @param {'en'|'hi'} [args.noticeLanguage]  the language the notice was shown
 *   in. English unless the guardian chose Hindi on the consent step.
 */
export async function recordConsent({
  guardianId, studentId = null, decisions, method = 'in_app_itemised', noticeLanguage = 'en',
}) {
  // The database constrains this to the same two values; refusing here keeps a
  // bad value from becoming a confusing write error after the parent taps.
  if (!NOTICE_LANGUAGES.includes(noticeLanguage)) {
    throw new Error(`Unknown consent notice language: ${noticeLanguage}`);
  }
  const rows = Object.entries(decisions).map(([purpose, granted]) => ({
    guardian_id: guardianId,
    student_id: studentId,
    purpose,
    granted,
    notice_version: CONSENT_NOTICE_VERSION,
    notice_language: noticeLanguage,
    method,
  }));
  if (!rows.length) return [];
  forgetInflightConsent();
  try {
    const { data, error } = await sb.from('consent_event').insert(rows).select();
    if (error) throw error;
    return data;
  } finally { forgetInflightConsent(); }
}

/** Withdrawal is a grant of `false`, recorded as its own event. */
export async function withdrawConsent({ guardianId, studentId = null, purpose }) {
  return recordConsent({
    guardianId,
    studentId,
    decisions: { [purpose]: false },
    method: 'in_app_withdrawal',
  });
}

/** True when every required purpose is currently granted. */
export async function hasAllRequiredConsents(guardianId, studentId = null) {
  const [purposes, state] = await Promise.all([
    listPurposes(),
    readConsentState(guardianId, studentId),
  ]);
  return purposes.filter((p) => p.is_required).every((p) => state[p.purpose] === true);
}

/**
 * The full ledger for this guardian, newest first — what "Download your data"
 * and any future audit view read.
 */
export async function consentHistory(guardianId) {
  const { data, error } = await sb
    .from('consent_event')
    .select('seq,purpose,granted,notice_version,notice_language,method,student_id,created_at')
    .eq('guardian_id', guardianId)
    .order('seq', { ascending: false });
  if (error) throw error;
  return data;
}
