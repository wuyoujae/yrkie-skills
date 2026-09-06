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
