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
import { PAPERS_BUCKET } from './config.js';
import { readThrough } from './cache.js';

/** Papers are Tier 2 candidates only if they are board material. */
export function tierForType(type) {
  return type === 'pyq' || type === 'sample_paper' ? 'tier_2' : 'tier_1';
}

export const PAPER_TYPES = [
  { value: 'unit_test', label: 'Unit test' },
  { value: 'mid_term', label: 'Mid-term' },
  { value: 'final_exam', label: 'Final exam' },
  { value: 'pyq', label: 'Previous year paper' },
  { value: 'sample_paper', label: 'Sample paper' },
];

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

/**
 * Upload page images or a PDF for a paper.
 *
 * Path is papers/<student_id>/<paper_id>/<n>.<ext>, which is the shape the
 * storage policy enforces: the first segment must be a student the signed-in
 * guardian owns.
 *
 * @param {Object} args
 * @param {File[]} args.files
 * @param {(done:number,total:number)=>void} [args.onProgress]
 */
export async function uploadPages({ studentId, paperId, files, onProgress }) {
  requireOnline('Uploading');
  const pages = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pageNumber = i + 1;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${studentId}/${paperId}/${pageNumber}.${ext}`;

    const { error: upErr } = await sb.storage
      .from(PAPERS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: true });
    if (upErr) throw upErr;

    const { data, error } = await sb
      .from('paper_page')
      .insert({
        paper_id: paperId,
        student_id: studentId,
        page_number: pageNumber,
        source_kind: 'upload',
        storage_path: path,
        status: 'stored',
      })
      .select()
      .single();
    if (error) throw error;

    pages.push(data);
    onProgress?.(pageNumber, files.length);
  }
  return pages;
}

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
 * Store one conditioned page from the scanner, and record it.
 *
 * The proxy goes up first and deliberately. It is a fraction of the size, so the
 * structure pass can start on it while the full page is still climbing a 4G
 * connection — and time-to-structure is the number the student actually
 * experiences. It is also the downscaled page stage 3 wants anyway.
 *
 * @param {{studentId:string, paperId:string, page:Object}} args
 */
export async function uploadScannedPage({ studentId, paperId, page }) {
  requireOnline('Uploading');
  const base = `${studentId}/${paperId}/${page.page_number}`;
  const proxyPath = page.proxy ? `${base}.proxy.jpg` : null;

  if (page.proxy) {
    const { error } = await sb.storage
      .from(PAPERS_BUCKET)
      .upload(proxyPath, page.proxy, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
  }

  const storagePath = `${base}.jpg`;
  const { error: upErr } = await sb.storage
    .from(PAPERS_BUCKET)
    .upload(storagePath, page.blob, { contentType: page.blob.type || 'image/jpeg', upsert: true });
  if (upErr) throw upErr;

  // The red mask goes up as its own object. It is lossless, small, and it is
  // where the fine detail lives: measured, a faint one-pixel stroke keeps 12% of
  // itself through the page encoder and all of it here. The model gets both.
  const maskPath = page.mask ? `${base}.mask.png` : null;
  if (page.mask) {
    const { error } = await sb.storage
      .from(PAPERS_BUCKET)
      .upload(maskPath, page.mask, { contentType: 'image/png', upsert: true });
    if (error) throw error;
  }

  // Upserted on (paper_id, page_number) so a retake replaces its page rather
  // than adding a second one beside it.
  const { data, error } = await sb
    .from('paper_page')
    .upsert({
      paper_id: paperId,
      student_id: studentId,
      page_number: page.page_number,
      source_kind: 'upload',
      storage_path: storagePath,
      status: 'stored',
    }, { onConflict: 'paper_id,page_number' })
    .select()
    .single();
  if (error) throw error;

  return { row: data, storage_path: storagePath, proxy_path: proxyPath, mask_path: maskPath };
}

/** Signed URL for a stored page. The bucket is private; there is no public URL. */
export async function pageUrl(storagePath, expiresInSeconds = 300) {
  const { data, error } = await sb.storage
    .from(PAPERS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
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
        `id,type,tier,date_taken,
         paper_page(page_number,source_kind,status,storage_path,source_url),
         page_unreadable(page_number,reason,storage_path),
         student_attempt(id,question_label,marks_awarded,max_marks,marks_source,
                         teacher_remark,extraction_confidence,student_confirmed_at,
                         mark_loss_event(id,cause,marks_lost,ai_explanation,do_this_next,
                                         confidence,student_confirmed_at,student_rejected_at))`,
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
