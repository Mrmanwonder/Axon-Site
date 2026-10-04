import { test, expect } from '@playwright/test';
test.beforeEach(async ({page})=> { await page.goto('/tests/browser/index.html'); });
test('fresh-row asset writes from separate handles preserve independent confirmations and bytes', async ({page})=>{
  const result=await page.evaluate(async()=>{
    const d=await import('/src/scan/drafts.js');
    const draft=await d.createDraft({id:crypto.randomUUID(),studentId:'s'});
    await d.addPage(draft,{blob:new Blob(['page'],{type:'image/jpeg'}),mask:new Blob(['mask']),original:new Blob(['original'],{type:'image/jpeg'})});
    const a=await d.readDraft(draft.id),b=await d.readDraft(draft.id),revision=a.pages[0].upload_revision;
    const update=(kind,key,bucket)=>[{descriptor:{id:revision+':'+kind,revision,page_number:1,kind,bytes:4},state:{status:'confirmed',key,bucket}}];
    await Promise.all([d.updateAssets(a,update('page','page-key','derived')),d.updateAssets(b,update('mask','mask-key','derived'))]);
    // A stale metadata save must neither erase completions nor replace blobs.
    a.pages[0].quality={verdict:'pass'}; await d.saveDraft(a);
    const saved=await d.readDraft(draft.id);
    return {page:saved.pages[0].r2_key,mask:saved.pages[0].mask_key,original:await saved.pages[0].original.text(),blob:await saved.pages[0].blob.text(),quality:saved.pages[0].quality.verdict};
  });
  expect(result).toEqual({page:'page-key',mask:'mask-key',original:'original',blob:'page',quality:'pass'});
});
test('retake rejects an old completion and stale metadata save while keeping unrelated success',async({page})=>{
  const result=await page.evaluate(async()=>{
    const d=await import('/src/scan/drafts.js');
    const draft=await d.createDraft({id:crypto.randomUUID(),studentId:'s'});
    for(let i=0;i<2;i++)await d.addPage(draft,{blob:new Blob(['old'],{type:'image/jpeg'}),original:new Blob(['raw'])});
    const stale=await d.readDraft(draft.id),rev=stale.pages[0].upload_revision,other=stale.pages[1].upload_revision;
    await d.replacePage(draft,1,{blob:new Blob(['new'],{type:'image/jpeg'}),original:new Blob(['new-raw'])});
    const result=await d.updateAssets(stale,[{descriptor:{id:rev+':page',revision:rev,page_number:1,kind:'page',bytes:3},state:{status:'confirmed',key:'obsolete',bucket:'derived'}},
      {descriptor:{id:other+':page',revision:other,page_number:2,kind:'page',bytes:3},state:{status:'confirmed',key:'current',bucket:'derived'}}]);
    // A handle acquired before the retake cannot replace the new topology.
    const before=await d.readDraft(draft.id); const old=await d.readDraft(draft.id);
    await d.movePage(before,1,2); let rejected=false; try{await d.saveDraft(old);}catch{rejected=true;}
    const saved=await d.readDraft(draft.id);
    return {stale:result.stale.length,accepted:result.accepted.length,rejected,originals:await Promise.all(saved.pages.map(p=>p.original.text())),keys:saved.pages.map(p=>p.r2_key??null)};
  });
  expect(result).toEqual({stale:1,accepted:1,rejected:true,originals:['raw','new-raw'],keys:[null,null]});
});
test('cross-tab lease blocks a second sender and survives browser reload with uncertain keys',async({page,context})=>{
  const id=await page.evaluate(async()=>{
    const d=await import('/src/scan/drafts.js'),draft=await d.createDraft({id:crypto.randomUUID(),studentId:'s'});
    await d.addPage(draft,{blob:new Blob(['p'],{type:'image/jpeg'}),original:new Blob(['raw'])});await d.claimSendLease(draft,'first');
    const revision=draft.pages[0].upload_revision;
    await d.updateAssets(draft,[{descriptor:{id:revision+':raw',revision,page_number:1,kind:'raw',bytes:3},state:{status:'uploading',key:'issued-key',bucket:'originals'}}],'first');
    return draft.id;
  });
  const sibling=await context.newPage();await sibling.goto('/tests/browser/index.html');
  expect(await sibling.evaluate(async id=>{
    const d=await import('/src/scan/drafts.js'),draft=await d.readDraft(id);
    try{await d.claimSendLease(draft,'second');return false;}catch{return true;}
  },id)).toBe(true);
  await page.reload();
  expect(await page.evaluate(async id=>{const d=await import('/src/scan/drafts.js'),draft=await d.readDraft(id);return {key:draft.pages[0].upload_assets.raw.key,bytes:await draft.pages[0].original.text()};},id)).toEqual({key:'issued-key',bytes:'raw'});
  await sibling.close();
});
test('erasure and explicit deletion reject late upload persistence without recreating a draft',async({page})=>{
  const result=await page.evaluate(async()=>{
    const d=await import('/src/scan/drafts.js'),local=await import('/src/local-data.js');
    const draft=await d.createDraft({id:crypto.randomUUID(),studentId:'s'});await d.addPage(draft,{blob:new Blob(['p'],{type:'image/jpeg'})});
    await d.deleteDraft(draft.id);let deleted=false;try{await d.claimSendLease(draft,'sender');}catch{deleted=true;}
    const fresh=await d.createDraft({id:crypto.randomUUID(),studentId:'s'});await d.addPage(fresh,{blob:new Blob(['p'],{type:'image/jpeg'})});
    await local.LocalDataService.clearStudent('s');let erased=false;try{await d.updateAssets(fresh,[]);}catch{erased=true;}
    return {deleted,erased,count:(await d.listDrafts('s')).length};
  });expect(result).toEqual({deleted:true,erased:true,count:0});
});
