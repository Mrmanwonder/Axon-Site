import { uploadPolicy } from './functions.js';
let policy = { batch_percent: 0, originals_percent: 0 }, pending = null, loadedAt = 0;
export function cohortFor(id) {
  let hash = 2166136261;
  for (const char of id) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % 10000 / 100;
}
export async function preloadUploadPolicy(signal) {
  if (Date.now() - loadedAt < 30000) return policy;
  pending ??= uploadPolicy({ timeoutMs: 3000, signal }).then(value => {
    const valid = n => Number.isFinite(n) && n >= 0 && n <= 100;
    policy = { batch_percent: valid(value?.batch_percent) ? value.batch_percent : 0,
      originals_percent: valid(value?.originals_percent) ? Math.min(value.originals_percent, value.batch_percent || 0) : 0 };
    loadedAt = Date.now(); return policy;
  }).catch(() => { policy = { batch_percent: 0, originals_percent: 0 }; loadedAt = Date.now(); return policy; })
    .finally(() => { pending = null; });
  return pending;
}
export function policyForDraft(id) {
  if (Date.now() - loadedAt >= 30000) { void preloadUploadPolicy(); return { mode: 'legacy', earlySubmit: false }; }
  const cohort = cohortFor(id), batch = cohort < policy.batch_percent;
  return { mode: batch ? 'batch' : 'legacy', earlySubmit: batch && cohort < policy.originals_percent };
}
