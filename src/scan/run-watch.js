// A foreground waiting budget is not a processing deadline. The server owns
// the run, so expiry returns its latest state without calling it a failure.
export const REVIEW_STATES = new Set(['needs_review', 'explaining', 'ready', 'committed', 'rejected', 'failed']);

export async function watchRun({
  read, onStatus, budgetMs = 5 * 60 * 1000, pollMs = 1500,
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  const startedAt = now();
  let lastStatus = null;
  for (;;) {
    const run = await read();
    if (run.status !== lastStatus) {
      lastStatus = run.status;
      onStatus?.(run);
    }
    if (REVIEW_STATES.has(run.status)) return { ...run, processing: false };
    if (now() - startedAt >= budgetMs) return { ...run, processing: true };
    await sleep(Math.min(pollMs, Math.max(0, budgetMs - (now() - startedAt))));
  }
}
