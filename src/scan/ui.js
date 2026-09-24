// Scan and review, wired together.
//
// React owns the surfaces. This module owns the capture/session transaction:
// which page a shutter belongs to, when a page is durably accepted, and when a
// retake has actually completed. A retake target is intentionally sticky until
// the replacement is stored; merely firing the shutter is not success.

import { createCapture } from './capture.js';
import {
  acceptPage, currentRunForPaper, ingest, regionsForRun, startExplanations, watchExplanations,
} from './pipeline.js';
import {
  createDraft, deleteDraft, listDrafts, movePage, readDraft, removePage, saveDraft,
} from './drafts.js';
import { commitRun, confirmQuestion, confirmQuestions, correctAnswer, correctMark, loadReview, rejectCause } from './review.js';
import { releaseCrops } from './crops.js';
import { paperTypesFor } from '../papers.js';
import { publicScanMessage } from './errors.js';

const MAX_PENDING_CAPTURES = 2;

function providerKeyForStudent(student) {
  if (student?.provider_key) return student.provider_key;
  if (student?.board === 'CBSE') return 'cbse';
  if (student?.board === 'IBDP') return 'ib';
  return 'cambridge';
}

function paperTypes() {
  return paperTypesFor(providerKeyForStudent(S.ctx?.student));
}
let captureTail = Promise.resolve();

const S = {
  epoch: 0,
  ctx: null,
  capture: null,
  surface: null,
  visible: false,
  draft: null,
  thumbs: new Map(),
  placeholders: new Map(),
  run: null,
  regions: null,
  review: null,
  busy: false,
  pendingCaptures: 0,
  submitting: false,
  explanationsStarted: false,
  retaking: null,
  saving: false,        // true while save() is waiting on explanations before commit

};

let host = {
  toast() {}, tick() {}, firm() {},
  scanSurface: () => null,
  renderHint() {}, cameraLive() {}, submissionBusy() {}, scannerState() {},
  navigationIntent: () => null,

  renderTray() {}, renderDrafts() {}, draftToast() {}, renderProgress() {},
  openSheet() {}, openReview() {}, renderReview() {}, closeReview() {},
  goto() {}, refreshLibrary: async () => {},
};

const toast = (m, tone) => host.toast(m, tone);
const tick = () => host.tick();
const firm = () => host.firm();

export async function initScanUI(ctx, surfaces = {}) {
  setScanContext(ctx);
  host = { ...host, ...surfaces };
  if (!ctx.student) return;

  await restoreDraft();
  await paintDrafts();
}

export function resetScan() {
  ++S.epoch;
  clearTimeout(refreshTimer);
  refreshTimer = null;
  detachSurface();
  S.ctx = null; S.draft = null; S.run = null; S.runId = null; S.review = null; S.regions = null;
  S.busy = false; S.pendingCaptures = 0; S.submitting = false; S.saving = false; S.retaking = null; S.explanationsStarted = false;
  captureTail = Promise.resolve();
  S.thumbs.forEach(url => URL.revokeObjectURL(url)); S.thumbs.clear(); S.placeholders.clear();
  releaseCrops();
}
export function setScanContext(ctx) {
  if (S.ctx?.student?.id !== ctx?.student?.id) resetScan();
  S.ctx = ctx;
}

export function attachSurface(video, overlay) {
  if (S.surface === video && S.capture) return;
  detachSurface();
  if (!video || !S.ctx?.student) return;
  S.surface = video;
  S.capture = createCapture({
    video,
    overlay,
    onState: (state) => host.renderHint(state),
    onShot: (shot) => {
      tick();
      // Snapshot the target for this transaction, but do NOT clear it here.
      // It is cleared only after acceptPage has durably replaced that slot.
      const replacing = S.retaking;
      void takePage(shot, replacing);
    },
  });
}

export function detachSurface() {
  stopCamera();
  S.capture = null;
  S.surface = null;
}

export function shoot() {
  S.capture?.shoot();
}

export function setAutoCapture(on) {
  tick();
  S.capture?.setAutoCapture(on);
}

export function setScanVisible(visible, camera = null) {
  S.visible = visible;
  return visible ? startCamera(camera) : stopCamera();
}

// ── the camera ─────────────────────────────────────────────────────────────

/**
 * @param {Promise<MediaStream>|MediaStream|Error|null} [camera]
 *   The request app.js fired when the tab opened, if there was one. Adopting it
 *   is what keeps the permission sheet from waiting on this module's own load.
 */
let cameraGeneration = 0;
async function startCamera(camera = null) {
  const activation = ++cameraGeneration;
  if (!S.capture?.supported && !camera) {
    // No camera, or a browser that will not give one up. Upload is a
    // first-class path, so this is a different route rather than a failure.

    host.cameraLive(false, 'unavailable');
    host.renderHint({
      hint: 'No camera here — add pages from your files instead', blocking: null,
    });
    return;
  }
  host.cameraLive(false, 'starting');
  try {
    const capture = S.capture;
    await capture.start(camera);
    if (activation !== cameraGeneration || !S.visible || capture !== S.capture) return;
    host.cameraLive(true);
    host.renderHint(S.capture.state);
  } catch (error) {
    if (activation !== cameraGeneration || !S.visible) return;
    host.cameraLive(false, 'blocked');
    host.renderHint({
      hint: error?.name === 'NotAllowedError'
        ? 'Camera access is off for this site — you can still add pages from your files'
        : 'The camera could not start — you can still add pages from your files',
      blocking: 'camera',
    });
  }
}

function stopCamera() {
  ++cameraGeneration;
  S.capture?.stop();
  host.cameraLive(false);
}

// ── capture transaction ────────────────────────────────────────────────────

function updateCapturePressure() {
  const pending = S.pendingCaptures;
  // One page may condition while the camera stays alive. At two outstanding
  // captures we apply backpressure so a phone cannot accumulate multiple
  // full-resolution ImageBitmaps and run itself out of memory.
  S.capture?.setProcessing?.(pending >= MAX_PENDING_CAPTURES);
  host.scannerState({
    phase: pending ? 'processing' : 'live-guiding',
    pendingCaptureCount: pending,
  });
}

function reservePageSlot(replacing = null) {
  if (replacing !== null) return replacing;
  const used = new Set((S.draft?.pages ?? []).map((p) => p.page_number));
  for (const pageNumber of S.placeholders.keys()) used.add(pageNumber);
  let pageNumber = 1;
  while (used.has(pageNumber)) pageNumber++;
  return pageNumber;
}

function rekeyPlaceholder(from, to) {
  if (from === to || !S.placeholders.has(from)) return;
  const thumb = S.placeholders.get(from);
  S.placeholders.delete(from);
  S.placeholders.set(to, thumb);
}

async function takePage(shot, replacing = null) {
  if (S.submitting || S.pendingCaptures >= MAX_PENDING_CAPTURES) {
    shot.bitmap?.close?.();
    if (!S.submitting) toast('One page is still being prepared. Hold this page for a moment.');
    return false;
  }

  const epoch = S.epoch;
  const reservedSlot = reservePageSlot(replacing);
  S.pendingCaptures++;
  paintPlaceholder(shot.bitmap, reservedSlot);
  updateCapturePressure();

  // Conditioning remains serial because each task mutates the same durable
  // draft, but capture no longer waits for it. The next page can be framed and
  // photographed while this worker is warping/encoding the previous one.
  const task = captureTail
    .catch(() => {})
    .then(() => processCapturedPage(shot, replacing, reservedSlot, epoch));
  captureTail = task.catch(() => {});

  return task.finally(() => {
    shot.bitmap?.close?.();
    if (epoch !== S.epoch) return;
    S.pendingCaptures = Math.max(0, S.pendingCaptures - 1);
    updateCapturePressure();
  });
}

async function processCapturedPage(shot, replacing, reservedSlot, epoch) {
  if (epoch !== S.epoch) return false;
  S.busy = true;
  const tOnShot = performance.now();
  let slot = reservedSlot;

  try {
    if (!S.draft) {
      const draft = await createDraft({
        id: crypto.randomUUID(),
        studentId: S.ctx.student.id,
        paperType: null,
      });
      if (epoch !== S.epoch) return false;
      S.draft = draft;
    }

    // If an earlier queued capture was refused, the next successful new page
    // closes that numbering gap instead of leaving a phantom placeholder.
    const actualSlot = replacing ?? S.draft.pages.length + 1;
    rekeyPlaceholder(slot, actualSlot);
    slot = actualSlot;
    renderTrayRows();

    const { page } = await acceptPage({
      draft: S.draft,
      bitmap: shot.bitmap,
      quad: shot.quad,
      replacing,
      capturePath: shot.capturePath ?? null,
      liveGate: shot.gate ?? null,
      sourceKind: shot.sourceKind ?? 'camera',
      original: shot.original ?? null,
    });
    if (epoch !== S.epoch) return false;
    const tAccepted = performance.now();

    // Only a successful durable replacement completes the retake transaction.
    if (replacing !== null && S.retaking === replacing) S.retaking = null;

    if (replacing !== null && S.thumbs.has(replacing)) {
      URL.revokeObjectURL(S.thumbs.get(replacing));
      S.thumbs.delete(replacing);
    }

    await paintTray();
    refreshDrafts();

    console.debug('[scan:tray-timing]', {
      transactionId: shot.transactionId ?? null,
      acceptMs: +(tAccepted - tOnShot).toFixed(1),
      paintMs: +(performance.now() - tAccepted).toFixed(1),
      totalMs: +(performance.now() - tOnShot).toFixed(1),
    });

    if (page.quality?.verdict === 'fail' && !page.quality?.accepted) {
      offerRetake(page);
    } else if (page.quality?.verdict === 'warn') {
      toast(page.quality.reasons[0] ?? 'That page is a little soft.', 'warn');
    }
    if (page.layer_fallback === 'non_red_marking') {
      toast('This page looks marked in something other than red — we will read it more carefully.');
    }
    if (page.meta?.enhance?.applied) toast('Page sharpened for readability — check its marks during review.');
    return true;
  } catch (error) {
    if (epoch !== S.epoch) return false;
    S.placeholders.delete(slot);
    await paintTray();
    toast(error?.refused ? error.message : publicScanMessage(error), 'warn');
    return false;
  } finally {
    if (epoch === S.epoch) S.busy = false;
  }
}

function renderTrayRows() {
  const pages = S.draft?.pages ?? [];
  const rows = pages.map((p) => ({
    ...p,
    thumb: S.thumbs.get(p.page_number),
    retakeRequested: S.retaking === p.page_number,
  }));

  for (const [pageNumber, thumb] of S.placeholders) {
    const pending = {
      page_number: pageNumber,
      thumb,
      pending: true,
      retakeRequested: S.retaking === pageNumber,
    };
    const index = rows.findIndex((row) => row.page_number === pageNumber);
    if (index >= 0) rows[index] = { ...rows[index], ...pending };
    else rows.push(pending);
  }

  rows.sort((a, b) => a.page_number - b.page_number);
  host.renderTray(rows, { onPage: openPageActions, onDone: sendPaper });
}

async function paintTray() {
  const pages = S.draft?.pages ?? [];
  for (const page of pages) {
    if (!S.thumbs.has(page.page_number)) {
      S.thumbs.set(page.page_number, URL.createObjectURL(page.proxy ?? page.blob));
    }
    S.placeholders.delete(page.page_number);
  }
  renderTrayRows();
}

function paintPlaceholder(bitmap, pageNumber) {
  if (!bitmap || !bitmap.width || !bitmap.height) return;
  try {
    const w = 160, h = Math.round(160 * bitmap.height / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    S.placeholders.set(pageNumber, canvas.toDataURL('image/jpeg', 0.6));

    renderTrayRows();
  } catch {
    // Cosmetic only. paintTray() will replace it with the durable thumbnail.
  }
}

function setRetake(pageNumber) {
  S.retaking = pageNumber;
  void paintTray();
  toast(`Retaking page ${pageNumber}. Keep all four corners visible.`);
}

async function keepCapture(pageNumber) {
  const current = S.draft?.pages.find((p) => p.page_number === pageNumber);
  if (!current) return;
  current.quality = { ...current.quality, accepted: true };
  await saveDraft(S.draft);
  if (S.retaking === pageNumber) S.retaking = null;
  await paintTray();
  toast(`Page ${pageNumber} kept.`);
}

/** A fail needs an explicit decision before the booklet can be submitted. */
function offerRetake(page) {
  const reason = page.quality?.reasons?.[0] ?? 'This page is not clear enough to read reliably.';
  host.openSheet({
    title: `Page ${page.page_number} needs another look`,
    body: reason,
    items: [],
    choices: [
      { label: 'Retake page', value: 'retake', emphasis: 'primary' },
      { label: 'Keep this capture', value: 'keep', emphasis: 'secondary' },
    ],
    onChoice: async (choice) => {
      if (choice === 'retake') {
        setRetake(page.page_number);
        return;
      }
      if (choice === 'keep') await keepCapture(page.page_number);
    },
  });
}

function openPageActions(pageNumber) {
  const page = S.draft?.pages.find((p) => p.page_number === pageNumber);
  if (!page) return;
  const reasons = page.quality?.reasons ?? [];
  const unresolvedFail = page.quality?.verdict === 'fail' && !page.quality?.accepted;

  host.openSheet({
    title: `Page ${pageNumber}`,
    body: reasons.length ? reasons[0] : 'This page looks fine.',
    items: [],
    choices: [
      {
        label: 'Take this page again',
        value: 'retake',
        ...(unresolvedFail ? { emphasis: 'primary' } : {}),
      },
      ...(unresolvedFail
        ? [{ label: 'Keep this capture', value: 'keep', emphasis: 'secondary' }]
        : []),
      ...(pageNumber > 1 ? [{ label: 'Move earlier', value: 'up' }] : []),
      ...(pageNumber < S.draft.pages.length ? [{ label: 'Move later', value: 'down' }] : []),
      { label: 'Remove this page', value: 'remove' },
    ],
    onChoice: async (choice) => {
      if (S.submitting || S.busy) return;
      if (choice === 'retake') {
        setRetake(pageNumber);
        return;
      }
      if (choice === 'keep') {
        await keepCapture(pageNumber);
        return;
      }
      if (choice === 'up') S.draft = await movePage(S.draft, pageNumber, pageNumber - 1);
      if (choice === 'down') S.draft = await movePage(S.draft, pageNumber, pageNumber + 1);
      if (choice === 'remove') {
        if (S.retaking === pageNumber) S.retaking = null;
        S.draft = await removePage(S.draft, pageNumber);
        toast(`Page ${pageNumber} removed. The rest keep their order.`);
      }
      S.thumbs.forEach((url) => URL.revokeObjectURL(url));
      S.thumbs.clear();
      await paintTray();
      refreshDrafts();
    },
  });
}

// ── drafts ─────────────────────────────────────────────────────────────────

async function restoreDraft() {
  const epoch = S.epoch;
  const drafts = await listDrafts(S.ctx.student.id);
  if (epoch !== S.epoch) return;
  const latest = drafts[0];
  if (!latest) return;
  host.draftToast(
    { id: latest.id, pages: latest.pages.length },
    { onResume: resumeDraft },
  );
}

async function paintDrafts() {
  const epoch = S.epoch;
  if (!S.ctx?.student) return;
  const drafts = await listDrafts(S.ctx.student.id);
  if (epoch !== S.epoch) return;
  host.renderDrafts(
    drafts.map((d) => ({
      id: d.id,
      title: d.paper_type
        ? paperTypes().find((t) => t.value === d.paper_type)?.label ?? 'Paper'
        : 'Unfinished paper',
      pages: d.pages.length,
      thumb: null,
    })),
    { onResume: resumeDraft, onDiscard: discardDraft },
  );
}

function refreshDrafts() {
  void paintDrafts().catch(error => console.warn('[scan] draft list refresh failed', error));
}

async function discardDraft(id) {
  if (S.submitting || S.busy) return;
  const draft = await readDraft(id);
  if (!draft || draft.student_id !== S.ctx?.student?.id) return;
  await deleteDraft(id);
  if (S.draft?.id === id) { S.draft = null; S.thumbs.forEach(url => URL.revokeObjectURL(url)); S.thumbs.clear(); await paintTray(); }
  host.draftToast(null, { onResume: resumeDraft });
  await paintDrafts();

}

async function resumeDraft(id) {
  host.draftToast(null, { onResume: resumeDraft });
  const draft = await readDraft(id);
  if (!draft || draft.student_id !== S.ctx?.student?.id || S.submitting) return;
  S.draft = draft;
  S.retaking = null;

  S.thumbs.forEach((url) => URL.revokeObjectURL(url));
  S.thumbs.clear();
  await paintTray();
  toast(`Picking up where you left off — ${S.draft.pages.length} page(s) already taken.`);
}

// ── send paper ─────────────────────────────────────────────────────────────

export function setPendingPaperType(type) {
  S.pendingType = type ?? null;
}

function unresolvedPage() {
  return S.draft?.pages.find((p) => p.quality?.verdict === 'fail' && !p.quality?.accepted) ?? null;
}

function sendPaper() {
  if (S.busy || S.placeholders.size) return toast('Wait for this page to finish preparing.');
  if (!S.draft?.pages.length) return toast('Take a page first.');
  if (S.retaking !== null) {
    return toast(`Finish retaking page ${S.retaking} before reading the paper.`, 'warn');
  }
  const unresolved = unresolvedPage();
  if (unresolved) {
    offerRetake(unresolved);
    return;
  }

  const type = S.draft.paper_type ?? S.pendingType;
  if (type) {
    S.pendingType = null;
    return run(type);
  }

  host.openSheet({
    title: 'What kind of paper is this?',
    body: 'This decides whether we can match it to an official marking scheme.',
    items: [],
    choices: paperTypes().map((t) => ({ label: t.label, value: t.value })),
    onChoice: (value) => run(value),
  });
}

async function run(paperType) {
  if (S.submitting || S.busy) return;
  S.submitting = true;
  host.submissionBusy(true);
  const epoch = S.epoch;
  const intent = host.navigationIntent();
  let recoverCamera = true;
  stopCamera();
  const steps = [
    { key: 'upload', label: 'Sending the pages' },
    { key: 'structure', label: 'Finding the questions' },
    { key: 'content', label: 'Reading the answers and the marking' },
    { key: 'reconcile', label: 'Checking the marks add up' },
  ];
  let current = 'upload';

  const paint = (now, sub) => host.renderProgress({
    heading: 'Reading this paper',
    now,
    sub,
    steps: steps.map((s) => ({
      label: s.label,
      state: stepIndex(steps, s.key) < stepIndex(steps, current) ? 'done'
        : s.key === current ? 'now' : 'wait',
    })),
    skeleton: true,
    note: 'Nothing is dropped silently. Anything we could not read is shown to you next.',
  });

  paint('Getting ready');

  try {
    const result = await ingest({
      studentId: S.ctx.student.id,
      draft: S.draft,
      paperType,
      onProgress: ({ stage, message }) => { current = stage; paint(message); },
    });

    if (epoch !== S.epoch) return;
    if (result.processing) {
      recoverCamera = false;
      host.renderProgress({
        heading: 'Your paper is submitted',
        now: 'The server has not finished processing it yet.',
        steps: [],
        note: 'Your pages are saved. You can leave this screen and check the paper in Library; there is no need to upload it again.',
      });
      await host.refreshLibrary();
      return;
    }
    if (result.refused) {
      host.renderProgress({
        heading: 'This one we did not read',
        now: result.message,
        steps: [],
        note: 'The pages are kept. If this really is a marked paper, retaking the first page usually fixes it.',
      });
      return;
    }

    S.run = result;
    S.regions = result.regions;
    firm();
    // Explanations start only once review is done (save()), never here — the
    // student has confirmed nothing at this point, and starting them now is
    // guaranteed to 409 against reviewComplete's outstanding-review gate, every
    // time. See AXON_FIX_BRIEF.md §4.A1.
    recoverCamera = false;
    await host.refreshLibrary();
    if (epoch !== S.epoch) return;
    await openReview(result.runId, intent);

  } catch (error) {
    host.renderProgress({
      heading: 'That did not finish',
      now: error.message || 'Something went wrong reading this paper.',
      steps: [],
      note: 'Your pages are still here. Try again when you have a connection.',
    });
  } finally {
    if (epoch !== S.epoch) return;
    S.submitting = false;
    host.submissionBusy(false);
    if (recoverCamera && S.visible && host.navigationIntent() === intent) await startCamera();
  }
}

const stepIndex = (steps, key) => steps.findIndex((s) => s.key === key);

// ── review ─────────────────────────────────────────────────────────────────

async function openReview(runId, intent = null) {
  if (S.runId !== runId) S.explanationsStarted = false;
  const epoch = S.epoch;

  S.runId = runId;
  await refreshReview();
  if (epoch !== S.epoch || S.runId !== runId) return;
  host.openReview(S.review?.paper?.id, intent);
}

export async function resumeDraftReview(draftId) {
  const epoch = S.epoch;
  const studentId = S.ctx?.student?.id;
  if (!studentId) return { state: 'gone' };
  let draft = await readDraft(draftId);
  if (epoch !== S.epoch || (draft && draft.student_id !== studentId)) return { state: 'gone' };
  const paperId = draft?.paper_id ?? draftId;
  draft ??= (await listDrafts(studentId)).find(item => item.paper_id === paperId) ?? null;
  if (epoch !== S.epoch) return { state: 'gone' };
  const run = await currentRunForPaper(paperId);
  if (epoch !== S.epoch || !run) return { state: 'gone' };

  if (run.status === 'committed') return { state: 'committed', paperId };

  if (run.status === 'failed' || run.status === 'rejected') {
    return { state: 'stopped', reason: run.status_reason ?? null };
  }
  if (!['needs_review', 'explaining', 'ready'].includes(run.status)) return { state: 'processing' };

  const regions = await regionsForRun(run.id);
  if (epoch !== S.epoch) return { state: 'gone' };
  S.draft = draft;
  S.regions = regions;
  await openReview(run.id);
  // The SQL gate is idempotent too, but do not make a duplicate request when a
  // resumed run has already crossed into explanation generation.
  S.explanationsStarted = ['explaining', 'ready'].includes(run.status);
  return { state: 'reviewing' };
}

let refreshTimer = null;
function scheduleReviewRefresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshReview().catch(() => toast('Review could not refresh. Try again.', 'warn'));
  }, 400);
}

async function refreshReview() {
  if (!S.runId) return;
  const epoch = S.epoch;
  const runId = S.runId;
  const review = await loadReview(runId);
  if (epoch !== S.epoch || runId !== S.runId) return;
  S.review = review;
  paintReview();
}

function paintReview() {
  if (!S.review) return;
  const paper = S.review.paper;

  host.renderReview({
    title: paper?.subject
      ? `${paper.subject} · ${paperTypes().find((t) => t.value === paper.type)?.label ?? ''}`.trim()
      : paperTypes().find((t) => t.value === paper?.type)?.label ?? 'Review',
    lead: S.review.lead,
    delta: S.review.delta,
    outstanding: S.review.outstanding,
    cleanCount: S.review.cleanUnconfirmed.length,
    saving: S.saving,
    saveLabel: S.review.outstanding
      ? `${S.review.outstanding} left to check`
      : S.saving
        ? 'Working out where marks were lost…'
        : 'Save to Library',
    questions: S.review.questions.map((q) => ({
      id: q.id,
      label: q.label,
      tier: q.tier,
      confirmed: q.confirmed,
      marksAwarded: q.marksAwarded,
      marksAvailable: q.marksAvailable,
      answer: q.answer,
      remark: q.remark,
      crop: q.crop,
      pageNumber: q.pageNumber,
      unreadableReason: q.unreadableReason,
      alternatives: q.alternatives,
      allocationUnusable: q.allocationUnusable,
      explanation: q.explanation,
    })),
  }, {
    onMark: async (id, value) => {
      try { await correctMark(id, value); await refreshReview(); }
      catch (e) { toast(e.message, 'warn'); }
    },
    onAction: (id, action) => handleReviewAction(id, action),
    onConfirmClean: async () => {
      try {
        await confirmQuestions(S.review.cleanUnconfirmed);
        await refreshReview();
      } catch (e) { toast(e.message, 'warn'); }
    },
    onSave: save,
  });
}

function handleReviewAction(id, action) {
  const question = S.review?.questions.find((q) => q.id === id);
  if (!question) return;

  if (action === 'confirm') {
    confirmQuestion(id).then(refreshReview).catch((e) => toast(e.message, 'warn'));
    return;
  }
  if (action === 'cause') {
    rejectCause(id).then(() => {
      toast('Taken out. It will not count towards your patterns.');
      return refreshReview();
    }).catch((e) => toast(e.message, 'warn'));
    return;
  }
  if (action === 'type') {
    host.openSheet({
      title: 'Fix this',
      body: 'Type what your answer actually says. We take your word for it — you have the paper.',
      items: [],
      input: { label: "Your answer", id: 'fixText', placeholder: question.answer ?? 'What you wrote' },
      primary: 'Use this',
      onConfirm: async (value) => {
        try { await correctAnswer(id, value ?? ''); await refreshReview(); }
        catch (e) { toast(e.message, 'warn'); }
      },
    });
    return;
  }
  if (action === 'rescan') {
    if (!S.draft) { toast('The original pages are not on this device. Open this review on the device used to scan them.', 'warn'); return; }
    host.openSheet({
      title: `Take page ${question.pageNumber ?? ''} again?`,
      body: 'You retake one page, and we read the paper again with it.',
      items: [
        ['Only this page is photographed again.', 'The others are already sent and are not re-uploaded.'],
        ['The paper is then read from scratch.', 'Anything you have already fixed or confirmed is read again, so you will check it once more.'],
      ],
      primary: 'Take it again',
      onConfirm: () => {
        host.closeReview();
        releaseCrops();
        S.retaking = question.pageNumber;
        host.goto('scan');
        toast(`Retaking page ${question.pageNumber}. Keep all four corners visible.`);
      },
    });
  }
}

async function save() {
  if (!S.runId || S.saving) return;
  if (S.review?.outstanding) {
    toast(`${S.review.outstanding} question(s) still need a look. They are at the top.`);
    return;
  }

  S.saving = true;
  const epoch = S.epoch;
  const runId = S.runId;
  const current = () => epoch === S.epoch && runId === S.runId;
  paintReview();
  try {
    await refreshReview();
    if (!current()) return;
    try {
      if (!S.explanationsStarted) {
        await startExplanations(runId);
        if (!current()) return;
        S.explanationsStarted = true;
      }

      await watchExplanations({
        runId,
        regions: S.regions ?? [],
        onQuestion: () => { if (current()) scheduleReviewRefresh(); },
      });
    } catch (error) {
      if (!current()) return;
      // Explanations are a layer on top of the marks, not a precondition for
      // saving them. Log it, tell the student plainly, and still commit —
      // the marks are real and confirmed either way.

      console.error('explanations', error);
      toast('We could not work out why marks were lost this time. Your marks are still saved.', 'warn');
    }

    if (!current()) return;
    const result = await commitRun(runId);
    if (!current()) return;
    firm();
    toast(`Saved. ${result.attempts_committed} question${result.attempts_committed === 1 ? '' : 's'} in your Library.`);
    host.closeReview(S.review?.paper?.id);
    // The paper is read, reviewed and saved: the progress panel is describing
    // work that finished. Left standing it kept "Reading this paper" under the
    // viewfinder for the rest of the session, so the next paper started against
    // the last one's steps and Scan never returned to its idle state. This is
    // the terminal path, and clearing it here is what makes the screen idle
    // again. The refused and failed paths deliberately do NOT clear it — those
    // panels are the only place the student is told what went wrong.

    host.renderProgress(null);
    releaseCrops();
    S.runId = null;
    S.regions = null;
    S.explanationsStarted = false;
    S.retaking = null;

    if (S.draft) {
      await deleteDraft(S.draft.id);
      if (epoch !== S.epoch) return;
      S.draft = null;
      S.thumbs.forEach((url) => URL.revokeObjectURL(url));
      S.thumbs.clear();
      await paintTray();
      if (epoch !== S.epoch) return;
      await paintDrafts();
      if (epoch !== S.epoch) return;
      // The offer to resume outlived the thing it offered: the draft row is
      // gone above, but the toast is only ever raised at boot, so it stayed on
      // the viewfinder pointing at a deleted draft for the rest of the session.

      host.draftToast(null, { onResume: resumeDraft });
    }
    await host.refreshLibrary();
  } catch (error) {
    if (epoch === S.epoch) toast(error.message || 'That could not be saved.', 'warn');
  } finally {
    if (epoch === S.epoch) {
      S.saving = false;
      // Busy state belongs to this operation, not to the next network read.
      // Restore the action even when refreshing the retained review also fails.
      paintReview();
      if (S.runId) await refreshReview().catch(() => { toast("Review could not refresh. Try saving again.", "warn"); });
    }
  }
}

/** Uploaded photos enter the same transaction path as camera captures. */
export async function acceptUploads(files) {
  const result = { accepted: [], rejected: [] };
  for (const file of files) {
    if (!S.ctx?.student || S.submitting || !/^image\//.test(file.type)) {
      result.rejected.push({ name: file.name, reason: S.submitting ? 'A paper is being submitted.' : 'Only images can be added.' });
      continue;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const accepted = await takePage({ bitmap, quad: null, auto: false, sourceKind: 'upload', original: file, transactionId: `upload:${crypto.randomUUID()}` }, S.retaking);
      if (accepted) result.accepted.push({ name: file.name });
      else result.rejected.push({ name: file.name, reason: 'This page could not be prepared.' });

    } catch {
      result.rejected.push({ name: file.name, reason: 'This file could not be opened.' });
    }
  }
  return result;
}

export { openReview };
