// Paper ingestion and reads.
//
// Two ways in, both first-class. Pages can be captured in the app — stage 0 of
// SCANNING_SYSTEM.md — or uploaded from the gallery, files, or a shared link. A
// student who already photographed the paper last week should not have to
// photograph it again, so upload is permanent rather than a fallback.
//
// Uploads and links both require the network, and both fail loudly offline
// rather than queueing — queueing something the student cannot see is the
// invisible-failure mode hard rule 4 exists to prevent. Capture is the
// exception: it works offline and queues into a local draft, because the paper
// is in front of the student now and will not be later. It is extraction, not
// scanning, that needs a connection.

import { sb } from './supabase.js';
import { readThrough } from './cache.js';
import { pageAssetUrls, putObject, uploadComplete, uploadIntent } from './scan/functions.js';

/** Papers are Tier 2 candidates only if they are board material. */
export function tierForType(type) {
  return type === 'pyq' || type === 'sample_paper' ? 'tier_2' : 'tier_1';
}
// Cambridge names its own material: a "past paper" is a real Cambridge exam
// from a previous series, and a "specimen paper" is the board's own published
// example. The stored enum values are unchanged — pyq and sample_paper are what
// the schema calls them — because renaming an enum for a label is how a
// migration ends up being about vocabulary.
export const PAPER_TYPES = [
  { value: 'unit_test', label: 'Class test' },
  { value: 'mid_term', label: 'Mid-term' },
  { value: 'final_exam', label: 'End-of-year exam' },
  { value: 'pyq', label: 'Cambridge past paper' },
  { value: 'sample_paper', label: 'Specimen paper' },
  ];

export function paperTypeLabel(type) {
  return PAPER_TYPES.find((t) => t.value === type)?.label ?? type;
}

function requireOnline(action) {
  if (!navigator.onLine) {
    const err = new Error(
      `${action} needs a connection. Your saved papers stay readable offline, but new ones can't be added yet.`,
      );
    err.code = 'offline';
    throw err;
  }
}

/** Create the paper row. Tier follows the type, and the DB re-checks it. */
export async function createPaper({ studentId, type, dateTaken }) {
  requireOnline('Adding a paper');
  const { data, error } = await sb
  .from('paper')
  .insert({
    student_id: studentId,
    type,
    tier: tierForType(type),
    date_taken: dateTaken,
  })
  .select()
  .single();
  if (error) throw error;
  return data;
}

// `uploadPages()` used to live here: it put a file straight into Supabase
// Storage and inserted a `paper_page` row itself, with `source_kind: 'upload'`
// and no conditioning, no layer separation and no quality verdict. It had no
// callers left in the app, but it had written 43 of the 56 rows in production
// that have no `quality_verdict` at all — pages the pipeline then had to read
// with none of the signal every other page carries (AXON_FIX_BRIEF.md §7.1
// question 4). Removed rather than fixed: the upload path is `acceptUploads`
// in src/scan/ui.js, which gives a gallery photo exactly what a captured page
// gets, and a second way in that skips stage 1 is not a fallback, it is a hole.

/**
* Record a shared link as a page.
*
* A browser cannot fetch a cross-origin PDF and hand us the bytes, so this does
* not pretend to ingest it. The URL is stored with status 'pending' for a
* server-side fetcher, and the UI says so plainly.
*/
/**
* Validate a pasted link. Separate from addLinkPage and called first, because
* the paper row is created before the page is: validating late would leave an
* orphan paper behind every time someone fat-fingers a URL.
*
* @returns {string} the normalised URL
*/
export function parsePaperLink(url) {
  let parsed;
  try {
    parsed = new URL(String(url ?? '').trim());
  } catch {
    throw new Error('That does not look like a link. Paste the full address, including https://');
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Only http and https links can be added.');
  }
  return parsed.toString();
}

export async function addLinkPage({ studentId, paperId, url, pageNumber }) {
  requireOnline('Adding a link');
  const parsed = parsePaperLink(url);

const { data, error } = await sb
  .from('paper_page')
  .insert({
    paper_id: paperId,
    student_id: studentId,
    page_number: pageNumber,
    source_kind: 'link',
    source_url: parsed,
    status: 'pending',
  })
  .select()
  .single();
  if (error) throw error;
  return data;
}

/**
* Send one conditioned page from the scanner to R2, and say where it landed.
*
* Two objects, not one: the page image and the red-mark mask. The mask is
* lossless, small, and it is where the fine detail lives — measured, a faint
* one-pixel stroke keeps 12% of itself through the page encoder and all of it
* here, so the pipeline reads both. Nothing is written to `paper_page` here;
* that upsert happens server-side, inside `paper-submit`, once every page in
* the booklet has a key to give it.
*
* @param {{studentId:string, paperId:string, page:Object}} args
* @returns {{r2_bucket:string, r2_key:string, mask_key:string|null, bytes:number}}
*/
const EXT_FOR_TYPE = { 'image/webp': 'webp', 'image/png': 'png', 'image/heic': 'heic', 'image/jpeg': 'jpg' };

export async function uploadScannedPage({ studentId, paperId, page }) {
  requireOnline('Uploading');

const pageType = page.blob.type || 'image/jpeg';
  const ext = (type) => EXT_FOR_TYPE[type] ?? 'jpg';

// Four objects now, in two buckets. The page and its mask are derivatives and
// go to axon-derived; the original goes to axon-originals, which is what makes
// a bad warp or a bad encode recoverable rather than final (§7.6.4). The
// thumbnail is the cheapest large latency win in the system — triage asks "is
// this a marked exam paper", and it was being sent full pages to answer it.
const wanted = [
  { kind: 'page', name: `p${page.page_number}.${ext(pageType)}`, content_type: pageType, blob: page.blob },
  ];
  if (page.mask) {
    wanted.push({ kind: 'mask', name: `p${page.page_number}.mask.png`, content_type: 'image/png', blob: page.mask });
  }
  if (page.thumb) {
    wanted.push({ kind: 'thumb', name: `p${page.page_number}.thumb.jpg`, content_type: 'image/jpeg', blob: page.thumb });
  }
  if (page.original) {
    const originalType = page.original_type || page.original.type || 'image/jpeg';
    // An original in a type the upload endpoint will not mint a key for is not
    // silently dropped — it is skipped and said so in the return, so the gap is
    // visible in `original_key` being null rather than invisible.
    if (EXT_FOR_TYPE[originalType]) {
      wanted.push({ kind: 'raw', name: `p${page.page_number}.original.${ext(originalType)}`, content_type: originalType, blob: page.original });
    }
  }

const intent = await uploadIntent({
  student_id: studentId,
  paper_id: paperId,
  objects: wanted.map((o) => ({ kind: o.kind, name: o.name, content_type: o.content_type, bytes: o.blob.size })),
});

const minted = new Map();
  for (const want of wanted) {
    const got = intent?.objects?.find((o) => o.kind === want.kind && o.name === want.name);
    if (got) minted.set(want.kind, { ...got, blob: want.blob, content_type: want.content_type });
  }
  // The page itself is the one object there is no version of this that works
  // without. The rest each get their own check below, so a missing mask is a
  // named failure rather than a page that quietly arrives with no fine detail.
  if (!minted.has('page')) throw new Error('The page could not be prepared for upload.');
  if (page.mask && !minted.has('mask')) throw new Error('The page markings could not be prepared for upload.');

const uploads = [];
  for (const [, object] of minted) {
    await putObject(object.url, object.blob, object.content_type);
    uploads.push({ key: object.key, bucket: object.bucket, bytes: object.blob.size });
  }
  await uploadComplete({ paper_id: paperId, uploads });

const pageObj = minted.get('page');
  return {
    r2_bucket: pageObj.bucket,
    r2_key: pageObj.key,
    mask_key: minted.get('mask')?.key ?? null,
    thumb_key: minted.get('thumb')?.key ?? null,
    original_key: minted.get('raw')?.key ?? null,
    bytes: page.blob.size,
  };
}

/**
* Signed URLs for a stored page and its mask, one page at a time.
*
* @returns {{url:string|null, mask_url:string|null}}
*/
export async function pageAssetUrl(paperId, pageNumber) {
  const { urls } = await pageAssetUrls({ paper_id: paperId, page_numbers: [pageNumber] });
  return urls?.[pageNumber] ?? urls?.[String(pageNumber)] ?? { url: null, mask_url: null };
}

/**
 * The five states AXON_FIX_BRIEF.md §6.5 asks the Library to show, derived
 * from `extraction_run.status` via the `paper_progress` view. A paper with
 * committed attempts never needs this — it renders as a normal, finished row
 * — so this only covers the states between upload and commit, plus the two
 * ways a run can end without one.
 */
export const PAPER_STATUS = {
  scanning: { label: 'Scanning', tone: 'wait' },
  reading: { label: 'Reading', tone: 'wait' },
  needs_review: { label: 'Needs your eyes', tone: 'attention' },
  ready: { label: 'Ready to save', tone: 'attention' },
  failed: { label: "Couldn't read this one", tone: 'stopped' },
  rejected: { label: 'Not read', tone: 'stopped' },
};

const STATUS_FOR_RUN = {
  queued: 'scanning',
  triaging: 'scanning',
  structure: 'reading',
  cropping: 'reading',
  content: 'reading',
  attribution: 'reading',
  reconciliation: 'reading',
  adjudicating: 'reading',
  needs_review: 'needs_review',
  explaining: 'ready',
  ready: 'ready',
  failed: 'failed',
  rejected: 'rejected',
};

/** extraction_status (the raw enum) -> a PAPER_STATUS key. Null for
    'committed' — a committed paper has no in-flight status to show. */
export function statusKeyForRun(rawStatus) {
  return STATUS_FOR_RUN[rawStatus] ?? null;
}

/**
 * Every paper's live progress, one row per paper — the current (most recent)
 * run only. Not cached: a paper mid-pipeline is exactly the case where a
 * stale read is actively misleading, and this is cheap (one view, indexed
 * by student).
 */
export async function paperProgress(studentId) {
  const { data, error } = await sb
    .from('paper_progress')
    .select('paper_id,status,status_reason,started_at,pages_total,pages_done,questions_total,questions_done,questions_needing_you')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false });
  if (error) throw error;

  const byPaper = new Map();
  for (const row of data ?? []) {
    // Most recent only — a paper can have several runs (retries); order by
    // started_at desc above means the first one seen per paper_id is it.
    if (!byPaper.has(row.paper_id)) byPaper.set(row.paper_id, row);
  }
  return byPaper;
}

/** Library list — cached so it survives offline. */
export async function listPapers(studentId) {
  return readThrough(`papers:${studentId}`, async () => {
    const { data, error } = await sb
    .from('paper')
    .select('id,type,tier,date_taken,created_at,paper_page(count),student_attempt(count)')
    .eq('student_id', studentId)
    .order('date_taken', { ascending: false });
    if (error) throw error;
    return data;
  });
}

/** One paper with its attempts and losses — the analysis, cached for offline. */
export async function readPaper(studentId, paperId) {
  return readThrough(`paper:${studentId}:${paperId}`, async () => {
    const { data, error } = await sb
    .from('paper')
    .select(
      `id,type,tier,date_taken,subject,reported_total,stated_maximum,total_awarded,total_available,reconciled,
      paper_page(page_number,source_kind,status,storage_path,source_url,r2_bucket,r2_key,mask_key),
      page_unreadable(page_number,reason,storage_path),
      student_attempt(id,question_label,question_text,student_answer,marks_awarded,max_marks,marks_source,
      teacher_remark,extraction_confidence,student_confirmed_at,
      mark_loss_event(id,cause,marks_lost,ai_explanation,do_this_next,
      confidence,student_confirmed_at,student_rejected_at)),
      question_region(committed_attempt_id,page_spans,crop_key)`,
      )
    .eq('student_id', studentId)
    .eq('id', paperId)
    .single();
    if (error) throw error;
    return data;
  });
}

/**
* Marks-lost totals by cause, from the analytics view — never the base table,
* so unsure and rejected rows are already excluded (hard rule 3).
*/
export async function lossByCause(studentId) {
  return readThrough(`loss:${studentId}`, async () => {
    const { data, error } = await sb
    .from('mark_loss_analytics')
    .select('cause,marks_lost')
    .eq('student_id', studentId);
    if (error) throw error;
    const totals = {};
    for (const row of data) totals[row.cause] = (totals[row.cause] || 0) + Number(row.marks_lost);
    return totals;
  });
}

/**
* Attempts whose transcription came back unsure and hasn't been confirmed yet.
*
* Read from the base table on purpose, which is the one place that is correct:
* hard rule 3 keeps unsure rows out of *aggregation*, and this is the surface
* that exists to show them. Counting these from the analytics view would hide
* exactly the rows the student needs to look at.
*/
export async function needsCheck(studentId) {
  return readThrough(`needscheck:${studentId}`, async () => {
    const { data, error } = await sb
    .from('student_attempt')
    .select('id,paper_id,question_label')
    .eq('student_id', studentId)
    .eq('extraction_confidence', 'unsure')
    .is('student_confirmed_at', null);
    if (error) throw error;
    const papers = new Set(data.map((a) => a.paper_id));
    return { count: data.length, papers: papers.size };
  });
}

/** Pages OCR could not read — hard rule 4's surface. */
export async function unreadablePages(studentId) {
  return readThrough(`unreadable:${studentId}`, async () => {
    const { data, error } = await sb
    .from('page_unreadable')
    .select('id,paper_id,page_number,reason')
    .eq('student_id', studentId)
    .order('page_number');
    if (error) throw error;
    return data;
  });
}

/** The student's subjects, with their Cambridge syllabus codes. */
export async function listSubjects(studentId) {
  return readThrough(`subjects:${studentId}`, async () => {
    const { data, error } = await sb
    .from('student_subject')
    .select('subject,syllabus_code')
    .eq('student_id', studentId)
    .order('subject');
    if (error) throw error;
    return data;
  });
}

/** Sample size, and whether there is enough to show an insight at all. */
export async function analyticsReadiness(studentId) {
  return readThrough(`readiness:${studentId}`, async () => {
    const { data, error } = await sb
    .from('student_analytics_readiness')
    .select('papers_counted,questions_counted,has_enough_data')
    .eq('student_id', studentId)
    .maybeSingle();
    if (error) throw error;
    return data ?? { papers_counted: 0, questions_counted: 0, has_enough_data: false };
  });
}

/**
 * Live library.
 *
 * `listPapers` and `paperProgress` are point-in-time reads, and the app used to
 * run them exactly once — on mount, and never again. That is fine for an
 * archive and wrong for everything else this screen shows. Two consequences,
 * both of which read as the app being broken rather than as the app being
 * stale:
 *
 * · A paper scanned in this session did not appear in the Library until a full
 *   reload, because a commit inserts rows the client never asked about again.
 * · A paper uploaded on the phone never appeared on the laptop at all. There is
 *   no second backend to sync with — both devices are already reading the same
 *   Postgres rows through the same account. The laptop simply had no way to
 *   find out a row had arrived.
 *
 * So this subscribes to the four tables the library reads and lets the server
 * say when. Every subscription is filtered on `student_id` server-side, so a
 * device is only ever woken by its own student's rows, and RLS still decides
 * what is actually delivered — the filter narrows, it does not authorise.
 *
 * `onChange` is called with no argument and no payload on purpose. The payload
 * is one changed row; what the caller needs is a re-read, and a caller that
 * patched its state from the payload would be maintaining a second, subtly
 * different copy of the query in `listPapers`. Callers should coalesce: a
 * commit lands a whole paper's attempts at once and would otherwise fan out
 * into one refetch per question.
 *
 * Returns an unsubscribe function. Realtime being unreachable is not fatal and
 * is not surfaced — the app still works exactly as well as it did before this
 * existed, which is to say the reads still happen, just not unprompted.
 */
export function watchLibrary(studentId, onChange) {
  if (!studentId) return () => {};

  const channel = sb.channel(`library:${studentId}`);
  for (const table of ['paper', 'paper_page', 'student_attempt', 'extraction_run']) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `student_id=eq.${studentId}` },
      () => onChange(),
    );
  }
  channel.subscribe();

  return () => { void sb.removeChannel(channel); };
}
