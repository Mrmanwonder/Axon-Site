// Guards the exact bug a production trace caught: a queue worker's catch-all
// permanent-failure handler telling a student "nothing was saved" when their
// page was sitting in R2 the whole time. `honestFailureReason` is the pure
// decision `failRunHonestly` (in worker.ts) makes once it has checked whether
// this run's pages actually made it to storage — tested here directly and
// without pulling in worker.ts's supabase-js dependency, since the check
// itself needs a live client and isn't worth mocking to exercise a two-branch
// string choice.
//
//   deno test --allow-env supabase/functions/_shared/worker_test.ts

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { honestFailureReason } from './failure_messages.ts';

const claimsDataLoss = (reason: string) =>
  /nothing was saved|lost|not saved/i.test(reason);

Deno.test('pages are stored: the message says so, never that nothing was saved', () => {
  const reason = honestFailureReason('checking this document', true);
  assert(!claimsDataLoss(reason), `unexpected data-loss claim: "${reason}"`);
  assert(reason.includes('kept'), `should say the pages are kept: "${reason}"`);
});

Deno.test('pages are stored: the stage description is actually in the message', () => {
  const reason = honestFailureReason("checking this paper's marks", true);
  assert(reason.includes("checking this paper's marks"), reason);
});

Deno.test('pages are genuinely missing: this is the one case "we could not find the pages" is true', () => {
  const reason = honestFailureReason('checking this document', false);
  assertEquals(reason, 'We could not find the pages for this paper. Try scanning it again.');
});

Deno.test('the two branches never produce the same sentence', () => {
  const stored = honestFailureReason('checking this document', true);
  const missing = honestFailureReason('checking this document', false);
  assert(stored !== missing);
});
