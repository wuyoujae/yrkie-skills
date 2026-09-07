import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {YrkieClient} from '../dist/client.js';
import {readApprovedImage} from '../dist/localImage.js';

const id='a1b2c3d4-1234-4123-8123-0123456789ab',ref='prj_'+'a'.repeat(64),cnf='cnf_'+'b'.repeat(64);
const credentials={read:async()=>'yrk_plugin_'+'c'.repeat(64),write:async()=>{},remove:async()=>{},check:async()=>{}};
const asset='yrkie-asset-data://'+'d'.repeat(64);
const root=new URL('../../test/20260907-plugin-images-confirm/node/',import.meta.url);
const file=fileURLToPath(new URL('approved.png',root));
// Client checks the transport signature; authoritative full decoding is server-side.
await mkdir(root,{recursive:true});await writeFile(file,Buffer.from([137,80,78,71,13,10,26,10,0]));
const receipt={requestId:id,slideReference:asset,imageType:'content',ratio:'4:3',width:3,height:2,hasTransparency:true,contentType:'image/png',sizeBytes:80,expiresAt:'2026-09-08T00:00:00Z',replayed:false};
const preview={confirmationRef:cnf,expiresAt:'2026-09-07T23:00:00Z',action:'confirm',outlineVersion:1,revision:1,totalPages:12,eligiblePages:10,excludedPageRanges:[{from:11,to:12}],excludedImagePlans:0,imagePlan:[],assets:[],canConfirm:true,blockers:[],billingDisclosure:{paidGeneration:false,mode:'actual_attempt_cost',failedAttemptsMayCharge:false,estimateIsFixedPrice:false,message:'Locks this outline.'}};
const confirmed={requestId:id,outlineVersion:1,sourceRevision:1,currentRevision:2,status:'confirmed',eligiblePages:10,paidGeneration:false,imageStatus:'not_required',ready:true,replayed:false};

test('upload sends exactly metadata and local file bytes without leaking path or provider fields',async()=>{
  let sent;const client=new YrkieClient('https://yrkie.com',credentials,async(url,options)=>{sent={url,options};return Response.json({...receipt,storagePath:'private',providerKey:'secret'});});
  const result=await client.uploadImage(ref,id,file,'content','4:3');
  assert.equal(sent.url,`https://yrkie.com/api/plugin/v1/projects/${ref}/images`);assert.ok(sent.options.body instanceof FormData);
  assert.deepEqual([...sent.options.body.keys()],['metadata','image']);assert.deepEqual(JSON.parse(sent.options.body.get('metadata')),{requestId:id,imageType:'content',ratio:'4:3'});
  assert.equal(sent.options.body.get('image').name,'approved.png');assert.equal(sent.options.headers['Content-Type'],undefined);
  assert.deepEqual(result,receipt);assert.ok(!JSON.stringify(result).includes(file));
});
test('file access rejects relative paths, remote paths, missing files, directories and oversized files',async()=>{
  for(const path of ['relative.png','https://example.com/a.png','\\\\host\\share\\a.png',file+'-missing',fileURLToPath(root)])await assert.rejects(readApprovedImage(path));
  const large=fileURLToPath(new URL('large.png',root));await writeFile(large,Buffer.alloc(20*1024*1024+1));await assert.rejects(readApprovedImage(large),{code:'image_file_too_large'});
});
test('upload failures retain bounded field diagnostics and never retry the side effect',async()=>{
  let calls=0;const client=new YrkieClient('https://yrkie.com',credentials,async()=>{calls++;return Response.json({error:'validation_failed',message:'Fix image.',issues:[{path:'/image',code:'image_transparency_required',message:'Opaque content.',hint:'Remove background before upload.',raw:'secret'}],truncated:false,storagePath:'private'},{status:422});});
  await assert.rejects(client.uploadImage(ref,id,file,'content','4:3'),e=>{assert.equal(e.details.issues[0].code,'image_transparency_required');assert.ok(!JSON.stringify(e.details).includes('secret'));return true;});assert.equal(calls,1);
});
test('confirmation preview is tied to the requested version and confirmation requires explicit lock acknowledgement',async()=>{
  let calls=0;const client=new YrkieClient('https://yrkie.com',credentials,async(url,options)=>{calls++;return Response.json(url.endsWith('prepare-confirmation')?{...preview,privateId:'secret'}:confirmed);});
  assert.deepEqual(await client.prepareOutline(ref,{version:1,revision:1}),preview);
  await assert.rejects(client.prepareOutline(ref,{version:2,revision:1}),{code:'invalid_response'});
  await assert.rejects(client.confirmOutline(ref,id,cnf,false,false));assert.equal(calls,2);
  assert.deepEqual(await client.confirmOutline(ref,id,cnf,true,false),confirmed);
});
test('paid retry sends a separate operation and never silently retries a lost response',async()=>{
  let calls=0;const client=new YrkieClient('https://yrkie.com',credentials,async(url,options)=>{calls++;assert.ok(url.endsWith('/retry-images'));assert.deepEqual(JSON.parse(options.body),{requestId:id,confirmationRef:cnf,acknowledgePaidGeneration:true});throw Error('private network dump');});
  await assert.rejects(client.confirmOutline(ref,id,cnf,false,true,true),{code:'network_error'});assert.equal(calls,1);
});
test('status retains actual charged credits and refuses ready before settlement or wrong outline',async()=>{
  let result={outlineVersion:1,revision:2,confirmed:true,eligiblePages:10,status:'failed',errorCode:'worker_interrupted',ready:false,total:2,completed:1,failed:1,items:[],assets:[],creditsCharged:17,settlementComplete:true};
  const client=new YrkieClient('https://yrkie.com',credentials,async()=>Response.json(result));
  assert.equal((await client.outlineImages(ref,1)).creditsCharged,17);assert.equal((await client.outlineImages(ref,1)).errorCode,'worker_interrupted');
  await assert.rejects(client.outlineImages(ref,2),{code:'invalid_response'});result={...result,status:'succeeded',ready:true,settlementComplete:false};await assert.rejects(client.outlineImages(ref,1),{code:'invalid_response'});
});
