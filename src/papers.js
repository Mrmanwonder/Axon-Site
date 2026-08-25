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
export async function uploadScannedPage({ studentId, paperId, page }) {
  requireOnline('Uploading');

const pageType = page.blob.type || 'image/jpeg';
  const pageExt = pageType === 'image/webp' ? 'webp' : pageType === 'image/png' ? 'png' : 'jpg';

const objects = [
  { kind: 'page', name: `p${page.page_number}.${pageExt}`, content_type: pageType, bytes: page.blob.size },
  ];
  if (page.mask) {
    objects.push({ kind: 'mask', name: `p${page.page_number}.mask.png`, content_type: 'image/png', bytes: page.mask.size });
  }

const intent = await uploadIntent({ student_id: studentId, paper_id: paperId, objects });
  const pageObj = intent?.objects?.find((o) => o.kind === 'page' && o.name === objects[0].name);
  const maskObj = page.mask ? intent?.objects?.find((o) => o.kind === 'mask' && o.name === objects[1].name) : null;
  if (!pageObj) throw new Error('The page could not be prepared for upload.');

await putObject(pageObj.url, page.blob, pageType);
  if (page.mask) {
    if (!maskObj) throw new Error('The page markings could not be prepared for upload.');
    await putObject(maskObj.url, page.mask, 'image/png');
  }

const uploads = [{ key: pageObj.key, bucket: pageObj.bucket, bytes: page.blob.size }];
  if (maskObj) uploads.push({ key: maskObj.key, bucket: maskObj.bucket, bytes: page.mask.size });
  await uploadComplete({ paper_id: paperId, uploads });

return {
  r2_bucket: pageObj.bucket,
  r2_key: pageObj.key,
  mask_key: maskObj?.key ?? null,
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
      paper_page(page_number,source_kind,status,storage_path,source_url,r2_bucket,r2_key,mask_key),
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
