import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { YrkieClient } from '../dist/client.js';

const requestId='a1b2c3d4-1234-4123-8123-0123456789ab';
const reference='prj_'+'a'.repeat(64);
const credentials={read:async()=> 'yrk_plugin_'+'b'.repeat(64),write:async()=>{},remove:async()=>{},check:async()=>{}};
const state={version:2,revision:1,status:'draft'};
const outline={title:'Draft',page_count:1,body:[{index:1,page:1,contents:['A page','42 units']}]};

test('writes transmit complete JSON, stable request IDs and expected outline state',async()=>{
  const calls=[];
  const client=new YrkieClient('https://yrkie.com',credentials,async(url,options)=>{
    calls.push({url,options});
    const value=url.endsWith('/outline')
      ? {projectRef:reference,requestId,title:'Draft',version:2,revision:1,pageCount:1,status:'created',replayed:false,currentOutline:state,sessionId:'secret'}
      : {projectRef:reference,requestId,title:'Project',projectType:'presentation.doe',expiresAt:'2026-09-07T20:00:00Z',status:'created',replayed:false,currentOutline:null,sessionId:'secret'};
    return Response.json(value);
  });
  const project=await client.createProject('Project',requestId);
  assert.equal(project.currentOutline,null);assert.ok(!('sessionId' in project));
  const saved=await client.createOutline(reference,requestId,{version:1,revision:3},outline);
  assert.deepEqual(saved.currentOutline,state);assert.ok(!('sessionId' in saved));
  assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(calls[1].options.body),{requestId,expectedOutline:{version:1,revision:3},outline});
});

test('structured validation diagnostics survive but extra server fields do not',async()=>{
  const details={message:'Fix the listed fields.',issues:[{path:'/outline/body/0/page',code:'page_sequence',message:'Expected page 1.',hint:'Use integer 1.',raw:'private'}],truncated:false};
  const client=new YrkieClient('https://yrkie.com',credentials,async()=>Response.json({error:'validation_failed',...details,sql:'private database'},{status:422}));
  await assert.rejects(client.createOutline(reference,requestId,null,outline),e=>{
    assert.equal(e.code,'validation_failed');assert.equal(e.details.issues[0].path,'/outline/body/0/page');
    assert.ok(!JSON.stringify(e.details).includes('private'));return true;
  });
});

test('network uncertainty does not trigger automatic writes or invent a new UUID',async()=>{
  let calls=0;const client=new YrkieClient('https://yrkie.com',credentials,async()=>{calls++;throw new Error('socket lost');});
  await assert.rejects(client.createOutline(reference,requestId,null,outline),{code:'network_error'});assert.equal(calls,1);
});

test('unexpected write responses fail closed and missing expected state is not null',async()=>{
  let calls=0;const client=new YrkieClient('https://yrkie.com',credentials,async()=>{calls++;return Response.json({});});
  await assert.rejects(client.createOutline(reference,requestId,undefined,outline));assert.equal(calls,0);
  await assert.rejects(client.createProject('Project',requestId),{code:'invalid_response'});assert.equal(calls,1);
});

test('author examples satisfy the published structural and byte contracts',()=>{
  const base=new URL('../skills/yrkie-account/references/',import.meta.url);
  const schema=JSON.parse(readFileSync(new URL('doe-outline-v1.schema.json',base)));
  const examples=JSON.parse(readFileSync(new URL('doe-outline-v1.examples.json',base)));
  assert.equal(schema.additionalProperties,false);
  for(const value of examples){
    assert.deepEqual(Object.keys(value).sort(),schema.required.slice().sort());
    assert.equal(value.page_count,value.body.length);
    assert.ok(Buffer.byteLength(JSON.stringify(value))<=schema['x-maxUtf8Bytes']);
    assert.ok(Buffer.byteLength(value.title)<=schema.properties.title['x-maxUtf8Bytes']);
    for(const [i,page] of value.body.entries()){
      assert.equal(page.index,i+1);assert.equal(page.page,i+1);
      for(const item of page.contents)assert.ok(Buffer.byteLength(item)<=schema.properties.body.items.properties.contents.items['x-maxUtf8Bytes']);
    }
  }
});
