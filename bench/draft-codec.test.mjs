import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeCapturedPage,decodeDraft} from '../src/scan/draft-codec.js';
test('binary persistence preserves every capture byte and original MIME without Blob storage handles',async()=>{
  const bytes=new Uint8Array([0,1,127,128,255]);
  const page={page_number:1,blob:new Blob([bytes],{type:'image/jpeg'}),mask:new Blob([bytes],{type:'image/png'}),
    thumb:new Blob(['thumb'],{type:'image/jpeg'}),original:new Blob([bytes],{type:'image/heic'}),proxy:new Blob(['proxy'],{type:'image/webp'}),meta:{geometry_confirmed:true}};
  const stored=await encodeCapturedPage(page);
  assert.ok(page.original instanceof Blob);assert.ok(stored.original.data instanceof ArrayBuffer);assert.equal(stored.original.size,bytes.length);
  assert.equal(stored.original.type,'image/heic');
  const restored=decodeDraft(structuredClone({pages:[stored]})).pages[0];
  for(const field of ['blob','mask','thumb','original','proxy']){
    assert.ok(restored[field] instanceof Blob);assert.equal(restored[field].type,page[field].type);
    assert.deepEqual(new Uint8Array(await restored[field].arrayBuffer()),new Uint8Array(await page[field].arrayBuffer()));
  }
});
test('old Blob drafts and absent optional assets remain compatible',()=>{
  const original=new Blob(['old'],{type:'image/jpeg'}),draft={pages:[{blob:original,original:null}]};
  assert.equal(decodeDraft(draft).pages[0].blob,original);assert.equal(draft.pages[0].original,null);
  assert.equal(decodeDraft(undefined),undefined);
});
