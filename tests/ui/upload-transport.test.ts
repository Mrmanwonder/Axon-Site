import { beforeEach, afterEach, test, expect, vi } from 'vitest';
const f=vi.hoisted(()=>({session:vi.fn(),refresh:vi.fn()}));
vi.mock('../../src/supabase.js',()=>({currentSession:f.session,sb:{auth:{refreshSession:f.refresh}}}));
vi.mock('../../src/config.js',()=>({MASTERY_API_URL:'https://api.test'}));
import { uploadComplete, putObject } from '../../src/scan/functions.js';
beforeEach(()=>{
  vi.clearAllMocks();f.session.mockResolvedValue({access_token:'expired',user:{id:'owner'}});
  f.refresh.mockResolvedValue({data:{session:{access_token:'fresh',user:{id:'owner'}}},error:null});
});
afterEach(()=>vi.unstubAllGlobals());
test('401 refreshes once and retries confirmation only with fresh JWT and exact body',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('{}',{status:401})).mockResolvedValueOnce(new Response('{"confirmed":["key"],"missing":[]}'));
  vi.stubGlobal('fetch',fetcher);const retry=vi.fn();
  await expect(uploadComplete({paper_id:'p',uploads:[{key:'key',bucket:'derived'}]},{onRetry:retry})).resolves.toEqual({confirmed:['key'],missing:[]});
  expect(f.refresh).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(2);expect(retry).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  expect(fetcher.mock.calls[1][1].body).toBe(fetcher.mock.calls[0][1].body);
  expect(fetcher.mock.calls.every(c=>c[1].method==='POST')).toBe(true);
});
test('concurrent 401s share a refresh and never retry after switching account',async()=>{
  let resolve;const pending=new Promise(done=>{resolve=done;});f.refresh.mockReturnValue(pending);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:401})));
  const a=uploadComplete({paper_id:'p',uploads:[]}),b=uploadComplete({paper_id:'p',uploads:[]});
  const results=Promise.allSettled([a,b]);await vi.waitFor(()=>expect(f.refresh).toHaveBeenCalledTimes(1));
  resolve({data:{session:{access_token:'other',user:{id:'different'}}}});
  expect((await results).every(r=>r.status==='rejected')).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('a second 401 or failed refresh stops visibly without repeating PUTs',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response('{}',{status:401})));
  await expect(uploadComplete({paper_id:'p',uploads:[]})).rejects.toMatchObject({status:401});
  expect(f.refresh).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledTimes(2);
});
test('network-level PUT failure is uncertain and has no automatic byte retransmission',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('network')));
  await expect(putObject('https://r2.test/key',new Blob(['p']),'image/jpeg')).rejects.toThrow(/interrupted/);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('caller cancellation aborts active fetch and prevents refresh/retry',async()=>{
  const controller=new AbortController();
  vi.stubGlobal('fetch',vi.fn((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason)))));
  const pending=uploadComplete({paper_id:'p',uploads:[]},{signal:controller.signal});
  const assertion=expect(pending).rejects.toBeDefined();await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
  controller.abort();await assertion;expect(fetch).toHaveBeenCalledTimes(1);expect(f.refresh).not.toHaveBeenCalled();
});
