// The pipeline, end to end, from the client's side of it.
//
// Ten stages live in three places: 0 to 2 on the device, 3 to 8 on the server, 9
// in the student's hands and 10 back on the server. This is the thing that walks
// them in order, keeps the student told which one is running, and makes sure the
// order actually holds — in particular that no question is explained before its
// mark has survived reconciliation.
//
// Progress is reported per page and by name. "Reading page 3 of 6" tells someone
// waiting on a 4G connection that something is happening and roughly how much is
// left; a spinner tells them nothing, and a generic bar tells them something
// false. There is no bar and no spinner anywhere in here.

import { createPaper, uploadScannedPage } from '../papers.js';
import { processPage, makeProxy } from './device.js';
import { addPage, markUploaded, pendingPages, saveDraft } from './drafts.js';
import { contentPass, explainQuestion, finalize, pool, structurePass } from './functions.js';
import { CAPTURE } from './contract.js';

/**
 * Condition a captured frame, separate its layers, and put it in the draft.
 *
 * Runs the moment a page is accepted, not at upload, because this is where the
 * quality verdict comes from and the verdict is only useful while the paper is
 * still in front of the student.
 *
 * @param {{draft:Object, bitmap:ImageBitmap, quad:Array|null, replacing?:number}} args
 */
export async function acceptPage({ draft, bitmap, quad, replacing = null }) {
  if (draft.pages.length >= CAPTURE.MAX_PAGES && replacing === null) {
    throw new Error(`A paper can hold ${CAPTURE.MAX_PAGES} pages. Start a second one for the rest.`);
  }

  if (replacing !== null && !draft.pages.some((p) => p.page_number === replacing)) {
    throw new Error('That page is not in this booklet any more.');
  }

  const pageNumber = replacing ?? draft.pages.length + 1;
  const processed = await processPage(bitmap, { quad, pageNumber });
  const proxy = await makeProxy(processed.blob);

  const page = {
    blob: processed.blob,
    proxy,
    width: processed.width,
    height: processed.height,
    quality: processed.quality,
    meta: { ...processed.meta, coverage: processed.coverage },
    teacher_marks: processed.teacher_marks,
    margin_band: processed.margin_band,
    layer_fallback: processed.layer_fallback,
  };

  if (replacing !== null) {
    draft.pages = draft.pages.map((p) => (p.page_number === replacing
      ? { ...p, ...page, page_number: replacing, uploaded: false } : p));
    await saveDraft(draft);
  } else {
    await addPage(draft, page);
  }

  return { draft, page: draft.pages.find((p) => p.page_number === pageNumber) };
}

/**
 * Send a draft up and run the server stages over it.
 *
 * Resumable at page granularity: a draft that was half uploaded when the
 * connection dropped picks up at the first page that has not landed, and nothing
 * is captured or uploaded twice.
 *
 * @param {(event: {stage:string, message:string, page?:number, of?:number}) => void} onProgress
 */
export async function ingest({ studentId, draft, paperType, dateTaken, onProgress }) {
  const say = (stage, message, extra = {}) => onProgress?.({ stage, message, ...extra });

  if (!draft.pages.length) throw new Error('There are no pages to send yet.');

  // ── the paper row ────────────────────────────────────────────────────────

  let paperId = draft.paper_id;
  if (!paperId) {
    const paper = await createPaper({
      studentId,
      type: paperType ?? draft.paper_type,
      dateTaken: dateTaken ?? new Date().toISOString().slice(0, 10),
    });
    paperId = paper.id;
    draft.paper_id = paperId;
    draft.paper_type = paper.type;
    await saveDraft(draft);
  }

  // ── stages 0-2 are already done; upload what has not landed ──────────────

  const pending = pendingPages(draft);
  const total = draft.pages.length;
  for (const page of pending) {
    say('upload', `Sending page ${page.page_number} of ${total}`, { page: page.page_number, of: total });
    await uploadScannedPage({ studentId, paperId, page });
    await markUploaded(draft, page.page_number);
  }

  const pages = draft.pages.map((p) => ({
    page_number: p.page_number,
    storage_path: `${studentId}/${paperId}/${p.page_number}.jpg`,
    proxy_path: p.proxy ? `${studentId}/${paperId}/${p.page_number}.proxy.jpg` : null,
    width: p.width,
    height: p.height,
    quality: p.quality,
    conditioning_meta: p.meta,
    layer_fallback: p.layer_fallback,
    teacher_marks: p.teacher_marks,
    margin_band: p.margin_band,
  }));

  // ── stage 3, and the run ─────────────────────────────────────────────────

  say('structure', `Finding the questions across ${total} page${total === 1 ? '' : 's'}`);
  const structure = await structurePass({ paper_id: paperId, pages });

  if (structure.refused) {
    // Not a graded exam paper, or nothing gradeable on it. The paper is kept and
    // the refusal is said plainly — dutifully extracting a textbook page into
    // the analytics would quietly degrade every insight downstream.
    return { paperId, runId: structure.run_id, refused: true, message: structure.message };
  }

  const regions = structure.regions ?? [];
  say('structure', `${regions.length} question${regions.length === 1 ? '' : 's'} found`, {
    page: total, of: total,
  });

  // ── stage 4, per question ────────────────────────────────────────────────

  let read = 0;
  const contentResults = await pool(regions, 3, async (region) => {
    const result = await contentPass(structure.run_id, region.id);
    read++;
    say('content', `Reading question ${read} of ${regions.length}`, { page: read, of: regions.length });
    return result;
  });

  // ── stages 6 and 7 ───────────────────────────────────────────────────────

  say('reconcile', 'Checking the marks add up');
  const finished = await finalize(structure.run_id);

  return {
    paperId,
    runId: structure.run_id,
    refused: false,
    regions,
    content: contentResults,
    reconciliation: finished.reconciliation,
    tier: finished.tier,
    tier_note: finished.tier_note,
    counts: finished.counts,
  };
}

/**
 * Stage 8, over a whole paper.
 *
 * Deliberately separate from ingest and deliberately not awaited by it: a
 * student should be reading question 1's explanation while question 9 is still
 * generating, and the paper is worth opening the moment the marks are in.
 * `onQuestion` fires per question as each lands.
 */
export async function explainPaper({ runId, regions, onQuestion }) {
  let done = 0;
  return pool(regions, 2, async (region) => {
    const result = await explainQuestion(runId, region.id);
    done++;
    onQuestion?.({ ...result, region, done, of: regions.length });
    return result;
  });
}
