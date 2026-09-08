import {test} from 'node:test';
import assert from 'node:assert/strict';
import {YrkieClient} from '../dist/client.js';
const ref='prj_'+'a'.repeat(64), id='12345678-1234-4234-8234-123456789abc';
function setup(replies) {
  const calls=[];
  const credentials={read:async()=>`yrk_plugin_${'b'.repeat(64)}`,write:async()=>{},remove:async()=>{},check:async()=>{}};
  return {calls,client:new YrkieClient('https://yrkie.com',credentials,async(url,options)=>{
    calls.push({url,options});const next=replies.shift();if(next instanceof Error)throw next;
    return new Response(JSON.stringify(next.body??next),{status:next.httpStatus??200});
  })};
}
const receipt=(status='saved',pageNumber=null)=>({requestId:id,projectRef:ref,revision:2,totalSlides:2,pageNumber,status,replayed:false});
test('slide writes transmit exact reviewed content, verbs, fences and acknowledgements',async()=>{
  const s=setup([receipt(),receipt('edited',2),receipt('deleted',1)]);
  const doc={version:4,deck:{slides:[{id:'a'},{id:'b'}]}};
  await s.client.createSlides(ref,id,1,{version:1,revision:3},doc,true);
  assert.deepEqual(JSON.parse(s.calls[0].options.body),{requestId:id,expectedRevision:1,expectedOutline:{version:1,revision:3},deck:doc,acknowledgeReplace:true});
  await s.client.editSlide(ref,id,2,2,{id:'b',blocks:[]});
  await s.client.deleteSlide(ref,id,1,3,true);
  assert.deepEqual(s.calls.map(x=>x.options.method),['POST','PUT','DELETE']);
  assert.ok(s.calls[1].url.endsWith('/slides/2'));assert.ok(s.calls[2].url.endsWith('/slides/1'));
});
test('uncertain retries keep the same UUID and expected revision; errors preserve diagnostics',async()=>{
  const s=setup([new Error('lost'),{...receipt(),replayed:true},{httpStatus:409,body:{error:'slide_revision_conflict',message:'Reread',issues:[],truncated:false}}]);
  const call=()=>s.client.createSlides(ref,id,null,{version:1,revision:1},{version:4},true);
  await assert.rejects(call(),{code:'network_error'});assert.equal((await call()).replayed,true);
  assert.equal(s.calls[0].options.body,s.calls[1].options.body);
  await assert.rejects(call(),e=>e.code==='slide_revision_conflict'&&e.details.message==='Reread');
});
test('invalid approval, references, page positions and request budgets never reach the server',async()=>{
  const s=setup([]);
  for(const action of [()=>s.client.createSlides(ref,id,null,{version:1,revision:1},{},false),()=>s.client.deleteSlide(ref,id,1,1,false),()=>s.client.editSlide(ref,id,0,1,{}),()=>s.client.editSlide('real-id',id,1,1,{}),()=>s.client.editSlide(ref,id,1,1,{text:'x'.repeat(2008193)})])await assert.rejects(action());
  assert.equal(s.calls.length,0);
});
test('editable reads request an explicit schema and fail on a server that silently omits it',async()=>{
  const page={projectRef:ref,title:'Deck',pageNumber:1,totalSlides:2,revision:3,markdown:'# Page',slide:{id:'a',blocks:[]},internal:'hidden'};
  const s=setup([page,{...page,slide:undefined},page]);
  const read=await s.client.projectSlide(ref,1,3,true);assert.equal(read.slide.id,'a');assert.equal(read.internal,undefined);
  assert.ok(s.calls[0].url.endsWith('?expectedRevision=3&includeSchema=true'));
  await assert.rejects(s.client.projectSlide(ref,1,3,true),{code:'invalid_response'});
  assert.equal((await s.client.projectSlide(ref,1)).slide,undefined);
});
test('write receipts cannot misidentify the action, target project or page',async()=>{
  for(const wrong of [{...receipt(),pageNumber:2},{...receipt(),projectRef:'prj_'+'e'.repeat(64)},{...receipt(),status:'deleted'}]) {
    await assert.rejects(setup([wrong]).client.createSlides(ref,id,null,{version:1,revision:1},{},true),{code:'invalid_response'});
  }
});
test('project information distinguishes an absent deck from old server missing state',async()=>{
  const info={projectRef:ref,title:'Deck',projectType:'presentation',slideCount:0,outlinePageCount:2,outlineStatus:'confirmed'};
  const s=setup([{...info,currentDeck:null},info,{...info,currentDeck:{revision:5,status:'active'}}]);
  assert.equal((await s.client.projectInfo(ref)).currentDeck,null);
  assert.equal((await s.client.projectInfo(ref)).currentDeck,undefined);
  assert.equal((await s.client.projectInfo(ref)).currentDeck.revision,5);
});
