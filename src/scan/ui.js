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
import { PAPER_TYPES } from '../papers.js';
import { publicScanMessage } from './errors.js';

const S = {
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
  saving: false,
  explanationsStarted: false,
  retaking: null,
};

let host = {
  toast() {}, tick() {}, firm() {},
  scanSurface: () => null,
  renderHint() {}, cameraLive() {}, scannerState() {},
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

export function setScanContext(ctx) {
  if (S.ctx?.student?.id !== ctx?.student?.id) detachSurface();
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

let cameraGeneration = 0;
async function startCamera(camera = null) {
  const activation = ++cameraGeneration;
  if (!S.capture?.supported && !camera) {
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

async function takePage(shot, replacing = null) {
  // capture.setProcessing() should make this unreachable for automatic shots,
  // but keep the guard for double taps / browser re-entry. Crucially, it does
  // not consume S.retaking.
  if (S.busy) {
    shot.bitmap?.close?.();
    return;
  }

  S.busy = true;
  S.capture?.setProcessing?.(true);
  host.scannerState({ phase: 'processing', pendingCaptureCount: 1 });
  const tOnShot = performance.now();
  const slot = replacing ?? (S.draft?.pages.length ?? 0) + 1;

  try {
    if (!S.draft) {
      S.draft = await createDraft({
        id: crypto.randomUUID(),
        studentId: S.ctx.student.id,
        paperType: null,
      });
    }

    paintPlaceholder(shot.bitmap, replacing ?? S.draft.pages.length + 1);

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
    if (page.meta?.enhance?.applied) {
      toast('Page sharpened for readability — check its marks during review.');
    }
  } catch (error) {
    // A failed retake remains a retake. The old page stays in the booklet and
    // the next successful shutter still targets the same slot.
    S.placeholders.delete(slot);
    await paintTray();
    if (error?.refused) toast(error.message, 'warn');
    else {
      console.error('[scan] page processing failed', {
        transactionId: shot.transactionId ?? null,
        code: error?.code,
        error,
      });
      toast(publicScanMessage(error), 'warn');
    }
  } finally {
    S.busy = false;
    S.capture?.setProcessing?.(false);
    host.scannerState({ phase: 'live-guiding', pendingCaptureCount: 0 });
    shot.bitmap?.close?.();
  }
}

async function paintTray() {
  const pages = S.draft?.pages ?? [];
  for (const page of pages) {
    if (S.thumbs.has(page.page_number)) continue;
    S.thumbs.set(page.page_number, URL.createObjectURL(page.proxy ?? page.blob));
    S.placeholders.delete(page.page_number);
  }
  host.renderTray(
    pages.map((p) => ({
      ...p,
      thumb: S.thumbs.get(p.page_number),
      retakeRequested: S.retaking === p.page_number,
    })),
    { onPage: openPageActions, onDone: sendPaper },
  );
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

    const pages = S.draft?.pages ?? [];
    const rows = pages.map((p) => ({
      ...p,
      thumb: S.thumbs.get(p.page_number),
      retakeRequested: S.retaking === p.page_number,
    }));
    const idx = rows.findIndex((r) => r.page_number === pageNumber);
    const placeholderRow = {
      page_number: pageNumber,
      thumb: S.placeholders.get(pageNumber),
      pending: true,
      retakeRequested: S.retaking === pageNumber,
    };
    if (idx >= 0) rows[idx] = { ...rows[idx], ...placeholderRow };
    else rows.push(placeholderRow);

    host.renderTray(rows, { onPage: openPageActions, onDone: sendPaper });
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
  const drafts = await listDrafts(S.ctx.student.id);
  const latest = drafts[0];
  if (!latest) return;
  host.draftToast(
    { id: latest.id, pages: latest.pages.length },
    { onResume: resumeDraft },
  );
}

async function paintDrafts() {
  const drafts = await listDrafts(S.ctx.student.id);
  host.renderDrafts(
    drafts.map((d) => ({
      id: d.id,
      title: d.paper_type
        ? PAPER_TYPES.find((t) => t.value === d.paper_type)?.label ?? 'Paper'
        : 'Unfinished paper',
      pages: d.pages.length,
      thumb: null,
    })),
    { onResume: resumeDraft },
  );
}

function refreshDrafts() {
  // The page transaction is already durable. A secondary list refresh must
  // neither delay the shutter nor turn a saved capture into a reported failure.
  void paintDrafts().catch((error) => console.warn('[scan] draft list refresh failed', error));
}

async function resumeDraft(id) {
  host.draftToast(null, { onResume: resumeDraft });
  S.draft = await readDraft(id);
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
    choices: PAPER_TYPES.map((t) => ({ label: t.label, value: t.value })),
    onChoice: (value) => run(value),
  });
}

async function run(paperType) {
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
    await openReview(result.runId);
  } catch (error) {
    host.renderProgress({
      heading: 'That did not finish',
      now: error.message || 'Something went wrong reading this paper.',
      steps: [],
      note: 'Your pages are still here. Try again when you have a connection.',
    });
  }
}

const stepIndex = (steps, key) => steps.findIndex((s) => s.key === key);

// ── review ─────────────────────────────────────────────────────────────────

async function openReview(runId) {
  if (S.runId !== runId) S.explanationsStarted = false;
  S.runId = runId;
  await refreshReview();
  host.openReview();
}

export async function resumeDraftReview(draftId) {
  const draft = await readDraft(draftId);
  if (!draft?.paper_id) return { state: 'gone' };

  const run = await currentRunForPaper(draft.paper_id);
  if (!run) return { state: 'gone' };
  if (run.status === 'committed') return { state: 'committed', paperId: draft.paper_id };
  if (run.status === 'failed' || run.status === 'rejected') {
    return { state: 'stopped', reason: run.status_reason ?? null };
  }
  if (!['needs_review', 'explaining', 'ready'].includes(run.status)) return { state: 'processing' };

  S.draft = draft;
  S.regions = await regionsForRun(run.id);
  await openReview(run.id);
  // The SQL gate is idempotent too, but do not make a duplicate request when a
  // resumed run has already crossed into explanation generation.
  S.explanationsStarted = ['explaining', 'ready'].includes(run.status);
  return { state: 'reviewing' };
}

let refreshTimer = null;
function scheduleReviewRefresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => { refreshTimer = null; refreshReview(); }, 400);
}

async function refreshReview() {
  if (!S.runId) return;
  S.review = await loadReview(S.runId);
  const paper = S.review.paper;

  host.renderReview({
    title: paper?.subject
      ? `${paper.subject} · ${PAPER_TYPES.find((t) => t.value === paper.type)?.label ?? ''}`.trim()
      : PAPER_TYPES.find((t) => t.value === paper?.type)?.label ?? 'Review',
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
      input: { id: 'fixText', placeholder: question.answer ?? 'What you wrote' },
      primary: 'Use this',
      onConfirm: async (value) => {
        try { await correctAnswer(id, value ?? ''); await refreshReview(); }
        catch (e) { toast(e.message, 'warn'); }
      },
    });
    return;
  }
  if (action === 'rescan') {
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
  await refreshReview();

  try {
    try {
      if (!S.explanationsStarted) {
        await startExplanations(S.runId);
        S.explanationsStarted = true;
      }
      await watchExplanations({
        runId: S.runId,
        regions: S.regions ?? [],
        onQuestion: () => scheduleReviewRefresh(),
      });
    } catch (error) {
      console.error('explanations', error);
      toast('We could not work out why marks were lost this time. Your marks are still saved.', 'warn');
    }

    const result = await commitRun(S.runId);
    firm();
    toast(`Saved. ${result.attempts_committed} question${result.attempts_committed === 1 ? '' : 's'} in your Library.`);
    host.closeReview();
    host.renderProgress(null);
    releaseCrops();
    S.runId = null;
    S.regions = null;
    S.explanationsStarted = false;
    S.retaking = null;

    if (S.draft) {
      await deleteDraft(S.draft.id);
      S.draft = null;
      S.thumbs.forEach((url) => URL.revokeObjectURL(url));
      S.thumbs.clear();
      await paintTray();
      await paintDrafts();
      host.draftToast(null, { onResume: resumeDraft });
    }
    await host.refreshLibrary();
  } catch (error) {
    toast(error.message || 'That could not be saved.', 'warn');
  } finally {
    S.saving = false;
    if (S.runId) await refreshReview();
  }
}

/** Uploaded photos enter the same transaction path as camera captures. */
export async function acceptUploads(files) {
  if (!S.ctx?.student) return;
  const images = files.filter((f) => /^image\//.test(f.type));
  const rest = files.filter((f) => !/^image\//.test(f.type));

  if (rest.length) {
    toast(`${rest.length} file(s) are not images. We can't read PDFs yet — photos of the pages work.`, 'warn');
  }
  if (!images.length) return;

  for (const file of images) {
    try {
      const bitmap = await createImageBitmap(file);
      const replacing = S.retaking;
      await takePage({
        bitmap,
        quad: null,
        auto: false,
        sourceKind: 'upload',
        original: file,
        transactionId: `upload:${crypto.randomUUID()}`,
      }, replacing);
    } catch {
      toast(`${file.name} could not be opened.`, 'warn');
    }
  }
}

export { openReview };
