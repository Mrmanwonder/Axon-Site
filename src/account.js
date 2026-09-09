// Account: data export and erasure.

import { sb, signOut } from './supabase.js';
import { PAPERS_BUCKET } from './config.js';
import { consentHistory } from './consent.js';
import { clearCache } from './cache.js';

/**
 * Read one table for the export, or fail the whole export.
 *
 * The old shape was `.then(r => r.data ?? [])`, which mapped a successful empty
 * result and a failed query to the same `[]`. A database problem therefore
 * produced a perfectly valid-looking JSON download with tables silently
 * missing — under a button that says "Everything we hold".
 *
 * A partial export is worse than a failed one, because the person who
 * downloads it has no way to tell. So a failure throws and the download does
 * not happen.
 */
async function section(name, query) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`Your ${name} could not be read, so the export was stopped rather than sent to you incomplete.`);
  }
  return data ?? [];
}

/**
 * Everything we hold, as one JSON file.
 *
 * Built from the client's own RLS-scoped reads, so by construction it can only
 * contain data this account is entitled to see — an export cannot become a leak.
 */
export async function exportMyData(guardian) {
  const [students, papers, pages, attempts, losses, unreadable, prefs, consents] = await Promise.all([
    section('profiles', sb.from('student').select('*')),
    section('papers', sb.from('paper').select('*')),
    section('pages', sb.from('paper_page').select('*')),
    section('attempts', sb.from('student_attempt').select('*')),
    section('marks lost', sb.from('mark_loss_event').select('*')),
    section('unreadable pages', sb.from('page_unreadable').select('*')),
    section('preferences', sb.from('app_preference').select('*')),
    consentHistory(guardian.id),
  ]);

  return {
    export_schema_version: '1.0.0',
    exported_at: new Date().toISOString(),
    note:
      'Your papers themselves are files, not rows. They are not included here — ' +
      'download them from Library, or ask us and we will send them.',
    // Named rather than silently absent. The extraction pipeline's own records
    // — runs, question regions and their provenance, teacher marks and the
    // explanations built from them — are not in this file yet. Saying so is
    // the difference between an admitted gap and a download that quietly means
    // less than its button promises. Tracked as the server-side export (the
    // re-audit's §19), which is where completeness can actually be enforced.
    not_included_yet: [
      'extraction_run',
      'question_region and its provenance boxes',
      'teacher_mark',
      'region_explanation',
    ],
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

  // Every one of these reads is checked, and the reason is specific and nasty.
  //
  // A failed `list()` used to be indistinguishable from an empty folder: `data`
  // came back null, `?? []` turned it into "nothing here", the loop did
  // nothing, and deletion continued to the RPC — which releases the auth row.
  // Once that happens the session can no longer authorise Storage deletes at
  // all, so a minor's exam pages stayed in a private bucket that no longer had
  // an owner, with the account reported as fully erased.
  //
  // There is no recovery path from that point, so the only safe behaviour is to
  // stop before the irreversible step and say why.
  const { data: students, error: studentsError } = await sb.from('student').select('id');
  if (studentsError) {
    throw new Error('We could not list the profiles to delete, so nothing was deleted. Try again in a moment.');
  }

  for (const s of students ?? []) {
    // list() is not recursive, so walk paper folders under the student prefix.
    const { data: paperFolders, error: foldersError } = await sb.storage.from(PAPERS_BUCKET).list(s.id);
    if (foldersError) {
      throw new Error('We could not reach your stored pages, so nothing was deleted. Deleting now would leave them behind with no way to remove them later.');
    }
    for (const folder of paperFolders ?? []) {
      const { data: files, error: filesError } = await sb.storage.from(PAPERS_BUCKET).list(`${s.id}/${folder.name}`);
      if (filesError) {
        throw new Error('We could not reach your stored pages, so nothing was deleted. Deleting now would leave them behind with no way to remove them later.');
      }
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
