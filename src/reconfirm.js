// Re-confirming consent after the notice changes (AXO-266).
//
// Existing decisions stay valid; nothing here rewrites or revokes them. When the
// notice text changes, the guardian is shown the current notice once and asked to
// confirm it, which appends fresh rows at the current version. The comparison of
// stored versus current lives in this file only, so a version bump is a reviewed
// change in one place and consent.js stays a plain reader and writer.

import { sb } from './supabase.js';
import { CONSENT_NOTICE_VERSION } from './config.js';
import { readConsentCurrentRows, forgetInflightConsent } from './consent.js';

/** True when `version` is a x.y.z string older than the current notice. */
export function isOlderNotice(version, current = CONSENT_NOTICE_VERSION) {
  const parse = (v) => (/^\d+\.\d+\.\d+$/.test(String(v)) ? String(v).split('.').map(Number) : null);
  const a = parse(version);
  const b = parse(current);
  if (!a || !b) return true; // an unreadable version has not seen the current text
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * Which latest decisions were given under an older notice.
 * Only grants are re-confirmed; a withdrawal stays withdrawn and is never
 * turned back on by this screen.
 * @returns {Promise<{ needed: boolean, rows: {purpose:string, student_id:string|null, granted:boolean}[] }>}
 */
export async function readReconfirmation(guardianId) {
  const data = await readConsentCurrentRows(guardianId);
  const rows = data.filter((r) => r.granted && isOlderNotice(r.notice_version));
  return {
    needed: rows.length > 0,
    rows: rows.map(({ purpose, student_id, granted }) => ({ purpose, student_id, granted })),
  };
}

/**
 * Append the guardian's confirmed choices at the current version, each at the
 * scope (guardian-wide or one student) where it was originally given.
 * `choices` maps purpose -> granted for the optional purposes the guardian can
 * change on this screen; required purposes are always re-confirmed as granted.
 */
export async function confirmCurrentNotice({ guardianId, rows, choices, noticeLanguage = 'en' }) {
  const out = rows.map((r) => ({
    guardian_id: guardianId,
    student_id: r.student_id,
    purpose: r.purpose,
    granted: choices[r.purpose] ?? true,
    notice_version: CONSENT_NOTICE_VERSION,
    notice_language: noticeLanguage,
    method: 'in_app_itemised',
  }));
  if (!out.length) return [];
  forgetInflightConsent();
  const { data, error } = await sb.from('consent_event').insert(out).select();
  if (error) throw error;
  return data;
}
