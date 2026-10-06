// Sending papers, in the background, until each one is read.
//
// Pressing Read hands a draft to this queue and the scanner is free again: the
// student can scan the next paper while this one sends. Several papers can be
// sending at once. A send never ends in "That did not finish" (owner, 6 Oct
// 2026): a lost connection waits for the connection, a closed or crashed tab
// resumes from the exact file it reached the next time Axon opens, and a second
// tab waits for the first instead of failing. The draft on this device is the
// record of how far it got; every confirmed file is kept, so nothing is sent
// twice.
//
// The queue is plain data plus a subscription, so React can paint it and tests
// can drive it without a browser.

const REVIEW = new Set(['needs_review', 'explaining', 'ready', 'committed']);
const STOPPED = new Set(['rejected', 'failed']);
const BACKOFF_MS = [2000, 4000, 8000, 15000, 30000];
// Client errors that retrying cannot fix. Everything else (no connection, a
// timeout, a server hiccup, an expired upload link) is waited out.
const permanent = status => status >= 400 && status < 500 && ![401, 403, 408, 409, 425, 429].includes(status);

export const STAGE_STEPS = [
  { key: 'upload', label: 'Sending the pages' },
  { key: 'structure', label: 'Finding the questions' },
  { key: 'content', label: 'Reading the answers and the marking' },
  { key: 'reconcile', label: 'Checking the marks add up' },
];

export const STAGE_FOR_STATUS = {
  queued: 'structure', triaging: 'structure', structure: 'structure', cropping: 'structure',
  content: 'content', attribution: 'content', reconciliation: 'reconcile', adjudicating: 'reconcile',
};
export const MESSAGE_FOR_STATUS = {
  queued: 'Waiting to start',
  triaging: 'Checking this is a marked paper',
  structure: 'Finding the questions',
  cropping: 'Getting each question ready to read',
  content: 'Reading the answers and the marking',
  attribution: 'Matching the marks to the questions',
  reconciliation: 'Checking the marks add up',
  adjudicating: 'Checking the marks add up',
};

const realSleep = (ms, signal) => new Promise(resolve => {
  const timer = setTimeout(done, ms);
  function done() { clearTimeout(timer); signal?.removeEventListener('abort', done); globalThis.removeEventListener?.('online', done); resolve(); }
  signal?.addEventListener('abort', done, { once: true });
  // Back online: try straight away rather than finishing the wait.
  globalThis.addEventListener?.('online', done, { once: true });
});

/**
 * @param {{
 *   ingest: Function, currentRunForPaper: Function, readDraft: Function,
 *   listDrafts: Function, requestSend: Function,
 *   thumbFor?: (page: any) => string|null, revoke?: (url: string) => void,
 *   sleep?: (ms: number, signal?: AbortSignal) => Promise<void>,
 *   online?: () => boolean, now?: () => number,
 * }} deps
 */
export function createSendQueue(deps) {
  const sleep = deps.sleep ?? realSleep;
  const online = deps.online ?? (() => globalThis.navigator?.onLine !== false);
  const now = deps.now ?? Date.now;
  const thumbFor = deps.thumbFor ?? (() => null);
  const revoke = deps.revoke ?? (() => {});
  const jobs = new Map();
  const listeners = new Set();
  let version = 0;
  let snapshot = [];

  const publicJob = job => ({
    id: job.id, studentId: job.studentId, paperId: job.paperId, runId: job.runId, title: job.title,
    phase: job.phase, stage: job.stage, message: job.message, startedAt: job.startedAt,
    pages: job.pages.map(p => ({ ...p })),
    steps: STAGE_STEPS.map((step, i) => {
      const at = STAGE_STEPS.findIndex(s => s.key === job.stage);
      const finished = job.phase === 'review';
      return { label: step.label, state: finished || i < at ? 'done' : i === at ? 'now' : 'wait' };
    }),
  });
  function emit() {
    version++;
    snapshot = [...jobs.values()].map(publicJob);
    for (const fn of listeners) { try { fn(snapshot); } catch { /* a painter must not stop a send */ } }
  }
  function update(job, patch) { Object.assign(job, patch); emit(); }

  // Thumbnails are made once per job and revoked when it is dismissed.
  const pagesOf = draft => draft.pages.map(page => ({ n: page.page_number, thumb: thumbFor(page), sent: false }));

  async function watch(job) {
    // The server owns the run from here. Watch it until it is ready to review,
    // however long it takes; a hidden tab polls gently.
    let last = null;
    while (!job.controller.signal.aborted) {
      let run = null;
      try { run = await deps.currentRunForPaper(job.paperId); } catch { /* keep the last state */ }
      if (job.controller.signal.aborted) return;
      if (run && run.status !== last) {
        last = run.status;
        if (REVIEW.has(run.status)) return finish(job, { phase: 'review', runId: run.id ?? run.run_id ?? job.runId });
        if (STOPPED.has(run.status)) return finish(job, { phase: 'refused', message: run.status_reason || 'We could not read this paper. The pages are kept.' });
        update(job, { phase: 'reading', stage: STAGE_FOR_STATUS[run.status] ?? 'structure', message: MESSAGE_FOR_STATUS[run.status] ?? 'Working through the paper' });
      }
      const hidden = globalThis.document?.visibilityState === 'hidden';
      await sleep(hidden ? 10000 : 2500, job.controller.signal);
    }
  }

  function finish(job, patch) {
    update(job, { ...patch, pages: job.pages.map(p => ({ ...p, sent: true })) });
    job.resolve?.(publicJob(job));
  }

  async function drive(job) {
    let attempt = 0;
    const signal = job.controller.signal;
    while (!signal.aborted) {
      try {
        update(job, { phase: 'sending', stage: 'upload', message: attempt ? 'Carrying on from where it stopped' : 'Getting ready' });
        const result = await deps.ingest({
          studentId: job.studentId, draft: job.draft, paperType: job.paperType, signal,
          sendStartedAt: job.sendStartedAt, onTelemetry: job.onTelemetry,
          onBackupProgress: () => {},
          onProgress: ({ stage, message, sentPages }) => {
            if (signal.aborted) return;
            const patch = { stage: stage ?? job.stage, message: message ?? job.message, paperId: job.draft.paper_id ?? job.paperId };
            if (stage && stage !== 'upload') patch.phase = 'reading';
            if (Array.isArray(sentPages)) {
              const sent = new Set(sentPages);
              patch.pages = job.pages.map(p => ({ ...p, sent: sent.has(p.n) }));
            }
            if (stage && stage !== 'upload') patch.pages = job.pages.map(p => ({ ...p, sent: true }));
            update(job, patch);
          },
        });
        if (signal.aborted) return;
        update(job, { paperId: result.paperId ?? job.draft.paper_id, runId: result.runId ?? null });
        if (result.refused) return finish(job, { phase: 'refused', message: result.message });
        if (result.processing) {
          update(job, { phase: 'reading', pages: job.pages.map(p => ({ ...p, sent: true })) });
          return watch(job);
        }
        return finish(job, { phase: 'review', runId: result.runId });
      } catch (error) {
        if (signal.aborted) return;
        attempt++;
        if (/was cleared|Open a draft for this student/.test(error?.message ?? '')) {
          // The student deleted this draft or signed out: nothing left to send.
          jobs.delete(job.id); emit(); return;
        }
        if (permanent(error?.status) && attempt >= 3) {
          update(job, { phase: 'stuck', message: 'Axon could not accept this paper. Your pages are kept on this phone.' });
          await new Promise(resolve => { job.wake = resolve; });
          job.wake = null; attempt = 0; continue;
        }
        const message = error?.busy
          ? 'Sending from another Axon tab. It carries on here if that tab closes.'
          : error?.status === 401
            ? 'Sign in again to finish sending. Your pages are kept.'
            : !online()
              ? 'No connection. Sending carries on by itself when you are back online.'
              : 'The connection dropped. Trying again.';
        update(job, { phase: 'waiting', message });
        const wait = error?.busy ? 4000 : BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
        await Promise.race([sleep(wait, signal), new Promise(resolve => { job.wake = resolve; })]);
        job.wake = null;
      }
    }
  }

  function begin({ studentId, draft, paperType, title, sendStartedAt, onTelemetry }) {
    const existing = jobs.get(draft.id);
    // A retaken page sends the same draft again once its last send finished.
    if (existing && !['review', 'refused'].includes(existing.phase)) return existing.done;
    if (existing) for (const page of existing.pages) if (page.thumb) revoke(page.thumb);
    const job = {
      id: draft.id, studentId, draft, paperType: paperType ?? draft.paper_type ?? null,
      title: title ?? null, paperId: draft.paper_id ?? null, runId: null,
      phase: 'sending', stage: 'upload', message: 'Getting ready', startedAt: now(),
      sendStartedAt, onTelemetry,
      controller: new AbortController(), wake: null, resolve: null, done: null,
      pages: [],
    };
    job.pages = pagesOf(draft);
    job.done = new Promise(resolve => { job.resolve = resolve; });
    jobs.set(job.id, job);
    emit();
    void drive(job);
    return job.done;
  }

  return {
    /** Hand a draft over. Resolves when the paper is ready to review, or refused. */
    async start({ studentId, draft, paperType, title, sendStartedAt, onTelemetry }) {
      await deps.requestSend(draft, paperType);
      return begin({ studentId, draft, paperType, title, sendStartedAt, onTelemetry });
    },
    /** Resume every send this device was asked to make and has not finished. */
    async resume(studentId, titleFor = () => null) {
      const drafts = await deps.listDrafts(studentId);
      for (const draft of drafts) {
        if (jobs.has(draft.id)) continue;
        const asked = draft.send_requested || draft.submission_started;
        if (!asked || draft.submission) continue;
        void begin({ studentId, draft, paperType: draft.paper_type, title: titleFor(draft.paper_type) });
      }
    },
    /** Try waiting sends now (back online, tab visible again, Retry pressed). */
    wake(id) {
      for (const job of jobs.values()) if (!id || job.id === id) job.wake?.();
    },
    dismiss(id) {
      const job = jobs.get(id);
      if (!job || !['review', 'refused'].includes(job.phase)) return;
      for (const page of job.pages) if (page.thumb) revoke(page.thumb);
      jobs.delete(id); emit();
    },
    cancelAll() {
      for (const job of jobs.values()) {
        job.controller.abort();
        job.wake?.();
        for (const page of job.pages) if (page.thumb) revoke(page.thumb);
      }
      jobs.clear(); emit();
    },
    draftForPaper(paperId) {
      for (const job of jobs.values()) if (job.draft.paper_id === paperId) return job.draft;
      return null;
    },
    jobForPaper(paperId) {
      return snapshot.find(job => job.paperId === paperId) ?? null;
    },
    get(id) { return snapshot.find(job => job.id === id) ?? null; },
    list() { return snapshot; },
    version() { return version; },
    subscribe(fn) { listeners.add(fn); fn(snapshot); return () => listeners.delete(fn); },
  };
}

let shared = null;
/** The app's one queue, built on first use so the pipeline loads lazily. */
export async function sendQueue() {
  if (shared) return shared;
  const [{ ingest, currentRunForPaper }, drafts] = await Promise.all([
    import('./pipeline.js'), import('./drafts.js'),
  ]);
  shared ??= createSendQueue({
    ingest, currentRunForPaper,
    readDraft: drafts.readDraft, listDrafts: drafts.listDrafts, requestSend: drafts.requestSend,
    thumbFor: page => {
      const blob = page.proxy ?? page.blob;
      return blob instanceof Blob ? URL.createObjectURL(blob) : null;
    },
    revoke: url => URL.revokeObjectURL(url),
  });
  if (typeof window !== 'undefined') {
    const wake = () => shared.wake();
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  }
  return shared;
}
