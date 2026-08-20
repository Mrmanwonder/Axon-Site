// Scan and review, wired together.
//
// index.html owns the surfaces — the viewfinder, the tray, the review screen,
// the confidence chips and the cause hues. This owns the flow: when the camera
// runs, what happens to a page once it is taken, which stage is running, and
// what a correction does. The two meet at the renderers published by the design
// system, so neither reimplements the other.

import { createCapture } from './capture.js';
import { acceptPage, explainPaper, ingest } from './pipeline.js';
import { createDraft, deleteDraft, listDrafts, movePage, readDraft, removePage } from './drafts.js';
import { commitRun, confirmQuestion, correctAnswer, correctMark, loadReview, rejectCause } from './review.js';
import { releaseCrops } from './crops.js';
import { PAPER_TYPES, tierForType } from '../papers.js';

const S = {
  ctx: null,
  capture: null,
  draft: null,
  thumbs: new Map(),   // page number → object URL
  run: null,
  review: null,
  busy: false,
};

const toast = (m, tone) => window.__masteryApp?.toast?.(m, tone);
const tick = () => window.__masteryHaptic?.tick?.();
const firm = () => window.__masteryHaptic?.firm?.();

export async function initScanUI(ctx) {
  S.ctx = ctx;
  if (!ctx.student) return;

  const surface = window.__masteryScanSurface?.();
  if (!surface?.video) return;

  S.capture = createCapture({
    video: surface.video,
    overlay: surface.overlay,
    onState: (state) => window.__masteryRenderHint?.(state),
    onShot: (shot) => {
      tick();
      // A retake replaces the page it was taken for, keeping its place in the
      // booklet. Anything else is the next page.
      const replacing = S.retaking;
      S.retaking = null;
      takePage(shot, replacing);
    },
  });

  document.getElementById('shutterBtn')?.addEventListener('click', () => S.capture.shoot());
  document.getElementById('autoToggle')?.addEventListener('click', (e) => {
    const el = e.currentTarget;
    const next = !el.classList.contains('on');
    el.classList.toggle('on', next);
    el.setAttribute('aria-pressed', String(next));
    tick();
    S.capture.setAutoCapture(next);
  });

  window.__masteryScanVisible = (visible) => (visible ? startCamera() : stopCamera());

  await restoreDraft();
  await paintDrafts();
}

// ── the camera ─────────────────────────────────────────────────────────────

async function startCamera() {
  if (!S.capture?.supported) {
    // No camera, or a browser that will not give one up. Upload is a
    // first-class path, so this is a different route rather than a failure.
    window.__masteryRenderHint?.({
      hint: 'No camera here — add pages from your files instead', blocking: null,
    });
    return;
  }
  try {
    await S.capture.start();
    window.__masteryCameraLive?.(true);
  } catch (error) {
    window.__masteryCameraLive?.(false);
    window.__masteryRenderHint?.({
      hint: error?.name === 'NotAllowedError'
        ? 'Camera access is off for this site — you can still add pages from your files'
        : 'The camera could not start — you can still add pages from your files',
      blocking: 'camera',
    });
  }
}

function stopCamera() {
  S.capture?.stop();
  window.__masteryCameraLive?.(false);
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
    const { page } = await acceptPage({
      draft: S.draft, bitmap: shot.bitmap, quad: shot.quad, replacing,
    });

    // The verdict is delivered now, while the paper is still in front of the
    // student. The same words forty seconds later usually mean a lost page.
    if (page.quality?.verdict === 'fail') {
      toast(page.quality.reasons[0] ?? 'That page came out badly — worth taking again.', 'warn');
    } else if (page.quality?.verdict === 'warn') {
      toast(page.quality.reasons[0] ?? 'That page is a little soft.', 'warn');
    }
    if (page.layer_fallback === 'non_red_marking') {
      toast('This page looks marked in something other than red — we will read it more carefully.');
    }

    await paintTray();
  } catch (error) {
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
  window.__masteryRenderTray?.(
    pages.map((p) => ({ ...p, thumb: S.thumbs.get(p.page_number) })),
    { onPage: openPageActions, onDone: sendPaper },
  );
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

  window.__masteryOpenSheet?.({
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
  window.__masteryDraftToast?.(
    { id: latest.id, pages: latest.pages.length },
    { onResume: resumeDraft },
  );
}

async function paintDrafts() {
  const drafts = await listDrafts(S.ctx.student.id);
  window.__masteryRenderDrafts?.(
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
  window.__masteryOpenSheet?.({
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

  const paint = (now, sub) => window.__masteryRenderProgress?.({
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
      window.__masteryRenderProgress?.({
        heading: 'This one we did not read',
        now: result.message,
        steps: [],
        note: 'The pages are kept. If this really is a marked paper, retaking the first page usually fixes it.',
      });
      return;
    }

    S.run = result;
    await deleteDraft(S.draft.id);
    S.draft = null;
    S.thumbs.forEach((url) => URL.revokeObjectURL(url));
    S.thumbs.clear();
    await paintTray();
    await paintDrafts();

    firm();
    await openReview(result.runId);

    // Stage 8 runs after the paper is already open and readable, and paints
    // each question in as it lands. A student should be reading question 1
    // while question 9 is still being worked out.
    explainPaper({
      runId: result.runId,
      regions: result.regions,
      onQuestion: async () => { await refreshReview(); },
    }).catch(() => { /* a failed explanation leaves the marks intact and visible */ });
  } catch (error) {
    window.__masteryRenderProgress?.({
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
  window.__masteryOpenReview?.();
}

async function refreshReview() {
  if (!S.runId) return;
  S.review = await loadReview(S.runId);
  const paper = S.review.paper;

  window.__masteryRenderReview?.({
    title: paper?.subject
      ? `${paper.subject} · ${PAPER_TYPES.find((t) => t.value === paper.type)?.label ?? ''}`.trim()
      : PAPER_TYPES.find((t) => t.value === paper?.type)?.label ?? 'Review',
    lead: S.review.lead,
    delta: S.review.delta,
    saveLabel: S.review.outstanding
      ? `${S.review.outstanding} left to check`
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
    window.__masteryOpenSheet?.({
      title: 'Fix this',
      body: 'Type what your answer actually says. We take your word for it — you have the paper.',
      items: [],
      input: { id: 'fixText', placeholder: question.answer ?? 'What you wrote' },
      primary: 'Use this',
      primaryClass: 'primary',
      onConfirm: async () => {
        const value = document.querySelector('#fixText')?.value ?? '';
        try { await correctAnswer(id, value); await refreshReview(); }
        catch (e) { toast(e.message, 'warn'); }
      },
    });
    return;
  }

  if (action === 'rescan') {
    window.__masteryOpenSheet?.({
      title: `Take page ${question.pageNumber ?? ''} again?`,
      body: 'One page, not the whole paper. What we already read from the other pages stays as it is.',
      items: [
        ['Only this page is replaced.', 'The rest of the paper keeps its questions and marks.'],
        ['It is read again from scratch.', 'Anything you have already fixed on this page is re-read.'],
      ],
      primary: 'Take it again',
      primaryClass: 'primary',
      onConfirm: () => {
        window.__masteryCloseReview?.();
        S.retaking = question.pageNumber;
        toast(`Point at page ${question.pageNumber} and take it again.`);
      },
    });
  }
}

async function save() {
  if (!S.runId) return;
  if (S.review?.outstanding) {
    // The server refuses this too — the guard here is so the student hears why
    // from the screen rather than from a rejected request.
    toast(`${S.review.outstanding} question(s) still need a look. They are at the top.`);
    return;
  }
  try {
    const result = await commitRun(S.runId);
    firm();
    toast(`Saved. ${result.attempts_committed} question${result.attempts_committed === 1 ? '' : 's'} in your Library.`);
    window.__masteryCloseReview?.();
    releaseCrops();
    S.runId = null;
    await window.__masteryApp?.refreshLibrary?.();
  } catch (error) {
    toast(error.message || 'That could not be saved.', 'warn');
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
      await takePage({ bitmap, quad: null, auto: false });
    } catch {
      toast(`${file.name} could not be opened.`, 'warn');
    }
  }
}

export { openReview };
