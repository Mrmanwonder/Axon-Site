// Controlled reference transport, not measurements of production R2 or phones.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { sendDraft } from '../src/scan/send-draft.js';
import { uploadDraftAssets } from '../src/scan/upload-runner.js';
import { applyAssetUpdates } from '../src/scan/upload-state.js';
import { buildUploadPlan } from '../src/scan/upload-plan.js';
import { uploadTiming } from '../src/scan/upload-telemetry.js';
import { CAPTURE } from '../src/scan/contract.js';
const legacyUploadSource=await fs.readFile(new URL('./fixtures/axo-188-baseline-upload.js',import.meta.url),'utf8');
const legacyIngestSource=await fs.readFile(new URL('./fixtures/axo-188-baseline-ingest.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const legacyUpload=new AsyncFunction('requireOnline','CAPTURE','uploadIntent','putObject','uploadComplete','args',
  legacyUploadSource.replace('export async function','async function')+';return uploadScannedPage(args);');
const legacySend=new AsyncFunction('uploadTiming','pendingPages','createPaper','saveDraft','uploadScannedPage','markUploaded','submitPaper','tierForType','CAPTURE','waitForReview','sb','args',
  legacyIngestSource.replace('export async function','async function')+';return ingest(args);');
function virtualNetwork({rtt,bandwidth},seed) {
  let clock=0,pumping=false;
  const waits=[],flows=[];
  const advance=()=>{
    pumping=false;
    const transferAt=flows.length?clock+Math.min(...flows.map(f=>f.bytes))*flows.length/bandwidth*1000:Infinity;
    const due=Math.min(transferAt,...waits.map(w=>w.due));
    if(!Number.isFinite(due))return;
    const elapsed=due-clock,share=flows.length?bandwidth/flows.length*elapsed/1000:0;
    for(const f of flows)f.bytes-=share;
    clock=due;
    for(let i=flows.length-1;i>=0;i--)if(flows[i].bytes<0.001){const [f]=flows.splice(i,1);f.resolve();}
    for(let i=waits.length-1;i>=0;i--)if(waits[i].due<=clock+0.001){const [w]=waits.splice(i,1);w.resolve();}
    pump();
  };
  const pump=()=>{if(!pumping&&(waits.length||flows.length)){pumping=true;setImmediate(advance);}};
  let calls=0;
  const wait=ms=>new Promise(resolve=>{waits.push({due:clock+ms,resolve});pump();});
  const latency=()=>rtt*(0.8+((seed*17+(++calls)*13)%41)/100);
  return {get clock(){return clock;},wait,api:()=>wait(latency()),
    async transfer(bytes){await wait(latency());await new Promise(resolve=>{flows.push({bytes,resolve});pump();});}};
}
const referenceBlobs=new Map();
function booklet(count,mixed) {
  const blob=(size,type='image/jpeg')=>{const key=size+type;if(!referenceBlobs.has(key))referenceBlobs.set(key,new Blob([new Uint8Array(size)],{type}));return referenceBlobs.get(key);};
  return {id:'reference-draft',student_id:'student',paper_type:'unit_test',paper_id:null,pages:Array.from({length:count},(_,i)=>({
    page_number:i+1,upload_revision:'capture-'+(i+1),blob:blob(250000),
    mask:!mixed||i%2===0?blob(80000,'image/png'):null,
    thumb:!mixed||i%3===0?blob(20000):null,
    original:!mixed||i%4===0?blob(2200000):null,
    upload_assets:{},width:1200,height:1600,
  }))};
}
async function sample(network,count,mixed,mode,concurrency,seed) {
  const draft=booklet(count,mixed),link=virtualNetwork(network,seed),arrived=new Set(),issued=new Map();
  let nonce=0,intents=0,confirmations=0,puts=0,transferred=0,fail=network.loss&&seed%5===0;
  const local=()=>link.wait(4);
  const transport={
    async uploadIntent(body){intents++;await link.api();return {objects:body.objects.map(o=>{
      const key=o.kind+'/'+o.name+'-'+(++nonce),cap={...o,key,bucket:o.kind==='raw'?'originals':'derived',url:'https://reference.test/'+key};
      issued.set(cap.url,cap);return cap;}).reverse()};},
    async putObject(url,blob){puts++;const cap=issued.get(url);transferred+=blob.size;
      await link.transfer(blob.size);
      if(fail&&cap.kind==='mask'){fail=false;throw new Error('controlled connection loss');}
      arrived.add(cap.key);
    },
    async uploadComplete(body){confirmations++;await link.api();
      const confirmed=body.uploads.filter(o=>arrived.has(o.key)).map(o=>o.key),
        missing=body.uploads.filter(o=>!arrived.has(o.key)).map(o=>({key:o.key,reason:'that file did not arrive'}));
      if(missing.length)throw Object.assign(new Error('missing'),{status:409,body:{confirmed,missing}});
      return {confirmed,missing};},
    async submitPaper(){await link.api();return {run_id:'run',queued:true};},
  };
  const create=async()=>{await link.api();return {id:'paper',type:'unit_test'};};
  const services={
    newId:()=> 'owner',createPaper:create,tierForType:()=> 'tier_1',assertLease(){},
    async mutateDraft(d,fn){await local();return fn(d);},
    claimSendLease:local,touchSendLease:local,releaseSendLease:local,
    async updateAssets(d,updates){await local();return applyAssetUpdates(d,updates);},transport,
  };
  const originalBytes=buildUploadPlan(draft).filter(o=>o.kind==='raw').reduce((n,o)=>n+o.bytes,0);
  const totalBytes=buildUploadPlan(draft).reduce((n,o)=>n+o.bytes,0);
  const early=mode==='early';
  let retries=0;
  for(;;){try{
    if(mode==='baseline'){
      await legacySend(options=>uploadTiming({...options,now:()=>link.clock}),d=>d.pages.filter(p=>!p.uploaded),
        create,local,args=>legacyUpload(()=>{},CAPTURE,transport.uploadIntent,transport.putObject,transport.uploadComplete,args),
        async(d,n,keys)=>{await local();Object.assign(d.pages.find(p=>p.page_number===n),keys,{uploaded:true});},
        transport.submitPaper,()=> 'tier_1',CAPTURE,async()=>({processing:true,status:'queued'}),{},
        {studentId:'student',draft,sendStartedAt:0,paperType:'unit_test'});
    }else await sendDraft({studentId:'student',draft,mode:'batch',earlySubmit:early,concurrency,dateTaken:'2026-10-04'},services);
    break;
  }catch(error){if(++retries>2)throw error;}}
  const sendMs=link.clock;
  const submitIntents=intents,submitPuts=puts,submitBytes=transferred;
  if(early){assert.ok(draft.pages.every(p=>p.original||!p.original_requires_attachment));
    await uploadDraftAssets({draft,studentId:'student',paperId:'paper',mode:'batch',concurrency:3,transport,
      persist:services.updateAssets,guard:local});
    await link.api(); // independent, verified attachment receipt
  }
  return {send_ms:sendMs,backup_ms:link.clock,intents:submitIntents,confirmations,puts:submitPuts,
    transferred_bytes:submitBytes,retries,bandwidth_floor_ms:(early?totalBytes-originalBytes:totalBytes)/network.bandwidth*1000};
}
const networks=[
  {name:'wifi',rtt:60,bandwidth:4*1024*1024},
  {name:'high_latency_wifi',rtt:250,bandwidth:4*1024*1024},
  {name:'4g',rtt:180,bandwidth:768*1024},
  {name:'slow_uplink',rtt:350,bandwidth:160*1024},
  {name:'lossy_4g',rtt:180,bandwidth:768*1024,loss:true},
];
const output={kind:'simulated_reference_transport',samples:21,baseline_commit:'15f53f1dad95d826432415c1990ab46b68da428c',
  assumptions:'Actual archived ingest/upload and new sendDraft/uploadDraftAssets implementations. Virtual shared bandwidth, RTT jitter, 4ms persistence, one mask loss in 1/5 lossy samples. No real device, TCP, R2, Supabase or production SLO measurement.',rows:[]};
const quantile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(p*values.length)-1];
for(const network of networks)for(const [count,mixed] of [[1,false],[5,false],[10,false],[25,false],[10,true]]){
  for(const [mode,concurrency] of [['baseline',1],['batch',2],['batch',3],['batch',4],['batch',6],['early',3]]){
    const samples=[];
    for(let seed=1;seed<=21;seed++)samples.push(await sample(network,count,mixed,mode,concurrency,seed));
    output.rows.push({network:network.name,pages:count,mixed,mode,concurrency,
      p50_ms:Math.round(quantile(samples.map(s=>s.send_ms),0.5)),p95_ms:Math.round(quantile(samples.map(s=>s.send_ms),0.95)),
      p95_backup_ms:Math.round(quantile(samples.map(s=>s.backup_ms),0.95)),
      intents:samples[0].intents,puts:samples[0].puts,
      bandwidth_floor_ms:Math.round(samples[0].bandwidth_floor_ms),
      retry_samples:samples.filter(s=>s.retries>0).length});
  }
}
await fs.mkdir('bench/results',{recursive:true});
await fs.writeFile('bench/results/axo-188-reference.json',JSON.stringify(output,null,2)+'\n');
console.log('AXO188_REFERENCE='+JSON.stringify(output));
