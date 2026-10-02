import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

function sqlSuiteBlock() {
  const start = workflow.indexOf('- name: Run SQL test suites');
  assert.notEqual(start, -1, 'SQL suite workflow step must exist');
  const end = workflow.indexOf('\n  # Merging a migration now applies it', start);
  assert.notEqual(end, -1, 'SQL suite workflow step must remain bounded before migration notice');
  return workflow.slice(start, end);
}

test('Supabase SQL CI executes each suite once and parses the captured output', () => {
  const block = sqlSuiteBlock();

  const psqlInvocations = block.match(/psql "\$DB_URL"/g) ?? [];
  assert.equal(psqlInvocations.length, 1, 'the SQL loop must have exactly one psql invocation per suite');

  assert.match(block, /\| tee "\$log"/, 'single execution must remain streamed and captured');
  assert.match(
    block,
    /counts="\$\(grep -E .* "\$log"/,
    'assertion counts must be parsed from the captured single execution',
  );
  assert.doesNotMatch(block, /counts="\$\(psql /, 'assertion parsing must never re-run the SQL suite');
  assert.match(block, /ON_ERROR_STOP=1/, 'SQL errors must remain fail-fast inside each suite');
  assert.match(block, /::error file=\$f::SQL execution failed/, 'SQL execution failures must name the file');
  assert.match(block, /unparseable/, 'missing assertion summaries must remain a hard error');
});
