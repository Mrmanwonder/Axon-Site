import { beforeEach,test,expect,vi } from 'vitest';
const f=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('../../src/scan/functions.js',()=>({uploadPolicy:f.load}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();});
test('default and failed policy loads keep the legacy scheduler available without blocking send',async()=>{
  const policy=await import('../../src/scan/upload-policy.js');
  expect(policy.policyForDraft('draft')).toEqual({mode:'legacy',earlySubmit:false});
  f.load.mockRejectedValue(new Error('offline'));
  await policy.preloadUploadPolicy();expect(policy.policyForDraft('draft')).toEqual({mode:'legacy',earlySubmit:false});
});
test('cohorts are stable and independent batch/original percentages obey rollback',async()=>{
  const policy=await import('../../src/scan/upload-policy.js');
  f.load.mockResolvedValue({batch_percent:100,originals_percent:0});
  await policy.preloadUploadPolicy();
  expect(policy.cohortFor('draft')).toBe(policy.cohortFor('draft'));
  expect(policy.policyForDraft('draft')).toEqual({mode:'batch',earlySubmit:false});
});
test('invalid values fail closed and originals cannot run outside batch rollout',async()=>{
  const policy=await import('../../src/scan/upload-policy.js');
  f.load.mockResolvedValue({batch_percent:0,originals_percent:100});
  await policy.preloadUploadPolicy();expect(policy.policyForDraft('draft')).toEqual({mode:'legacy',earlySubmit:false});
});
