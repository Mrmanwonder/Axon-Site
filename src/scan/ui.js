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
  createDraft, deleteDraft, listDrafts, movePage, readDraft, removePage, replacePage, saveDraft,
} from './drafts.js';
import { commitRun, confirmQuestion, confirmQuestions, correctAnswer, correctMark, loadReview, rejectCause, relabelRegion } from './review.js';
import { releaseCrops } from './crops.js';
import { paperTypesFor } from '../papers.js';
import { providerKeyForStudent } from '../curriculum.js';
import { publicScanMessage } from './errors.js';
import { closestDuplicatePage } from './similarity.js';

import { preloadUploadPolicy } from './upload-policy.js';
import { sendQueue } from './send-queue.js';
import { backupComplete } from './upload-plan.js';
import { cancelOriginalBackups, resumeOriginalBackups, resumeStudentBackups, finishDraftReview } from './original-backups.js';

const MAX_PENDING_CAPTURES = 2;
let sendController = null;
let removeOnlineListener = () => {};

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
  autoCapture: true,
  draft: null,
  reviewDraft: null,
  reviewRecovery: 0,
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

  renderTray() {}, renderDrafts() {}, draftToast() {}, renderProgress() {}, sendStarted() {},
  openSheet() {}, openReview() {}, renderReview() {}, closeReview() {},
  goto() {}, refreshLibrary: async () => {},
  reviewPages: null,
};

const toast = (m, tone) => host.toast(m, tone);
const tick = () => host.tick();
const firm = () => host.firm();

export function initScanUI(ctx, surfaces = {}) {
  setScanContext(ctx);
  host = { ...host, ...surfaces };
  if (!ctx.student) return;

  void preloadUploadPolicy();
  removeOnlineListener();
  const studentId = ctx.student.id, epoch = S.epoch;
  const backupNotice = progress => {
    if (epoch === S.epoch && S.ctx?.student?.id === studentId) toast(progress.message, progress.complete ? undefined : 'warn');
  };
  const resumeBackups = () => {
    if (epoch !== S.epoch || S.ctx?.student?.id !== studentId) return;
    void preloadUploadPolicy();
    void resumeStudentBackups(studentId, backupNotice).catch(() => {});
  };
  globalThis.addEventListener?.('online', resumeBackups);
  const policyTimer = setInterval(() => {
    if (epoch === S.epoch && S.ctx?.student?.id === studentId) void preloadUploadPolicy();
  }, 20000);
  removeOnlineListener = () => { clearInterval(policyTimer); globalThis.removeEventListener?.('online', resumeBackups); };
  resumeBackups();

  // Review re-entry is server state and must not wait for IndexedDB. On some
  // browsers a blocked/slow local draft store can leave listDrafts() pending
  // indefinitely; before this change that also kept ensureScan() pending, so a
  // paper already at needs_review never even attempted its server review reads.
  // Bind the host/context synchronously and hydrate scanner-only draft surfaces
  // in the background. Epoch checks inside both functions prevent stale student
  // data from painting after a profile switch.
  void restoreDraft().catch((error) => console.warn('[scan] draft restore failed', error));
  void paintDrafts().catch((error) => console.warn('[scan] draft list refresh failed', error));
}

export function resetScan() {
  sendController?.abort(); sendController = null;
  cancelOriginalBackups(); removeOnlineListener();
  ++S.epoch;
  ++S.reviewRecovery;
  S.reviewDraft = null;
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

export function attachSurface(video, overlay, { autoCapture = S.autoCapture } = {}) {
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
  S.autoCapture = !!autoCapture;
  S.capture.setAutoCapture(S.autoCapture);
  S.capture.setProcessing(S.pendingCaptures >= MAX_PENDING_CAPTURES);
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
  S.autoCapture = !!on;
  tick();
  S.capture?.setAutoCapture(S.autoCapture);
}

/** 'auto' | 'on' | 'off'. Honoured only where the camera reports a torch. */
export function setTorchMode(mode) {
  tick();
  return S.capture?.setTorchMode?.(mode);
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

    const accepted = await acceptPage({
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
    let page = accepted.page;

    // What the detector saw, kept beside the page (never uploaded) so Review can
    // say why a page was flagged and Adjust edges can start from the detected
    // page instead of an arbitrary rectangle.
    if (page && (shot.suggestedQuad || shot.detection)) {
      page.capture = {
        suggestedQuad: shot.suggestedQuad ?? null,
        detection: shot.detection ?? null,
      };
      await saveDraft(S.draft);
    }

    // A duplicate decision is deliberately made after conditioning (so the
    // signature is stable) but before the durable page is painted as accepted.
    // Nothing is silently discarded: the student chooses keep, replace, or can
    // cancel the decision and the just-captured page is removed again.
    if (replacing === null && page?.fingerprint) {
      const duplicate = closestDuplicatePage(S.draft.pages, page.fingerprint, {
        excludePageNumber: page.page_number,
      });
      if (duplicate) {
        const capturedPageNumber = page.page_number;
        const decision = await offerDuplicateCapture(page, duplicate);
        if (epoch !== S.epoch) return false;

        if (decision === 'replace') {
          const captured = S.draft.pages.find((p) => p.page_number === capturedPageNumber);
          if (captured) {
            await replacePage(S.draft, duplicate.pageNumber, captured);
            await removePage(S.draft, capturedPageNumber);
            S.placeholders.delete(capturedPageNumber);
            if (S.thumbs.has(duplicate.pageNumber)) {
              URL.revokeObjectURL(S.thumbs.get(duplicate.pageNumber));
              S.thumbs.delete(duplicate.pageNumber);
            }
            page = S.draft.pages.find((p) => p.page_number === duplicate.pageNumber) ?? page;
            slot = duplicate.pageNumber;
            toast(`Page ${duplicate.pageNumber} replaced with the new capture.`);
          }
        } else if (decision === 'cancel') {
          await removePage(S.draft, capturedPageNumber);
          S.placeholders.delete(capturedPageNumber);
          await paintTray();
          refreshDrafts();
          toast('That capture was not added.');
          return false;
        }
      }
    }

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

    // A flagged page does not interrupt the next shot with a sheet. The strip
    // names it and the stack wears an amber outline; Review is one tap away
    // and Done turns into Review until it is dealt with.
    if (!flagFor(page) && page.quality?.verdict === 'warn') {
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

/**
 * Why a page needs a look, in words for the student, or null when it does not.
 * "Needs a look" is two things only: the page edges were not confirmed (and not
 * accepted), or the quality gate failed (and not accepted). A quality *warning*
 * is a note, never a flag, so Review is not forced on nearly every paper.
 */
export function flagFor(p) {
  if (p.meta?.geometry_confirmed === false && !p.meta?.geometry_accepted) {
    const why = p.capture?.detection?.flagReason;
    return {
      kind: 'edges',
      reason: why === 'not-found' ? "The page edges weren't found, so the whole photo was kept"
        : why === 'uncertain' ? "The page edges weren't certain, so the whole photo was kept"
        : why === 'engine' ? "The page finder didn't run, so the whole photo was kept"
        : "The page edges weren't confirmed, so the whole photo was kept",
    };
  }
  if (p.quality?.verdict === 'fail' && !p.quality?.accepted) {
    return { kind: 'quality', reason: p.quality.reasons?.[0] ?? 'Words may not read clearly' };
  }
  return null;
}

function renderTrayRows() {
  const pages = S.draft?.pages ?? [];
  const rows = pages.map((p) => ({
    ...p,
    thumb: S.thumbs.get(p.page_number),
    retakeRequested: S.retaking === p.page_number,
    geometryIssue: p.meta?.geometry_confirmed === false && !p.meta?.geometry_accepted,
    flag: flagFor(p),
    canAdjust: !!p.original,
    note: p.quality?.verdict === 'warn' ? (p.quality.reasons?.[0] ?? null) : null,
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
  host.renderTray(rows, {
    onPage: openPageActions,
    onDone: sendPaper,
    onRetake: setRetake,
    onKeep: keepCapture,
    onKeepAll: keepAllFlagged,
    onAdjustSource: adjustSource,
    onAdjustApply: adjustApply,
    onRemove: removePageAt,
    onMove: movePageAt,
  });
}

async function repaintAfterEdit() {
  S.thumbs.forEach((url) => URL.revokeObjectURL(url));
  S.thumbs.clear();
  await paintTray();
  refreshDrafts();
}

async function removePageAt(pageNumber) {
  if (S.submitting || S.busy || !S.draft) return;
  if (S.retaking === pageNumber) S.retaking = null;
  S.draft = await removePage(S.draft, pageNumber);
  if (!S.draft?.pages.length && S.draft) { await deleteDraft(S.draft.id); S.draft = null; }
  await repaintAfterEdit();
}

async function movePageAt(pageNumber, to) {
  if (S.submitting || S.busy || !S.draft) return;
  if (to < 1 || to > S.draft.pages.length || to === pageNumber) return;
  S.draft = await movePage(S.draft, pageNumber, to);
  await repaintAfterEdit();
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
  if (current.quality?.verdict === 'fail') {
    current.quality = { ...current.quality, accepted: true };
  }
  if (current.meta?.geometry_confirmed === false) {
    current.meta = { ...current.meta, geometry_accepted: true };
  }
  await saveDraft(S.draft);
  if (S.retaking === pageNumber) S.retaking = null;
  await paintTray();
  toast(`Page ${pageNumber} kept.`);
}

function offerGeometryRetake(page) {
  host.openSheet({
    title: `We couldn't confirm page ${page.page_number}'s edges`,
    body: "We kept the full photo instead of guessing a crop. Check it, retake it, or keep the uncropped photo.",
    items: [],
    choices: [
      { label: 'Retake page', value: 'retake', emphasis: 'primary' },
      { label: 'Keep full photo', value: 'keep', emphasis: 'secondary' },
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

function offerDuplicateCapture(page, duplicate) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    host.openSheet({
      title: `This looks like page ${duplicate.pageNumber}`,
      body: 'The new capture is very similar to a page already in this paper. Keep both only if you meant to scan it twice.',
      items: [],
      choices: [
        { label: 'Keep both', value: 'keep', emphasis: 'secondary' },
        { label: `Replace page ${duplicate.pageNumber}`, value: 'replace', emphasis: 'primary' },
      ],
      onChoice: (choice) => finish(choice),
      onCancel: () => finish('cancel'),
    });
  });
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

/** "Read as it is": accept every flagged page exactly as captured. */
async function keepAllFlagged() {
  if (S.busy || S.submitting) return;
  for (const page of S.draft?.pages ?? []) {
    if (!flagFor(page)) continue;
    if (page.quality?.verdict === 'fail') page.quality = { ...page.quality, accepted: true };
    if (page.meta?.geometry_confirmed === false) page.meta = { ...page.meta, geometry_accepted: true };
  }
  S.retaking = null;
  await saveDraft(S.draft);
  await paintTray();
}

/** The photograph and detected page the edge editor starts from, or null. */
function adjustSource(pageNumber) {
  const page = S.draft?.pages.find((p) => p.page_number === pageNumber);
  if (!page?.original) return null;
  return { blob: page.original, quad: page.capture?.suggestedQuad ?? null };
}

/**
 * The student has placed the corners. Condition that photograph again with
 * exactly those corners; the page keeps its number and its place.
 */
async function adjustApply(pageNumber, quad) {
  const page = S.draft?.pages.find((p) => p.page_number === pageNumber);
  if (!page?.original) throw new Error('The original photo is no longer on this device. Retake the page instead.');
  if (S.submitting || S.busy || S.pendingCaptures >= MAX_PENDING_CAPTURES) {
    throw new Error('Wait for the current page to finish preparing.');
  }
  const bitmap = await createImageBitmap(page.original);
  const ok = await takePage({
    bitmap,
    quad,
    suggestedQuad: quad,
    detection: null,
    auto: false,
    sourceKind: 'camera',
    capturePath: 'edges-adjusted',
    original: page.original,
    gate: null,
    transactionId: `adjust:${crypto.randomUUID()}`,
  }, pageNumber);
  if (!ok) throw new Error('That page could not be prepared again.');
  if (S.retaking === pageNumber) S.retaking = null;
}

function openPageActions(pageNumber) {
  const page = S.draft?.pages.find((p) => p.page_number === pageNumber);
  if (!page) return;
  const reasons = page.quality?.reasons ?? [];
  const unresolvedFail = page.quality?.verdict === 'fail' && !page.quality?.accepted;
  const unresolvedGeometry = page.meta?.geometry_confirmed === false && !page.meta?.geometry_accepted;

  host.openSheet({
    title: `Page ${pageNumber}`,
    body: unresolvedGeometry
      ? "We couldn't confirm this page's edges, so the full uncropped photo was kept."
      : (reasons.length ? reasons[0] : 'This page looks fine.'),
    items: [],
    choices: [
      {
        label: 'Take this page again',
        value: 'retake',
        ...((unresolvedFail || unresolvedGeometry) ? { emphasis: 'primary' } : {}),
      },
      ...((unresolvedFail || unresolvedGeometry)
        ? [{ label: unresolvedGeometry ? 'Keep full photo' : 'Keep this capture', value: 'keep', emphasis: 'secondary' }]
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
  const latest = drafts.find(d => !d.submission && !d.send_requested && !d.submission_started);
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
  // A sent paper is not a draft. Its local copy lingers only to finish original
  // backups and to allow "Rescan this page" during review; both happen without
  // the student managing it. (Owner, 5 Oct 2026: two identical rows, and
  // tapping one "submitted" a paper that was already sent.)
  host.renderDrafts(
    drafts.filter((d) => !d.submission && !d.send_requested && !d.submission_started && d.id !== S.draft?.id).map((d) => ({
      id: d.id,
      title: d.paper_type
        ? paperTypes().find((t) => t.value === d.paper_type)?.label ?? 'Paper'
        : 'Unsent paper',
      pages: d.pages.length,
      updatedAt: d.updated_at ?? null,
      thumbs: d.pages.slice(0, 3).map((p) => p.proxy ?? p.blob ?? null).filter(Boolean),
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
  if (draft.submission && !draft.pages.every(backupComplete)) return toast('Original backups are still pending. Reconnect and resume this draft.', 'warn');
  await deleteDraft(id);
  if (S.draft?.id === id) { S.draft = null; S.thumbs.forEach(url => URL.revokeObjectURL(url)); S.thumbs.clear(); await paintTray(); }
  host.draftToast(null, { onResume: resumeDraft });
  await paintDrafts();

}

async function resumeDraft(id) {
  host.draftToast(null, { onResume: resumeDraft });
  const draft = await readDraft(id);
  if (!draft || draft.student_id !== S.ctx?.student?.id || S.submitting) return;
  if (draft.submission) {
    const epoch = S.epoch;
    void resumeOriginalBackups(draft, undefined, progress => {
      if (epoch === S.epoch) toast(progress.message, progress.complete ? undefined : 'warn');
    }).then(() => paintDrafts()).catch(() => {});
    toast('Your paper is submitted. Checking its original backups.');
    return;
  }
  S.draft = draft;
  S.retaking = null;

  S.thumbs.forEach((url) => URL.revokeObjectURL(url));
  S.thumbs.clear();
  await paintTray();
  refreshDrafts();
  // Open the pages, so the student sees exactly what this draft holds.
  host.reviewPages?.();
}

// ── send paper ─────────────────────────────────────────────────────────────

export function setPendingPaperType(type) {
  S.pendingType = type ?? null;
}

/** The first page that needs a look, judged by the same rule the tray shows,
    so Done and the Review it can turn into never disagree. */
function unresolvedPage() {
  return S.draft?.pages.find((p) => flagFor(p)) ?? null;
}

function sendPaper() {
  const sendStartedAt = performance.now();
  if (S.busy || S.placeholders.size) return toast('Wait for this page to finish preparing.');
  if (!S.draft?.pages.length) return toast('Take a page first.');
  if (S.retaking !== null) {
    return toast(`Finish retaking page ${S.retaking} before reading the paper.`, 'warn');
  }
  const unresolved = unresolvedPage();
  if (unresolved) {
    if (host.reviewPages) { host.reviewPages(); return; }
    if (flagFor(unresolved).kind === 'edges') {
      offerGeometryRetake(unresolved);
    } else {
      offerRetake(unresolved);
    }
    return;
  }

  const type = S.draft.paper_type ?? S.pendingType;
  if (type) {
    S.pendingType = null;
    return run(type, sendStartedAt);
  }

  host.openSheet({
    title: 'What kind of paper is this?',
    body: 'This decides whether we can match it to an official marking scheme.',
    items: [],
    choices: paperTypes().map((t) => ({ label: t.label, value: t.value })),
    onChoice: (value) => run(value, sendStartedAt),
  });
}

/**
 * Hand the paper to the send queue and free the scanner (owner, 6 Oct 2026).
 * The queue sends it in the background, through lost connections and closed
 * tabs, while the student carries on scanning. The scanner shows the reading
 * screen for this paper until the student chooses to continue scanning.
 */
async function run(paperType, sendStartedAt = performance.now()) {
  if (S.submitting || S.busy || !S.draft) return;
  S.submitting = true;
  host.submissionBusy(true);
  const epoch = S.epoch;
  const draft = S.draft;
  try {
    const queue = await sendQueue();
    if (epoch !== S.epoch) return;
    const title = paperTypes().find((t) => t.value === paperType)?.label ?? 'Paper';
    const started = queue.start({
      studentId: S.ctx.student.id, draft, paperType, title, sendStartedAt,
      onTelemetry: host.uploadTelemetry,
    });
    // The send intent is written before anything else happens, so a closed tab
    // still resumes. Only then is the scanner handed a fresh, empty paper.
    host.sendStarted(draft.id);
    S.draft = null;
    S.retaking = null;
    S.thumbs.forEach((url) => URL.revokeObjectURL(url));
    S.thumbs.clear();
    await paintTray();
    refreshDrafts();
    firm();
    void started.then(() => { if (epoch === S.epoch) void host.refreshLibrary(); });
  } catch (error) {
    if (epoch === S.epoch) toast(error?.message || 'This paper could not be handed over. Your pages are kept.', 'warn');
  } finally {
    if (epoch === S.epoch) {
      S.submitting = false;
      host.submissionBusy(false);
    }
  }
}


// ── review ─────────────────────────────────────────────────────────────────

async function openReview(runId, intent = null, recovery = null) {
  if (recovery === null) { ++S.reviewRecovery; S.reviewDraft = null; }
  if (S.runId !== runId) S.explanationsStarted = false;
  const epoch = S.epoch;

  S.runId = runId;
  await refreshReview();
  if (epoch !== S.epoch || S.runId !== runId) return;
  if (S.draft?.paper_id === S.review?.paper?.id) S.reviewDraft = S.draft;
  else if (S.review?.paper?.id) {
    const sent = (await sendQueue()).draftForPaper(S.review.paper.id);
    if (sent && epoch === S.epoch) S.reviewDraft = sent;
  }
  host.openReview(S.review?.paper?.id, intent);
}

const LEGACY_DRAFT_LOOKUP_MS = 1200;

function readDraftWithin(id, ms = LEGACY_DRAFT_LOOKUP_MS) {
  return Promise.race([
    Promise.resolve(readDraft(id)).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function resumeDraftReview(routeId) {
  const recovery = ++S.reviewRecovery;
  S.reviewDraft = null;
  const epoch = S.epoch;
  const studentId = S.ctx?.student?.id;
  if (!studentId) return { state: 'gone' };

  // Library and retry routes use the canonical paper id. Consult server truth
  // first, before touching IndexedDB at all. A blocked local draft database must
  // never hold a server-ready review behind a skeleton loader.
  let paperId = routeId;
  let draft = null;
  let run = await currentRunForPaper(paperId);
  if (epoch !== S.epoch || recovery !== S.reviewRecovery) return { state: 'gone' };

  // Legacy scanner URLs used a local draft id. Only if the route id is not a
  // server paper do we ask IndexedDB to translate it — and even that fallback
  // has a finite deadline so broken local storage cannot create an infinite
  // loading state.
  if (!run) {
    draft = await readDraftWithin(routeId);
    if (epoch !== S.epoch || recovery !== S.reviewRecovery || (draft && draft.student_id !== studentId)) return { state: 'gone' };
    if (!draft?.paper_id) return { state: 'gone' };
    paperId = draft.paper_id;
    run = await currentRunForPaper(paperId);
    if (epoch !== S.epoch || recovery !== S.reviewRecovery || !run) return { state: 'gone' };
  }

  S.reviewDraft = draft;
  // Recover an on-device draft opportunistically so "Rescan this page" becomes
  // available when possible, but do not make the actual review wait for it.
  if (!draft) {
    void listDrafts(studentId).then((drafts) => {
      if (epoch !== S.epoch || recovery !== S.reviewRecovery || S.ctx?.student?.id !== studentId) return;
      const local = drafts.find((item) => item.paper_id === paperId) ?? null;
      if (local) S.reviewDraft = local;
    }).catch((error) => console.warn('[scan] local draft lookup failed during review', error));
  }

  if (run.status === 'committed') return { state: 'committed', paperId };

  if (run.status === 'failed' || run.status === 'rejected') {
    return { state: 'stopped', reason: run.status_reason ?? null };
  }
  if (!['needs_review', 'explaining', 'ready'].includes(run.status)) return { state: 'processing' };

  const regions = await regionsForRun(run.id);
  if (epoch !== S.epoch || recovery !== S.reviewRecovery) return { state: 'gone' };
  S.regions = regions;
  await openReview(run.id, null, recovery);
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
    title: paperTypes().find((t) => t.value === paper?.type)?.label ?? 'Review paper',
    lead: S.review.lead,
    delta: S.review.delta,
    noTotal: S.review.noTotal,
    outstanding: S.review.outstanding,
    cleanCount: S.review.cleanUnconfirmed.length,
    readableCount: S.review.readableUnconfirmed?.length ?? 0,
    saving: S.saving,
    saveLabel: !S.review.outstanding
      ? 'Save to Library'
      : canConfirmAndSave()
        ? `Confirm all ${S.review.outstanding} and save`
        : `${S.review.outstanding} left to check`,
    questions: S.review.questions.map((q) => ({
      id: q.id,
      label: q.label,
      tier: q.tier,
      confirmed: q.confirmed,
      marksAwarded: q.marksAwarded,
      marksAvailable: q.marksAvailable,
      answer: q.answer,
      questionText: q.questionText,
      answerBlock: q.answerBlock,
      identityNote: q.identityNote,
      markStep: q.markStep,
      paperId: q.paperId,
      pageNumbers: q.pageNumbers,
      remark: q.remark,
      crop: q.crop,
      pageNumber: q.pageNumber,
      unreadableReason: q.unreadableReason,
      regionType: q.regionType ?? null,
      alternatives: q.alternatives,
      allocationUnusable: q.allocationUnusable,
      explanation: q.explanation,
    })),
  }, {
    // The mark picker saves on tap and has no error slot of its own, so a
    // failed save is said here; the question stays unconfirmed either way.
    onMark: async (id, value) => {
      try {
        if (!S.review?.questions.some(q => q.id === id)) throw new Error('This review has changed. Open the current question again.');
        await correctMark(id, value);
        await refreshReview();
      } catch (e) { toast(e.message, 'warn'); }
    },
    onAction: (id, action) => handleReviewAction(id, action),
    onRelabel: async (id, label) => {
      await relabelRegion(id, label);
      await refreshReview();
    },
    onConfirmClean: async () => {
      try {
        await confirmQuestions(S.review.cleanUnconfirmed);
        await refreshReview();
      } catch (e) { toast(e.message, 'warn'); }
    },
    onConfirmAll: async () => {
      try {
        await confirmQuestions(S.review.readableUnconfirmed ?? []);
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
        await correctAnswer(id, value ?? ''); await refreshReview();
      },
    });
    return;
  }
  if (action === 'rescan') {
    if (!Number.isInteger(question.pageNumber) || question.pageNumber < 1) { toast('This reading has no source page to retake.', 'warn'); return; }
    if (!S.reviewDraft || S.reviewDraft.paper_id !== S.review?.paper?.id) { toast('The original pages are not on this device. Open this review on the device used to scan them.', 'warn'); return; }
    host.openSheet({
      title: `Take page ${question.pageNumber ?? ''} again?`,
      body: 'You retake one page, and we read the paper again with it.',
      items: [
        ['Only this page is photographed again.', 'The others are already sent and are not re-uploaded.'],
        ['The paper is then read from scratch.', 'Anything you have already fixed or confirmed is read again, so you will check it once more.'],
      ],
      primary: 'Take it again',
      onConfirm: () => {
        if (!S.reviewDraft || S.reviewDraft.paper_id !== S.review?.paper?.id) return;
        cancelOriginalBackups();
        S.draft = S.reviewDraft;
        host.closeReview();
        releaseCrops();
        S.retaking = question.pageNumber;
        host.goto('scan');
        toast(`Retaking page ${question.pageNumber}. Keep all four corners visible.`);
      },
    });
  }
}

/** Every outstanding reading has something on screen to vouch for. */
function canConfirmAndSave() {
  const left = S.review?.questions.filter((q) => !q.confirmed) ?? [];
  return left.length > 0 && left.every((q) => q.tier !== 'unreadable');
}

/**
 * Save closes review at once (owner, 6 Oct 2026: instant feedback). What is
 * left — explanations, then committing the confirmed marks — runs in the
 * background and does not need this screen. If it cannot finish, the paper
 * stays in the Library ready to save again, and the student is told.
 */
async function save() {
  if (!S.runId || S.saving) return;
  if (S.review?.outstanding) {
    if (!canConfirmAndSave()) {
      const left = S.review.questions.filter((q) => !q.confirmed && q.tier === 'unreadable').length;
      toast(`${left} part${left === 1 ? '' : 's'} could not be read. Fix ${left === 1 ? 'it' : 'them'} or confirm ${left === 1 ? 'it' : 'them'} first. They are at the top.`);
      return;
    }
    S.saving = true;
    paintReview();
    try {
      await confirmQuestions(S.review.readableUnconfirmed ?? []);
    } catch (error) {
      S.saving = false;
      paintReview();
      toast(error?.message || 'That could not be confirmed. Try again with a connection.', 'warn');
      return;
    }
  }

  S.saving = true;
  const epoch = S.epoch;
  const runId = S.runId;
  const paperId = S.review?.paper?.id;
  const regions = S.regions ?? [];
  const started = S.explanationsStarted;
  const savedDraft = S.reviewDraft?.paper_id === paperId ? S.reviewDraft : null;

  firm();
  toast('Paper saved. Axon is working out where the marks went.');
  host.closeReview(paperId);
  host.renderProgress(null);
  releaseCrops();
  S.runId = null;
  S.regions = null;
  S.review = null;
  S.explanationsStarted = false;
  S.retaking = null;
  S.saving = false;
  ++S.reviewRecovery;
  S.reviewDraft = null;

  void finishSave({ runId, paperId, regions, started, savedDraft, epoch });
}

const COMMIT_RETRY_MS = [3000, 10000, 30000];

async function finishSave({ runId, regions, started, savedDraft, epoch }) {
  try {
    if (!started) await startExplanations(runId);
    await watchExplanations({ runId, regions });
  } catch (error) {
    // Explanations sit on top of the marks; they never hold the marks back.
    console.error('explanations', error);
  }
  // A different student now holds this session: their scope cannot commit the
  // last student's run. The paper stays ready to save from its own profile.
  if (epoch !== S.epoch) return;
  let committed = false;
  for (let attempt = 0; !committed; attempt++) {
    try {
      await commitRun(runId);
      committed = true;
    } catch (error) {
      if (attempt >= COMMIT_RETRY_MS.length) {
        if (epoch === S.epoch) toast('Your paper did not finish saving. Open it from the Library to save it again.', 'warn');
        console.error('commit', error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, COMMIT_RETRY_MS[attempt]));
    }
  }
  if (savedDraft) {
    try { await finishDraftReview(savedDraft); } catch { /* the backup job finishes it later */ }
    if (epoch === S.epoch) refreshDrafts();
  }
  if (epoch === S.epoch) await host.refreshLibrary();
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
