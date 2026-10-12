// Creates disposable guardian credentials only on the CLI's loopback stack.
// Refuses every remote host before reading a key into a request.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const origin = new URL(status.API_URL);
assert.equal(origin.protocol, 'http:');
assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Local auth tests require loopback');
assert.equal(origin.port, '54321');
const anon = status.ANON_KEY, admin = status.SERVICE_ROLE_KEY;
assert.ok(anon && admin, 'Local stack auth keys are required');
const nonce = crypto.randomUUID().slice(0, 8);
const email = 'axo160-' + nonce + '@example.test';
const password = 'Local-only-guardian-' + nonce;
const nextPassword = password + '-changed';
let userId, token;
async function api(path, { method = 'POST', body, key = anon, bearer = key, headers = {} } = {}) {
  const response = await fetch(new URL(path, origin), {
    method, headers: { apikey: key, Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'manual',
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}
try {
  const signup = await api('/auth/v1/signup', { body: { email, password } });
  assert.ok(signup.ok, 'Local password signup must succeed');
  userId = signup.data.user?.id ?? signup.data.id;
  assert.ok(userId);
  // The project's local CLI defaults may require confirmation. Confirm only
  // this disposable loopback account; production settings remain untouched.
  const confirmation = await api('/auth/v1/admin/users/' + userId, { method: 'PUT', key: admin, body: { email_confirm: true } });
  assert.ok(confirmation.ok);
  const login = await api('/auth/v1/token?grant_type=password', { body: { email, password } });
  assert.ok(login.ok); assert.equal(login.data.user.id, userId);
  token = login.data.access_token;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.ok(claims.amr.some(item => item.method === 'password' && Number.isFinite(item.timestamp)), 'Password proof must carry server AMR');
  const guardianBody = { auth_user_id: userId, name: 'Local auth fixture', contact: email };
  const saveGuardian = () => api('/rest/v1/guardian?on_conflict=auth_user_id&select=id,auth_user_id', {
    key: anon, bearer: token, body: guardianBody, headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  });
  const first = await saveGuardian(), second = await saveGuardian();
  assert.ok(first.ok && second.ok, 'Local guardian upserts must succeed');
  assert.equal(first.data.length, 1); assert.equal(second.data.length, 1);
  assert.equal(first.data[0].id, second.data[0].id, 'The same auth principal must retain one guardian');
  const knownReset = await api('/auth/v1/recover', { body: { email } });
  const unknownReset = await api('/auth/v1/recover', { body: { email: 'axo160-absent-' + nonce + '@example.test' } });
  assert.equal(knownReset.status, unknownReset.status); assert.ok(knownReset.ok);
  const recovery = await api('/auth/v1/admin/generate_link', { key: admin, body: { type: 'recovery', email } });
  assert.ok(recovery.ok && recovery.data.hashed_token);
  const verified = await api('/auth/v1/verify', { body: { type: 'recovery', token_hash: recovery.data.hashed_token } });
  assert.ok(verified.ok); assert.equal(verified.data.user.id, userId);
  const changed = await api('/auth/v1/user', { method: 'PUT', bearer: verified.data.access_token, body: { password: nextPassword } });
  assert.ok(changed.ok); assert.equal(changed.data.id, userId);
  const relogin = await api('/auth/v1/token?grant_type=password', { body: { email, password: nextPassword } });
  assert.ok(relogin.ok); assert.equal(relogin.data.user.id, userId);
  token = relogin.data.access_token;
  const stale = await api('/auth/v1/token?grant_type=password', { body: { email, password } });
  assert.equal(stale.status, 400);
  const savedAgain = await saveGuardian();
  assert.ok(savedAgain.ok); assert.equal(savedAgain.data[0].id, first.data[0].id);
  console.log('AXO-160 local GoTrue: signup, password AMR, one guardian, reset, recovery update and changed-password sign-in passed. Google OAuth linking is not simulated or certified.');
} finally {
  if (userId) {
    const removal = await api('/rest/v1/guardian?auth_user_id=eq.' + userId, { method: 'DELETE', key: admin });
    assert.ok(removal.ok, 'Local guardian fixture cleanup must succeed');
    const deleted = await api('/auth/v1/admin/users/' + userId, { method: 'DELETE', key: admin });
    assert.ok(deleted.ok, 'Local auth fixture cleanup must succeed');
  }
}
