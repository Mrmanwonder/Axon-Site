import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupedFetch, readKey } from '../src/lib/request.js';

test('identical concurrent PostgREST GETs share one request', async () => {
  let calls = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return new Response('[1]'); };
  try {
    const url = 'https://x.supabase.co/rest/v1/attempts?select=*';
    const init = { headers: { Authorization: 'Bearer a' } };
    const [a, b] = await Promise.all([dedupedFetch(url, init), dedupedFetch(url, init)]);
    assert.equal(calls, 1);
    assert.equal(await a.text(), '[1]');
    assert.equal(await b.text(), '[1]');
    await dedupedFetch(url, init);
    assert.equal(calls, 2, 'nothing is cached after settling');
  } finally { globalThis.fetch = real; }
});

test('writes, other tokens and abortable requests are never shared', () => {
  const url = 'https://x.supabase.co/rest/v1/attempts';
  assert.equal(readKey(url, { method: 'POST' }), null);
  assert.equal(readKey(url, { signal: new AbortController().signal }), null);
  assert.equal(readKey('https://x.supabase.co/auth/v1/user', {}), null);
  assert.notEqual(readKey(url, { headers: { Authorization: 'a' } }), readKey(url, { headers: { Authorization: 'b' } }));
});
