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
  const { data, error } = await sb
    .from('consent_current')
    .select('purpose,granted,student_id')
    .eq('guardian_id', guardianId);
  if (error) throw error;

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
 */
export async function recordConsent({ guardianId, studentId = null, decisions, method = 'in_app_itemised' }) {
  const rows = Object.entries(decisions).map(([purpose, granted]) => ({
    guardian_id: guardianId,
    student_id: studentId,
    purpose,
    granted,
    notice_version: CONSENT_NOTICE_VERSION,
    method,
  }));
  if (!rows.length) return [];
  const { data, error } = await sb.from('consent_event').insert(rows).select();
  if (error) throw error;
  return data;
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
    .select('seq,purpose,granted,notice_version,method,student_id,created_at')
    .eq('guardian_id', guardianId)
    .order('seq', { ascending: false });
  if (error) throw error;
  return data;
}
