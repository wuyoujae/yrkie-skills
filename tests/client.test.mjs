import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YrkieClient, parseOrigin, PluginError } from '../dist/client.js';

const secret='a'.repeat(64), token='yrk_plugin_'+'b'.repeat(64);
const device={device_code:secret,user_code:'ABCDE-12345',verification_uri:'https://yrkie.com/plugin/authorize',verification_uri_complete:'https://yrkie.com/plugin/authorize#request='+'c'.repeat(64),expires_in:600,interval:5};
function setup(replies=[]) {
  let credential=null,time=0; const calls=[];
  const store={read:async()=>credential,write:async(v)=>{credential=v;},remove:async()=>{credential=null;},check:async()=>{}};
  const fetcher=async(url,options)=>{calls.push({url,options});const next=replies.shift();if(next instanceof Error)throw next;return new Response(JSON.stringify(next?.body??next),{status:typeof next?.status==='number'?next.status:200});};
  const client=new YrkieClient('https://yrkie.com',store,fetcher,()=>time);
  return {client,store,calls,tick:(v)=>{time+=v;},credential:()=>credential};
}
test('rejects insecure and credential-bearing origins',()=>{
  for(const u of ['http://example.com','https://u:p@yrkie.com','https://yrkie.com/other','https://yrkie.com/?x=1','file:///tmp'])assert.throws(()=>parseOrigin(u));
  assert.equal(parseOrigin('http://127.0.0.1:7622'),'http://127.0.0.1:7622');
});
test('returns a complete authorization link without exposing a manual code or device secret',async()=>{
  const url='https://yrkie.com/plugin/authorize#request='+'c'.repeat(64);
  const s=setup([{...device,verification_uri_complete:url}]);
  const start=await s.client.begin();
  assert.equal(start.verificationUrl,url);
  assert.equal(start.userCode,undefined);
  assert.ok(!JSON.stringify(start).includes(secret));
});
test('rejects altered complete authorization URLs',async()=>{
  for(const url of ['https://evil.invalid/plugin/authorize#request='+'c'.repeat(64),'https://yrkie.com/plugin/authorize#request=bad']) {
    await assert.rejects(setup([{...device,verification_uri_complete:url}]).client.begin(),{code:'invalid_response'});
  }
});
test('binding never exposes secrets, honors interval, stores token, and returns real count',async()=>{
  const s=setup([device,{access_token:token,token_type:'Bearer',scope:'projects:count',expires_in:2592000},{count:17,scope:'library',asOf:'2026-09-06T00:00:00Z'}]);
  const start=await s.client.begin();assert.equal(start.userCode,undefined);assert.ok(!JSON.stringify(start).includes(secret));
  await s.client.finish();assert.equal(s.calls.length,1);
  s.tick(5000);const finish=await s.client.finish();assert.equal(finish.status,'bound');assert.ok(!JSON.stringify(finish).includes(token));assert.equal(s.credential(),token);
  assert.equal((await s.client.count()).count,17);assert.equal(s.calls[2].options.headers.Authorization,`Bearer ${token}`);assert.equal(s.calls[2].options.redirect,'error');
});
test('count without a binding makes no request',async()=>{const s=setup();await assert.rejects(s.client.count(),{code:'not_bound'});assert.equal(s.calls.length,0);});
test('sends application metadata when requesting a connection',async()=>{
  const s=setup([device]); await s.client.begin('Codex');
  assert.equal(s.calls[0].options.body.get('agent_name'),'Codex');
  assert.equal(s.calls[0].options.body.get('scope'),'projects:count projects:read outlines:read slides:read');
});
test('zero is a valid response but errors are not zero',async()=>{
  const s=setup([{count:0,scope:'library',asOf:'2026-09-06T00:00:00Z'},{status:503,body:{error:'temporarily_unavailable'}},{count:-1,scope:'library',asOf:'today'}]);await s.store.write(token);
  assert.equal((await s.client.count()).count,0);await assert.rejects(s.client.count(),{code:'temporarily_unavailable'});await assert.rejects(s.client.count(),{code:'invalid_response'});
});
test('pending and slowdown respect backoff; denial ends binding',async()=>{
  const s=setup([device,{status:400,body:{error:'slow_down'}},{status:400,body:{error:'access_denied'}}]);await s.client.begin();s.tick(5000);
  assert.equal((await s.client.finish()).retryAfter,10);await s.client.finish();assert.equal(s.calls.length,2);s.tick(10000);
  await assert.rejects(s.client.finish(),{code:'access_denied'});await assert.rejects(s.client.finish(),{code:'binding_not_started'});
});
test('expired pending grants do not send secrets again',async()=>{const s=setup([device]);await s.client.begin();s.tick(600000);await assert.rejects(s.client.finish(),{code:'expired_token'});assert.equal(s.calls.length,1);});
test('failed revoke keeps credential; successful or already revoked removes it',async()=>{
  const s=setup([new Error('secret internal network data'),{status:401,body:{error:'invalid_token'}}]);await s.store.write(token);
  await assert.rejects(s.client.logout(),{code:'network_error'});assert.equal(s.credential(),token);await s.client.logout();assert.equal(s.credential(),null);
});
test('refuses an unexpected verification host',async()=>{const s=setup([{...device,verification_uri:'https://evil.example/'}]);await assert.rejects(s.client.begin(),{code:'invalid_response'});});
test('storage failure revokes newly issued credential',async()=>{
  const s=setup([device,{access_token:token,token_type:'Bearer',scope:'projects:count',expires_in:10},{status:'revoked'}]);await s.client.begin();s.tick(5000);
  s.store.write=async()=>{throw new PluginError('secure_storage_unavailable');};await assert.rejects(s.client.finish(),{code:'secure_storage_unavailable'});assert.ok(s.calls.at(-1).url.endsWith('/revoke'));
});
test('does not replace an existing account silently',async()=>{const s=setup();await s.store.write(token);await assert.rejects(s.client.begin(),{code:'already_bound'});assert.equal(s.calls.length,0);});
test('untrusted platform error bodies never reach the model',async()=>{const s=setup([{status:500,body:{error:'secret database connection string'}}]);await s.store.write(token);await assert.rejects(s.client.count(),{code:'platform_error'});});
test('concurrent binding completion is rejected before a second exchange',async()=>{
  const s=setup([device,{access_token:token,token_type:'Bearer',scope:'projects:count',expires_in:10}]);await s.client.begin();s.tick(5000);
  const first=s.client.finish();await assert.rejects(s.client.finish(),{code:'operation_in_progress'});await first;assert.equal(s.calls.length,2);
});

test('does not silently downgrade to manual code entry',async()=>{
  await assert.rejects(setup([{...device,verification_uri_complete:undefined}]).client.begin(),{code:'invalid_response'});
});

test('project projections strip unexpected fields and transport only opaque references',async()=>{
  const ref='prj_'+'d'.repeat(64);
  const s=setup([
    {projects:[{projectRef:ref,title:'Growth',expiresAt:'2026-09-06T04:00:00Z',sessionId:'private'}],nextOffset:null,userId:'private'},
    {projectRef:ref,title:'Growth',projectType:'presentation',slideCount:2,outlinePageCount:3,outlineStatus:'draft',projectId:'private'},
    {projectRef:ref,title:'Growth',markdown:'# Growth\n## Page 1\nRevenue',outline_json:{secret:'private'}},
  ]);
  await s.store.write(token);
  const list=await s.client.projects('Growth & A',0);
  assert.equal(list.projects[0].projectRef,ref);
  assert.equal(new URL(s.calls[0].url).searchParams.get('query'),'Growth & A');
  const info=await s.client.projectInfo(ref);
  const outline=await s.client.projectOutline(ref);
  assert.equal(info.slideCount,2);assert.match(outline.markdown,/Revenue/);
  assert.doesNotMatch(JSON.stringify({list,info,outline}),/private|sessionId|outline_json|projectId|userId/);
  assert.ok(s.calls.every(c=>c.options.headers.Authorization===`Bearer ${token}`));
});

test('invalid references and search bounds never make network requests',async()=>{
  const s=setup();await s.store.write(token);
  for(const ref of ['real-session-id','prj_'+'x'.repeat(64),'../account']) await assert.rejects(s.client.projectInfo(ref));
  await assert.rejects(s.client.projects('a'.repeat(121)));
  await assert.rejects(s.client.projects('',-1));assert.equal(s.calls.length,0);
});

test('expired refs and old scopes return actionable sanitized errors',async()=>{
  const s=setup([{status:403,body:{error:'insufficient_scope',detail:'secret'}},{status:400,body:{error:'project_reference_expired_or_unavailable',sessionId:'secret'}}]);await s.store.write(token);
  await assert.rejects(s.client.projects(),{code:'insufficient_scope'});
  await assert.rejects(s.client.projectOutline('prj_'+'d'.repeat(64)),{code:'project_reference_expired_or_unavailable'});
});

test('large Markdown works while oversized responses fail closed',async()=>{
  const ref='prj_'+'d'.repeat(64);
  const s=setup([{projectRef:ref,title:'Demo',markdown:'文'.repeat(15000)},{projectRef:ref,title:'Demo',markdown:'文'.repeat(400000)}]);await s.store.write(token);
  assert.equal((await s.client.projectOutline(ref)).markdown.length,15000);
  await assert.rejects(s.client.projectOutline(ref),{code:'invalid_response'});
});

test('single slide requests carry page and revision and strip private response fields',async()=>{
  const ref='prj_'+'e'.repeat(64);
  const s=setup([{projectRef:ref,title:'Deck',pageNumber:3,totalSlides:12,revision:8,markdown:'## Page 3\n| Revenue | 42 |',slide_json:{secret:'hidden'},slideId:'private'}]);
  await s.store.write(token);
  const result=await s.client.projectSlide(ref,3,8);
  assert.equal(s.calls[0].url,`https://yrkie.com/api/plugin/v1/projects/${ref}/slides/3?expectedRevision=8`);
  assert.equal(result.revision,8);assert.match(result.markdown,/42/);
  assert.doesNotMatch(JSON.stringify(result),/private|hidden|slide_json/);
});

test('slide input bounds reject before requests',async()=>{
  const s=setup();await s.store.write(token);const ref='prj_'+'e'.repeat(64);
  for(const page of [0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]) await assert.rejects(s.client.projectSlide(ref,page));
  for(const revision of [0,-1,1.5,Infinity]) await assert.rejects(s.client.projectSlide(ref,1,revision));
  await assert.rejects(s.client.projectSlide('real-slide-id',1));
  assert.equal(s.calls.length,0);
});

test('slide responses must match the requested page project and revision',async()=>{
  const ref='prj_'+'e'.repeat(64);
  const base={projectRef:ref,title:'Deck',pageNumber:2,totalSlides:12,revision:8,markdown:'content'};
  for(const change of [{projectRef:'prj_'+'f'.repeat(64)},{pageNumber:3},{revision:9},{totalSlides:1},{markdown:'文'.repeat(40001)}]) {
    const s=setup([{...base,...change}]);await s.store.write(token);
    await assert.rejects(s.client.projectSlide(ref,2,8),{code:'invalid_response'});
  }
});

test('slide failure codes remain actionable without private error details',async()=>{
  for(const code of ['insufficient_scope','slide_revision_conflict','slide_format_unsupported','slides_not_found','slide_page_out_of_range','slide_unavailable','slide_too_large']) {
    const s=setup([{status:400,body:{error:code,detail:'private database failure'}}]);await s.store.write(token);
    await assert.rejects(s.client.projectSlide('prj_'+'e'.repeat(64),1),{code});
  }
});
