#!/usr/bin/env node
// Pull a real extraction run out of the database into the harness's format.
//
//   MASTERY_SUPABASE_URL=https://<project>.supabase.co \
//   MASTERY_ANON_KEY=<publishable key> \
//   MASTERY_ACCESS_TOKEN=<a signed-in guardian's JWT> \
//   node harness/export.mjs <run-id> [<run-id> …] > harness/runs/2026-08-20-v1.json
//
// A guardian's own token, not the service key. The golden set is scanned under a
// test account like any other student's papers, so RLS is exactly the right
// amount of access — and a harness that needs the service role is a harness that
// tempts someone to run it against real accounts.

const url = process.env.MASTERY_SUPABASE_URL;
const anon = process.env.MASTERY_ANON_KEY;
const token = process.env.MASTERY_ACCESS_TOKEN;

if (!url || !anon || !token) {
  console.error('Set MASTERY_SUPABASE_URL, MASTERY_ANON_KEY and MASTERY_ACCESS_TOKEN.');
  process.exit(2);
}

const runIds = process.argv.slice(2);
if (!runIds.length) {
  console.error('usage: node harness/export.mjs <run-id> [<run-id> …]');
  process.exit(2);
}

async function get(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const papers = [];
let pipelineVersion = null;
let models = {};

for (const runId of runIds) {
  const [run] = await get(`extraction_run?id=eq.${runId}&select=*`);
  if (!run) throw new Error(`no run ${runId}`);
  pipelineVersion ??= run.pipeline_version;
  models = { ...models, ...(run.model_versions ?? {}) };

  const regions = await get(
    `question_region?run_id=eq.${runId}&order=order_index` +
    '&select=order_index,question_label,question_text,student_answer,region_type,' +
    'marks_awarded,marks_available,confidence_tier,page_spans,student_corrected',
  );

  papers.push({
    // The golden set keys on the paper, not the run: the same paper rescanned
    // under a new pipeline version has to line up with its own labels.
    paper_id: run.paper_id,
    run_id: run.id,
    reconciled: run.reconciled === true,
    reconcile_delta: run.reconcile_delta,
    cost_paise: run.cost_paise,
    corrections_count: run.corrections_count,
    stage_timings: run.stage_timings,
    questions: regions.map((r) => ({
      label: r.question_label,
      spans: r.page_spans,
      marks_awarded: r.marks_awarded === null ? null : Number(r.marks_awarded),
      marks_available: r.marks_available === null ? null : Number(r.marks_available),
      student_answer: r.student_answer,
      region_type: r.region_type,
      confidence_tier: r.confidence_tier,
      student_corrected: r.student_corrected,
    })),
  });
}

process.stdout.write(JSON.stringify({
  exported_at: new Date().toISOString(),
  pipeline_version: pipelineVersion,
  models,
  papers,
}, null, 2) + '\n');
