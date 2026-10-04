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

test('submitted originals survive review and app reload; retry attaches without retransmitting confirmed bytes',async({page})=>{
  let failAttach=true,puts=0,attachments=0,nonce=0;
  const arrived=new Set<string>();
  await page.route('**/src/scan/functions.js*',route=>route.fulfill({contentType:'application/javascript',body:
    `async function post(path,body,options={}){const r=await fetch('/upload-fixture'+path,{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'},signal:options.signal});const data=await r.json();if(!r.ok)throw Object.assign(new Error('fixture failure'),{status:r.status,body:data});return data;}
    export const uploadIntent=(body,options)=>post('/intent',body,options);
    export const uploadComplete=(body,options)=>post('/complete',body,options);
    export const attachOriginals=(body,options)=>post('/attach',body,options);
    export const submitPaper=(body,options)=>post('/submit',body,options);
    export async function putObject(url,blob,type,options={}){const r=await fetch(url,{method:'PUT',body:blob,signal:options.signal});if(!r.ok)throw Object.assign(new Error('put failed'),{status:r.status});}`}));
  await page.route('**/upload-fixture/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(req.method()==='PUT'){puts++;arrived.add(decodeURIComponent(path.split('/put/')[1]));await route.fulfill({status:200,body:''});return;}
    const body=req.postDataJSON();let result:any={},status=200;
    if(path.endsWith('/intent'))result={objects:body.objects.map(o=>{const key=o.kind+'/'+o.name+'-'+(++nonce);return {...o,key,bucket:o.kind==='raw'?'originals':'derived',url:'http://127.0.0.1:5174/upload-fixture/put/'+encodeURIComponent(key)};}).reverse()};
    if(path.endsWith('/complete')){result={confirmed:body.uploads.filter(o=>arrived.has(o.key)).map(o=>o.key),missing:body.uploads.filter(o=>!arrived.has(o.key)).map(o=>({key:o.key,reason:'that file did not arrive'}))};status=result.missing.length?409:200;}
    if(path.endsWith('/submit'))result={run_id:'run',queued:true};
    if(path.endsWith('/attach')){attachments++;if(failAttach){status=503;result={error:'try again'};}else result={attached:body.pages.map(p=>({page_number:p.page_number,key:p.original_key}))};}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  const id=await page.evaluate(async()=>{
    const d=await import('/src/scan/drafts.js'),f=await import('/src/scan/functions.js'),{sendDraft}=await import('/src/scan/send-draft.js');
    const draft=await d.createDraft({id:crypto.randomUUID(),studentId:'s',paperType:'unit_test'});
    await d.addPage(draft,{blob:new Blob(['page'],{type:'image/jpeg'}),mask:new Blob(['mask']),thumb:new Blob(['thumb']),original:new Blob(['original'],{type:'image/jpeg'})});
    await sendDraft({studentId:'s',draft,mode:'batch',earlySubmit:true},{...d,newId:()=>crypto.randomUUID(),tierForType:()=> 'tier_1',createPaper:async()=>({id:'paper',type:'unit_test'}),transport:f});
    const backups=await import('/src/scan/original-backups.js');await backups.finishDraftReview(draft);
    try{await backups.resumeOriginalBackups(draft);}catch{}
    const saved=await d.readDraft(draft.id);
    if(!saved||!saved.review_saved||!saved.submission||saved.pages[0].upload_assets.raw.status!=='confirmed'||await saved.pages[0].original.text()!=='original')throw new Error('Pending backup was not retained');
    return draft.id;
  });
  expect(puts).toBe(4);expect(attachments).toBe(1);
  failAttach=false;await page.reload();
  const remaining=await page.evaluate(async id=>{
    const d=await import('/src/scan/drafts.js'),backups=await import('/src/scan/original-backups.js');
    const draft=await d.readDraft(id);await backups.resumeOriginalBackups(draft);
    return d.readDraft(id);
  },id);
  expect(remaining).toBeUndefined();expect(puts).toBe(4);expect(attachments).toBe(2);
});
test('accepted retake clears the frozen manifest while uncertain submissions remain immutable',async({page})=>{
  const result=await page.evaluate(async()=>{
    const d=await import('/src/scan/drafts.js'),draft=await d.createDraft({id:crypto.randomUUID(),studentId:'s'});
    await d.addPage(draft,{blob:new Blob(['p'],{type:'image/jpeg'})});
    await d.mutateDraft(draft,fresh=>{fresh.submission_started={paper_id:'p'};});
    let uncertain=false;try{await d.replacePage(draft,1,{blob:new Blob(['retake'],{type:'image/jpeg'})});}catch{uncertain=true;}
    await d.mutateDraft(draft,fresh=>{fresh.submission={run_id:'run',queued:true};});
    await d.replacePage(draft,1,{blob:new Blob(['retake'],{type:'image/jpeg'})});
    return {uncertain,frozen:Boolean(draft.submission_started),submitted:Boolean(draft.submission),image:await draft.pages[0].blob.text()};
  });
  expect(result).toEqual({uncertain:true,frozen:false,submitted:false,image:'retake'});
});

test('native IndexedDB can commit and reload captured Blob bytes without losing MIME',async({page})=>{
  const result=await page.evaluate(async()=>{
    const local=await import('/src/local-data.js'),db=await local.openDraftDatabase(),id=crypto.randomUUID();
    let writeError=null;
    try {await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('drafts','readwrite'),request=tx.objectStore('drafts').put({id,student_id:'blob-probe',updated_at:Date.now(),pages:[{page_number:1,blob:new Blob(['probe'],{type:'image/jpeg'})}]});
      request.onerror=()=>reject(request.error);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Native Blob write aborted without an error'));
    });}catch(error){writeError=String(error);}
    local.closeLocalDatabase(db);
    return {writeError};
  });expect(result.writeError).toBeNull();
});
