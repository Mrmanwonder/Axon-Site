// Run the golden set through the real pipeline.
//
// Not a mock. The point of an eval is to measure the thing that ships, so this
// mints a fresh extraction_run against papers that already exist, marks it with
// a route override, and drops it on the same queue every other paper uses. The
// workers do not know they are being measured, which is the only way the number
// means anything.
//
// Scoring is not here. `harness/export.mjs` pulls the finished runs out and
// `harness/run.mjs` scores them against the labels, because the metrics are
// plain JavaScript with no dependencies and a harness nobody can run is a
// harness that stops being run.

import { failure, isServiceCall, json, readJson, serviceClient } from '../_shared/http.ts';
import { PIPELINE_VERSION } from '../_shared/contract.ts';

interface Body {
  golden_set_version: string;
  /** Papers already in the database, scanned under the harness's test account. */
  paper_ids: string[];
  stages?: string[];
  route_override?: Record<string, unknown> | null;
  notes?: string;
}

/** Twenty papers is the golden set; a hundred would be someone's mistake. */
const MAX_PAPERS = 100;

Deno.serve(async (req) => {
  // Service-role only. An eval run costs real money on a real key.
  if (!isServiceCall(req)) return failure('not authorised', 401);

  const body = await readJson<Body>(req);
  if (!body?.golden_set_version || !Array.isArray(body.paper_ids) || !body.paper_ids.length) {
    return failure('an eval needs a golden set version and at least one paper');
  }
  if (body.paper_ids.length > MAX_PAPERS) {
    return failure(`${body.paper_ids.length} papers is more than an eval run should be`);
  }

  // allow_training is stripped rather than rejected. An eval is exactly the
  // context where someone would reach for it to get a free model working, and
  // the papers in the golden set are real children's exam scripts.
  const override = body.route_override ? { ...body.route_override } : null;
  if (override && 'allow_training' in override) delete override.allow_training;

  const sb = serviceClient();

  const { data: evalRun, error } = await sb.from('eval_run').insert({
    golden_set_version: body.golden_set_version,
    stages: body.stages ?? ['triage', 'structure', 'content', 'explain'],
    route_override: override,
    notes: body.notes ?? null,
    papers: body.paper_ids.length,
  }).select('id').single();

  if (error || !evalRun) return failure('could not open the eval run', 500, error?.message);

  const started: { paper_id: string; run_id: string }[] = [];
  const skipped: { paper_id: string; reason: string }[] = [];

  for (const paperId of body.paper_ids) {
    const { data: paper } = await sb
      .from('paper').select('id, student_id').eq('id', paperId).maybeSingle();
    if (!paper) { skipped.push({ paper_id: paperId, reason: 'no such paper' }); continue; }

    const { count: pages } = await sb
      .from('paper_page').select('id', { count: 'exact', head: true })
      .eq('paper_id', paperId).not('r2_key', 'is', null);
    if (!pages) { skipped.push({ paper_id: paperId, reason: 'no pages' }); continue; }

    // A fresh run, not a rerun of the old one. The whole comparison depends on
    // two runs over the same pages existing side by side afterwards.
    const { data: run } = await sb.from('extraction_run').insert({
      paper_id: paper.id,
      student_id: paper.student_id,
      pipeline_version: PIPELINE_VERSION,
      status: 'queued',
      heartbeat_at: new Date().toISOString(),
      route_override: override,
      eval_run_id: evalRun.id,
    }).select('id').single();
    if (!run) { skipped.push({ paper_id: paperId, reason: 'could not open a run' }); continue; }

    // Every page starts over. Structure status is per-page and a previous run
    // left it 'done'; without this the new run would advance immediately
    // without reading anything and report a perfect, meaningless score.
    await sb.from('paper_page').update({ structure_status: 'pending' }).eq('paper_id', paper.id);

    await sb.from('eval_result').insert({
      eval_run_id: evalRun.id,
      run_id: run.id,
      paper_id: paper.id,
      golden_id: paperId,
    });

    await sb.rpc('pgmq_send', { queue_name: 'mastery_triage', msg: { run_id: run.id } });
    started.push({ paper_id: paper.id, run_id: run.id });
  }

  await sb.from('eval_run').update({ papers: started.length }).eq('id', evalRun.id);

  return json({
    eval_run_id: evalRun.id,
    started,
    skipped,
    // Said plainly: the run is queued, not finished, and the numbers come from
    // the harness once the workers have drained.
    next: 'node harness/export.mjs ' + started.map((s) => s.run_id).join(' ') +
      ' > harness/runs/<name>.json',
  }, 202);
});
