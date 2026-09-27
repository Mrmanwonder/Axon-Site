// Offline evidence aggregation. No images, account ids, telemetry or network.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const PROPOSED_BUDGET = Object.freeze({ acquisitionMs: 3000, observationMs: 10000, autoCaptureRate: 0.95, minTrials: 20 });
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null;
const finite = (value) => Number.isFinite(value) && value >= 0;

export function summarizeTrials(input) {
  if (input?.schemaVersion !== 1 || !['physical', 'synthetic'].includes(input.source)) throw new Error('schemaVersion 1 and source physical/synthetic required');
  for (const key of ['build', 'device', 'os', 'browser']) {
    if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`${key} is required`);
  }
  if (!Array.isArray(input.trials) || !input.trials.length) throw new Error('At least one observed trial is required');
  const ids = new Set();
  const groups = new Map();
  for (const trial of input.trials) {
    const { id, scenario, expectation, observationMs, firstLockMs, correctAutoCaptureMs, falseAutoCaptures } = trial;
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error('Trial ids must be unique nonempty strings');
    ids.add(id);
    if (typeof scenario !== 'string' || !scenario.trim()) throw new Error(`${id}: scenario required`);
    if (!['auto', 'lock-only', 'reject'].includes(expectation)) throw new Error(`${id}: unknown expectation`);
    if (!finite(observationMs) || observationMs < PROPOSED_BUDGET.observationMs) throw new Error(`${id}: observe for at least ${PROPOSED_BUDGET.observationMs}ms, including after capture`);
    for (const value of [firstLockMs, correctAutoCaptureMs]) {
      if (value !== null && (!finite(value) || value > observationMs)) throw new Error(`${id}: measurements must be null or within observationMs`);
    }
    if (!Number.isInteger(falseAutoCaptures) || falseAutoCaptures < 0) throw new Error(`${id}: falseAutoCaptures must be a nonnegative integer`);
    if (expectation === 'reject' && correctAutoCaptureMs !== null) throw new Error(`${id}: a negative cannot have a correct capture`);
    if (expectation === 'lock-only' && correctAutoCaptureMs !== null) throw new Error(`${id}: a lock-only page is not capture-ready`);
    if (correctAutoCaptureMs !== null && (firstLockMs === null || correctAutoCaptureMs < firstLockMs)) throw new Error(`${id}: Auto capture requires a preceding live lock`);
    if ((trial.droppedFrames !== undefined || trial.totalFrames !== undefined)
      && (!Number.isInteger(trial.droppedFrames) || !Number.isInteger(trial.totalFrames)
      || trial.totalFrames <= 0 || trial.droppedFrames < 0 || trial.droppedFrames > trial.totalFrames)) throw new Error(`${id}: invalid frame counts`);
    const key = JSON.stringify([scenario, expectation]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trial);
  }
  const scenarios = [...groups.values()].map((trials) => {
    const { scenario, expectation } = trials[0];
    const locks = trials.filter((t) => t.firstLockMs !== null).map((t) => t.firstLockMs);
    const eligible = expectation === 'auto' ? trials.length : 0;
    const captures = trials.filter((t) => t.correctAutoCaptureMs !== null && t.correctAutoCaptureMs <= PROPOSED_BUDGET.observationMs).length;
    const falseCaptures = trials.reduce((sum, t) => sum + t.falseAutoCaptures, 0);
    const acquisitionTimeouts = expectation === 'reject' ? null : trials.filter((t) => t.firstLockMs === null || t.firstLockMs > PROPOSED_BUDGET.acquisitionMs).length;
    const falseLocks = expectation === 'reject' ? locks.length : 0;
    return {
      scenario, expectation, trials: trials.length, lockSamples: locks.length,
      // Latency percentiles are conditional on successful acquisition; failures
      // stay visible in the denominator and acquisitionTimeouts.
      acquisitionP50Ms: percentile(locks, 0.5), acquisitionP95Ms: percentile(locks, 0.95),
      acquisitionTimeouts, eligiblePages: eligible, correctAutoCaptures: captures,
      autoCaptureTimeouts: eligible ? eligible - captures : null,
      autoCaptureRate: eligible ? captures / eligible : null, falseCaptures, falseLocks,
      meetsProposedBudget: trials.length >= PROPOSED_BUDGET.minTrials && falseCaptures === 0 && falseLocks === 0
        && (acquisitionTimeouts === null || acquisitionTimeouts / trials.length <= 0.05)
        && (!eligible || captures / eligible >= PROPOSED_BUDGET.autoCaptureRate),
    };
  });
  return { schemaVersion: 1, source: input.source, build: input.build, device: input.device, os: input.os, browser: input.browser,
    proposedBudget: PROPOSED_BUDGET, scenarios,
    acceptance: 'Measurements only: device/scenario coverage and physical acceptance must be reviewed in AXO-45/46/47/48.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node bench/scanner-reliability.mjs trials.json');
    console.log(JSON.stringify(summarizeTrials(JSON.parse(await readFile(process.argv[2], 'utf8'))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
