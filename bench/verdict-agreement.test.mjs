// Pins the one number bench/verdict-agreement.mjs says actually matters: the
// live gate must never say "Ready" on a shot that scorePage() then fails on
// the captured still. See that file for why a naive symmetric agreement
// score is the wrong thing to pin here — the live gate is deliberately more
// cautious than the final check on glare, by design (contract.js).
//
//   node --test bench/verdict-agreement.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measure } from './verdict-agreement.mjs';

const FIXTURES = [
  { name: 'page-tilted.jpg' },
  { name: 'page-straight.jpg' },
  { name: 'page-angled.jpg' },
  { name: 'page-skew.jpg' },
  { name: 'viewfinder-a.jpg', crop: { left: 0, top: 110, width: 1440, height: 1075 } },
  { name: 'viewfinder-b.jpg', crop: { left: 0, top: 110, width: 1440, height: 1075 } },
];

for (const fixture of FIXTURES) {
  test(`live gate never waves through a shot of ${fixture.name} that the final check fails`, async () => {
    const r = await measure(fixture);
    assert.ok(r.quad, `${fixture.name}: no quad found on the proxy — nothing to compare, check the fixture`);
    assert.ok(!r.falseGo,
      `${fixture.name}: live gate said "${r.live.hint}" (not blocking) but scorePage() gave verdict ${r.final.verdict} on the captured still`);
  });
}
