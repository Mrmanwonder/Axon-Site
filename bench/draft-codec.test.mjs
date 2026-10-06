import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeCapturedPage,decodeDraft,mergeStoredDraft} from '../src/scan/draft-codec.js';

test('binary persistence keeps image bytes out of the mutable draft row',async()=>{
  const bytes=new Uint8Array([0,1,127,128,255]);
  const page={page_number:1,upload_revision:'rev-1',blob:new Blob([bytes],{type:'image/jpeg'}),mask:new Blob([bytes],{type:'image/png'}),
    thumb:new Blob(['thumb'],{type:'image/jpeg'}),original:new Blob([bytes],{type:'image/heic'}),proxy:new Blob(['proxy'],{type:'image/webp'}),meta:{geometry_confirmed:true}};
  const encoded=await encodeCapturedPage(page,{draftId:'draft-1',studentId:'student-1',revision:'rev-1',pageNumber:1});
  assert.ok(page.original instanceof Blob);
  assert.equal(encoded.assets.length,5);
  for(const field of ['blob','mask','thumb','original','proxy']){
    assert.equal(encoded.page[field].axon_asset,1);
    assert.equal('data' in encoded.page[field],false);
    const asset=encoded.assets.find(item=>item.field===field);
    assert.ok(asset?.data instanceof ArrayBuffer);
    assert.equal(asset.type,page[field].type);
  }
  assert.equal(encoded.page.original.size,bytes.length);
  assert.equal(encoded.page.original.type,'image/heic');

  const restored=decodeDraft(structuredClone({pages:[encoded.page]}),structuredClone(encoded.assets),{strict:true}).pages[0];
  for(const field of ['blob','mask','thumb','original','proxy']){
    assert.ok(restored[field] instanceof Blob);assert.equal(restored[field].type,page[field].type);
    assert.deepEqual(new Uint8Array(await restored[field].arrayBuffer()),new Uint8Array(await page[field].arrayBuffer()));
  }
});

test('metadata merges preserve already-hydrated bytes without another asset read',async()=>{
  const original=new Blob(['large original'],{type:'image/jpeg'});
  const target={id:'d',pages:[{page_number:1,upload_revision:'r',blob:new Blob(['page']),original,upload_assets:{}}]};
  const stored={id:'d',pages:[{page_number:1,upload_revision:'r',blob:{axon_asset:1,key:'d:r:blob'},original:{axon_asset:1,key:'d:r:original'},upload_assets:{page:{status:'confirmed'}}}]};
  mergeStoredDraft(target,stored);
  assert.ok(target.pages[0].blob instanceof Blob);
  assert.equal(target.pages[0].original,original);
  assert.equal(target.pages[0].upload_assets.page.status,'confirmed');
});

test('old Blob drafts, old ArrayBuffer drafts and absent optional assets remain compatible',async()=>{
  const original=new Blob(['old'],{type:'image/jpeg'}),draft={pages:[{blob:original,original:null}]};
  assert.equal(decodeDraft(draft).pages[0].blob,original);assert.equal(draft.pages[0].original,null);
  const old={pages:[{blob:{axon_binary:1,type:'image/jpeg',size:3,data:new Uint8Array([1,2,3]).buffer}}]};
  const decoded=decodeDraft(old).pages[0].blob;
  assert.ok(decoded instanceof Blob);assert.deepEqual([...new Uint8Array(await decoded.arrayBuffer())],[1,2,3]);
  assert.equal(decodeDraft(undefined),undefined);
});
