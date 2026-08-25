// The message for a worker's *catch-all* permanent-failure handler — the one
// that runs on whatever `handle()` threw, without knowing why. That handler
// cannot tell a genuinely lost upload from a page that conditioned, uploaded
// and persisted fine and then hit a network blip talking to a model, so it
// must not assume the worse of the two and say so.
//
// `paper-submit` requires every page to already carry a real `r2_key` before
// an `extraction_run` can exist at all — by the time any queue worker runs,
// "nothing was saved" is normally false. `pagesStored` is the checked fact
// (see `failRunHonestly` in worker.ts) that decides which of the two is
// actually true.
//
// Pure and dependency-free on purpose, same as attribution.ts/reconcile.ts
// next to it: worker.ts pulls in supabase-js to do the actual checking, and a
// test for the choice this makes shouldn't have to pull that in too.
export function honestFailureReason(stageDescription: string, pagesStored: boolean): string {
  return pagesStored
    ? `We couldn't finish ${stageDescription} just now — your pages are kept, and you can try again.`
    : 'We could not find the pages for this paper. Try scanning it again.';
}
