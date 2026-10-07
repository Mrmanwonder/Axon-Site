import { uploadPolicy } from './functions.js';
let policy = { batch_percent: 0, originals_percent: 0 };
let pending = null;
let loadedAt = 0;
let hasSuccessfulPolicy = false;

export function cohortFor(id) {
  let hash = 2166136261;
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 10000 / 100;
}

export function preloadUploadPolicy(signal) {
  if (hasSuccessfulPolicy && Date.now() - loadedAt < 30000) return Promise.resolve(policy);
  if (pending) return pending;
  pending = uploadPolicy({ timeoutMs: 3000, signal }).then(value => {
    const valid = n => Number.isFinite(n) && n >= 0 && n <= 100;
    if (!valid(value?.batch_percent) || !valid(value?.originals_percent)) throw new Error('Invalid upload policy');
    policy = {
      batch_percent: value.batch_percent,
      originals_percent: Math.min(value.originals_percent, value.batch_percent),
    };
    loadedAt = Date.now();
    hasSuccessfulPolicy = true;
    return policy;
  }).catch(() => {
    // A transient policy request must never turn a known-fast draft back into
    // the one-at-a-time legacy uploader. Keep the last authenticated policy and
    // retry on the next preload/online tick. Only a session that has never
    // obtained policy at all fails closed to legacy mode.
    return policy;
  }).finally(() => { pending = null; });
  return pending;
}

export function policyForDraft(id) {
  if (Date.now() - loadedAt >= 30000) void preloadUploadPolicy();
  if (!hasSuccessfulPolicy) return { mode: 'legacy', earlySubmit: false };
  const cohort = cohortFor(id), batch = cohort < policy.batch_percent;
  return { mode: batch ? 'batch' : 'legacy', earlySubmit: batch && cohort < policy.originals_percent };
}
