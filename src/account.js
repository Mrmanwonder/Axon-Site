// Account: data export and erasure.

import { sb, signOut } from './supabase.js';
import { PAPERS_BUCKET } from './config.js';
import { consentHistory } from './consent.js';
import { clearCache } from './cache.js';

/**
 * Everything we hold, as one JSON file.
 *
 * Built from the client's own RLS-scoped reads, so by construction it can only
 * contain data this account is entitled to see — an export cannot become a leak.
 */
export async function exportMyData(guardian) {
  const [students, papers, pages, attempts, losses, unreadable, prefs, consents] = await Promise.all([
    sb.from('student').select('*').then(r => r.data ?? []),
    sb.from('paper').select('*').then(r => r.data ?? []),
    sb.from('paper_page').select('*').then(r => r.data ?? []),
    sb.from('student_attempt').select('*').then(r => r.data ?? []),
    sb.from('mark_loss_event').select('*').then(r => r.data ?? []),
    sb.from('page_unreadable').select('*').then(r => r.data ?? []),
    sb.from('app_preference').select('*').then(r => r.data ?? []),
    consentHistory(guardian.id),
  ]);

  return {
    exported_at: new Date().toISOString(),
    note:
      'Your papers themselves are files, not rows. They are not included here — ' +
      'download them from Library, or ask us and we will send them.',
    guardian: {
      name: guardian.name,
      contact: guardian.contact,
      verified_at: guardian.verified_at,
      verification_method: guardian.verification_method,
      // The verification reference is intentionally omitted: it is proof held for
      // our compliance obligation, not personal data useful to the guardian.
    },
    students,
    papers,
    paper_pages: pages,
    attempts,
    mark_loss_events: losses,
    unreadable_pages: unreadable,
    preferences: prefs,
    consent_history: consents,
  };
}

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Erase the account.
 *
 * Storage first, then the database. That order matters: the RPC releases the
 * auth row, and once it has, the session can no longer authorise storage
 * deletes — the objects would be orphaned in a private bucket with no owner.
 *
 * The consent ledger is deliberately retained. It holds no personal content,
 * and it is the evidence that consent was properly obtained; destroying it
 * would destroy our ability to demonstrate compliance for the period the
 * account existed.
 */
export async function deleteAccount(guardian) {
  if (!navigator.onLine) {
    throw new Error('Deleting your account needs a connection, so we can remove your papers too.');
  }

  const { data: students } = await sb.from('student').select('id');

  for (const s of students ?? []) {
    // list() is not recursive, so walk paper folders under the student prefix.
    const { data: paperFolders } = await sb.storage.from(PAPERS_BUCKET).list(s.id);
    for (const folder of paperFolders ?? []) {
      const { data: files } = await sb.storage.from(PAPERS_BUCKET).list(`${s.id}/${folder.name}`);
      const paths = (files ?? []).map((f) => `${s.id}/${folder.name}/${f.name}`);
      if (paths.length) {
        const { error } = await sb.storage.from(PAPERS_BUCKET).remove(paths);
        if (error) throw error;
      }
    }
  }

  const { data, error } = await sb.rpc('delete_my_account');
  if (error) throw error;

  await clearCache();
  try {
    localStorage.clear();
  } catch { /* ignore */ }
  await signOut();
  return data;
}
