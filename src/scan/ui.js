// Scan and review, wired together.
//
// React owns the surfaces — the viewfinder, the tray, the review screen, the
// confidence chips and the cause hues. This owns the flow: when the camera
// runs, what happens to a page once it is taken, which stage is running, and
// what a correction does. The two meet at the `host` handed in by initScanUI,
// so neither reimplements the other.
//
// This module deliberately stayed plain JavaScript through the React port. It
// is the only module that knows the ten stages and their order, and rewriting
// it as components would have put the pipeline at risk for no gain — the DOM
// coupling was never in the flow, only in the render calls, which are now the
// host's job. What changed is that those calls went from `window.__axon*`
// globals to an injected object; nothing about the order did.

import { createCapture } from './capture.js';
import {
  acceptPage, currentRunForPaper, ingest, regionsForRun, startExplanations, watchExplanations,
} from './pipeline.js';
import { createDraft, deleteDraft, listDrafts, movePage, readDraft, removePage } from './drafts.js';
import { commitRun, confirmQuestion, confirmQuestions, correctAnswer, correctMark, loadReview, rejectCause } from './review.js';
import { releaseCrops } from './crops.js';
import { RESCUED_NOTICE } from './enhance.js';
import { PAPER_TYPES, tierForType } from '../papers.js';

const S = {
  ctx: null,
  capture: null,
  draft: null,
  thumbs: new Map(),   // page number → object URL
  run: null,
  regions: null,        // this run's question_region rows, for watchExplanations
  review: null,
  busy: false,
  saving: false,        // true while save() is waiting on explanations before commit
};

/**
 * The surfaces this flow paints into, and the primitives it needs.
 *
 * Set once by initScanUI. Every entry is a no-op by default so a call that
 * arrives before the screen has mounted goes quiet rather than throwing —
 * `watchExplanations` lands questions asynchronously and can outlive the
 * screen that started it.
 */
let host = {
  toast() {}, tick() {}, firm() {},
  scanSurface: () => null,
  renderHint() {}, cameraLive() {},
  renderTray() {}, renderDrafts() {}, draftToast() {}, renderProgress() {},
  openSheet() {}, openReview() {}, renderReview() {}, closeReview() {},
  goto() {}, refreshLibrary: async () => {},
};

const toast = (m, tone) => host.toast(m, tone);
const tick = () => host.tick();
const firm = () => host.firm();

export async function initScanUI(ctx, surfaces = {}) {
  S.ctx = ctx;
  host = { ...host, ...surfaces };
  if (!ctx.student) return;

  const surface = host.scanSurface();
  if (!surface?.video) return;

  S.capture = createCapture({
    video: surface.video,
    overlay: surface.overlay,
    onState: (state) => host.renderHint(state),
    onShot: (shot) => {
      tick();
      // A retake replaces the page it was taken for, keeping its place in the
      // booklet. Anything else is the next page.
      const replacing = S.retaking;
      S.retaking = null;
      takePage(shot, replacing);
    },
  });

  await restoreDraft();
  await paintDrafts();
}

/** The shutter. Exported rather than bound to a button id, so the control that
    fires it is the screen's business and not this module's. */
export function shoot() {
  S.capture?.shoot();
}

export function setAutoCapture(on) {
  tick();
  S.capture?.setAutoCapture(on);
}

/**
 * Called on every entry to and exit from the Scan screen.
 *
 * @param {boolean} visible
 * @param {Promise<MediaStream>|MediaStream|Error|null} [camera]
 *   The request fired the instant the tab opened, if there was one. Adopting it
 *   is what keeps the permission sheet from waiting on this module's own load.
 */
export function setScanVisible(visible, camera = null) {
  return visible ? startCamera(camera) : stopCamera();
}

// ── the camera ─────────────────────────────────────────────────────────────

/**
 * @param {Promise<MediaStream>|MediaStream|Error|null} [camera]
 *   The request app.js fired when the tab opened, if there was one. Adopting it
 *   is what keeps the permission sheet from waiting on this module's own load.
 */
async function startCamera(camera = null) {
  if (!S.capture?.supported) {
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
    await S.capture.start(camera);
    host.cameraLive(true);
    host.renderHint(S.capture.state);
  } catch (error) {
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
  S.capture?.stop();
  host.cameraLive(false);
}

// ── a page ─────────────────────────────────────────────────────────────────

async function takePage(shot, replacing = null) {
  if (S.busy) return;
  S.busy = true;
  try {
    if (!S.draft) {
      S.draft = await createDraft({
        id: crypto.randomUUID(),
        studentId: S.ctx.student.id,
        paperType: null,
      });
    }
    // A retake replaces the thumbnail too — the cache is keyed by page number,
    // so without this the tray keeps showing the picture that was just rejected.
    if (replacing !== null && S.thumbs.has(replacing)) {
      URL.revokeObjectURL(S.thumbs.get(replacing));
      S.thumbs.delete(replacing);
    }

    const { page } = await acceptPage({
      draft: S.draft, bitmap: shot.bitmap, quad: shot.quad, replacing,
      capturePath: shot.capturePath ?? null, liveGate: shot.gate ?? null,
      // Recorded rather than assumed, on both paths. See CAPTURE.SOURCE_KINDS.
      sourceKind: shot.sourceKind ?? 'camera',
      original: shot.original ?? null,
    });

    await paintTray();

    // The verdict is delivered now, while the paper is still in front of the
    // student. The same words forty seconds later usually mean a lost page.
    // A fail interrupts rather than badges: losing the page bytes costs
    // nothing, losing the moment the paper is still in hand costs everything.
    // Retake is the default action; keeping the page is the explicit second
    // choice, never the primary one.
    if (page.quality?.verdict === 'fail') {
      offerRetake(page);
    } else if (page.quality?.verdict === 'warn') {
      toast(page.quality.reasons[0] ?? 'That page is a little soft.', 'warn');
    }
    if (page.layer_fallback === 'non_red_marking') {
      toast('This page looks marked in something other than red — we will read it more carefully.');
    }
    // A rescued page is told about. It was under the resolution floor, it has
    // been brought up to it, and the student is the one who can tell whether
    // that worked — so they are told plainly and pointed at the one thing to
    // check. Never phrased as an apology and never as a question.
    if (page.meta?.enhance?.applied) toast(RESCUED_NOTICE);
  } catch (error) {
    // A refusal is advice, not a breakage: the page cannot be used and the
    // message already says what to do instead. Shown the same way a fail
    // verdict is, while the paper is still on the desk.
    toast(error.message || 'That page could not be prepared.', 'warn');
  } finally {
    S.busy = false;
    shot.bitmap?.close?.();
  }
}

async function paintTray() {
  const pages = S.draft?.pages ?? [];
  for (const page of pages) {
    if (S.thumbs.has(page.page_number)) continue;
    S.thumbs.set(page.page_number, URL.createObjectURL(page.proxy ?? page.blob));
  }
  host.renderTray(
    pages.map((p) => ({ ...p, thumb: S.thumbs.get(p.page_number) })),
    { onPage: openPageActions, onDone: sendPaper },
  );
}

/**
 * The page just taken failed the quality gate on its actual, conditioned
 * pixels — not the live proxy's guess. Interrupt now, while the paper is
 * still in front of the student, rather than leaving it as a badge in the
 * tray the student may not even notice. Retake is the primary choice; keeping
 * a page we already know is bad is the explicit secondary one.
 */
function offerRetake(page) {
  const reason = page.quality?.reasons?.[0] ?? 'That page came out too badly to read.';
  host.openSheet({
    title: `Page ${page.page_number}`,
    body: reason,
    items: [],
    choices: [
      { label: 'Take it again now', value: 'retake' },
      { label: 'Use it anyway', value: 'keep' },
    ],
    onChoice: (choice) => {
      if (choice !== 'retake') return;
      toast(`Point at page ${page.page_number} and take it again.`);
      S.retaking = page.page_number;
    },
  });
}

/**
 * What can be done to one page in the tray.
 *
 * A sheet that states the consequences rather than a confirmation that asks the
 * student to prove themselves — removing a page says what removing it does, and
 * then does it.
 */
function openPageActions(pageNumber) {
  const page = S.draft?.pages.find((p) => p.page_number === pageNumber);
  if (!page) return;
  const reasons = page.quality?.reasons ?? [];

  host.openSheet({
    title: `Page ${pageNumber}`,
    body: reasons.length ? reasons[0] : 'This page looks fine.',
    items: [],
    choices: [
      { label: 'Take this page again', value: 'retake' },
      ...(pageNumber > 1 ? [{ label: 'Move earlier', value: 'up' }] : []),
      ...(pageNumber < S.draft.pages.length ? [{ label: 'Move later', value: 'down' }] : []),
      { label: 'Remove this page', value: 'remove' },
    ],
    onChoice: async (choice) => {
      if (choice === 'retake') {
        toast(`Point at page ${pageNumber} and take it again.`);
        S.retaking = pageNumber;
        return;
      }
      if (choice === 'up') S.draft = await movePage(S.draft, pageNumber, pageNumber - 1);
      if (choice === 'down') S.draft = await movePage(S.draft, pageNumber, pageNumber + 1);
      if (choice === 'remove') {
        S.draft = await removePage(S.draft, pageNumber);
        toast(`Page ${pageNumber} removed. The rest keep their order.`);
      }
      S.thumbs.forEach((url) => URL.revokeObjectURL(url));
      S.thumbs.clear();
      await paintTray();
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

async function resumeDraft(id) {
  S.draft = await readDraft(id);
  S.thumbs.forEach((url) => URL.revokeObjectURL(url));
  S.thumbs.clear();
  await paintTray();
  toast(`Picking up where you left off — ${S.draft.pages.length} page(s) already taken.`);
}

// ── sending the paper up ───────────────────────────────────────────────────

/**
 * Onboarding's last step already asked what the first paper is. Carried here so
 * the very first scan is not asked the same question twice — and cleared on
 * use, so the second paper is asked rather than silently inheriting the first
 * one's type, which would file a board paper as a school test and cost it its
 * marking scheme.
 */
export function setPendingPaperType(type) {
  S.pendingType = type ?? null;
}

function sendPaper() {
  if (!S.draft?.pages.length) return toast('Take a page first.');
  const type = S.draft.paper_type ?? S.pendingType;
  if (type) { S.pendingType = null; return run(type); }

  // The type decides Tier 1 against Tier 2, which is the highest-leverage field
  // in the app, so it is asked plainly rather than guessed from a filename.
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
    // The draft stays until the paper is committed. It holds the conditioned
    // pages, and "Rescan this page" needs them: without it that button landed in
    // an empty draft, tried to replace a page that was not there, and died on an
    // undefined. The schema already expects this — a rescan starts a new run
    // over the same paper.
    firm();
    // Explanations start only once review is done (save()), never here — the
    // student has confirmed nothing at this point, and starting them now is
    // guaranteed to 409 against reviewComplete's outstanding-review gate, every
    // time. See AXON_FIX_BRIEF.md §4.A1.
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
  S.runId = runId;
  await refreshReview();
  host.openReview();
}

/**
 * Re-entry into review after the scan session that started it has ended —
 * the app was closed, or the student navigated away, while a paper sat at
 * `needs_review` (or later). The draft only ever remembers `paper_id`; the
 * run and its regions are resolved fresh here rather than persisted, so
 * this can never open a stale review.
 *
 * @param {string} draftId
 * @returns {Promise<{state:'reviewing'}|{state:'committed',paperId:string}|{state:'processing'}|{state:'stopped',reason:string|null}|{state:'gone'}>}
 */
export async function resumeDraftReview(draftId) {
  const draft = await readDraft(draftId);
  if (!draft?.paper_id) return { state: 'gone' };

  const run = await currentRunForPaper(draft.paper_id);
  if (!run) return { state: 'gone' };

  if (run.status === 'committed') return { state: 'committed', paperId: draft.paper_id };
  if (run.status === 'failed' || run.status === 'rejected') {
    return { state: 'stopped', reason: run.status_reason ?? null };
  }
  if (!['needs_review', 'explaining', 'ready'].includes(run.status)) {
    // Still being read server-side — nothing to review yet.
    return { state: 'processing' };
  }

  S.draft = draft;
  S.regions = await regionsForRun(run.id);
  await openReview(run.id);
  return { state: 'reviewing' };
}

/**
 * Ask for a re-render soon, rather than once per event.
 *
 * Explanations land one at a time and each one used to trigger a full reload and
 * a wholesale re-render — so the list reset its scroll under the student's
 * finger during the exact moment the whole design is for: reading question one
 * while question nine is still being worked out.
 */
let refreshTimer = null;
function scheduleReviewRefresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => { refreshTimer = null; refreshReview(); }, 400);
}

async function refreshReview() {
  if (!S.runId) return;
  S.review = await loadReview(S.runId);
  const paper = S.review.paper;

  /* The old renderer rebuilt the list from innerHTML on every refresh, so the
     scroll position had to be saved and put back around it — losing a student's
     place mid-read is the same failure as the list jumping, arriving by another
     route. React reconciles a keyed list instead of replacing it, so the scroll
     is never lost in the first place and the save-and-restore is gone. The
     requirement it served has not gone anywhere: keep the question key stable. */

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
      unreadableReason: q.unreadableReason,
      alternatives: q.alternatives,
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
    // Accepted immediately. This is self-knowledge and exactly the signal we
    // want; there is nothing here to negotiate.
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
      // The sheet hands back what was typed, rather than this reaching into the
      // document for it. The student is the authority here: whatever they type
      // is accepted as-is, with no verification and no review queue.
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
        // Back to the camera, which is where the next thing they do happens.
        host.goto('scan');
        toast(`Point at page ${question.pageNumber} and take it again.`);
      },
    });
  }
}

/**
 * Stage 9 → 10, in order: start explanations, wait for them to settle, only
 * then commit. `commit_extraction_run` copies `region_explanation` into
 * `mark_loss_event` at the moment it runs — committing right after *starting*
 * explanations (rather than after they finish) is what left `mark_loss_event`
 * empty on every paper this app has ever produced. See AXON_FIX_BRIEF.md §6.2.
 *
 * A failed or slow explanation pass does not block the marks themselves: this
 * still commits once explanations have either settled or timed out, so a
 * paper is never held hostage by stage 8. Whatever landed lands; nothing here
 * is a silent catch — every failure is logged and told to the student.
 */
async function save() {
  if (!S.runId || S.saving) return;
  if (S.review?.outstanding) {
    // The server refuses this too — the guard here is so the student hears why
    // from the screen rather than from a rejected request.
    toast(`${S.review.outstanding} question(s) still need a look. They are at the top.`);
    return;
  }

  S.saving = true;
  await refreshReview();

  try {
    try {
      await startExplanations(S.runId);
      await watchExplanations({
        runId: S.runId,
        regions: S.regions ?? [],
        onQuestion: () => scheduleReviewRefresh(),
      });
    } catch (error) {
      // Explanations are a layer on top of the marks, not a precondition for
      // saving them. Log it, tell the student plainly, and still commit —
      // the marks are real and confirmed either way.
      console.error('explanations', error);
      toast('We could not work out why marks were lost this time. Your marks are still saved.', 'warn');
    }

    const result = await commitRun(S.runId);
    firm();
    toast(`Saved. ${result.attempts_committed} question${result.attempts_committed === 1 ? '' : 's'} in your Library.`);
    host.closeReview();
    releaseCrops();
    S.runId = null;
    S.regions = null;
    // Now the pages have done their job.
    if (S.draft) {
      await deleteDraft(S.draft.id);
      S.draft = null;
      S.thumbs.forEach((url) => URL.revokeObjectURL(url));
      S.thumbs.clear();
      await paintTray();
      await paintDrafts();
    }
    await host.refreshLibrary();
  } catch (error) {
    toast(error.message || 'That could not be saved.', 'warn');
  } finally {
    S.saving = false;
    if (S.runId) await refreshReview();
  }
}

/**
 * Bring uploaded images in through the same door as captured ones.
 *
 * Upload is a first-class path, not a fallback, so a page that arrives from the
 * gallery gets exactly what a captured page gets: conditioning, layer
 * separation, a quality verdict and a place in the tray. The only thing it does
 * not get is a quad, because a photo taken last week has no live edge detection
 * behind it — the page is used as it stands.
 */
export async function acceptUploads(files) {
  if (!S.ctx?.student) return;
  const images = files.filter((f) => /^image\//.test(f.type));
  const rest = files.filter((f) => !/^image\//.test(f.type));

  if (rest.length) {
    // Said plainly rather than dropped or half-handled. A PDF that looked
    // accepted and was never read is the invisible failure hard rule 4 forbids.
    toast(`${rest.length} file(s) are not images. We can't read PDFs yet — photos of the pages work.`, 'warn');
  }
  if (!images.length) return;

  for (const file of images) {
    try {
      const bitmap = await createImageBitmap(file);
      // The file itself is the original — already the least degraded copy
      // there is, so nothing is re-encoded to produce one.
      await takePage({ bitmap, quad: null, auto: false, sourceKind: 'upload', original: file });
    } catch {
      toast(`${file.name} could not be opened.`, 'warn');
    }
  }
}

export { openReview };
