import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

test('real stdio handshake discovers sixteen narrowly scoped tools without internal IDs',async()=>{
  const client=new Client({name:'yrkie-protocol-test',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/index.js',import.meta.url))],stderr:'pipe'});
  try {
    await client.connect(transport);
    const {tools}=await client.listTools();assert.equal(tools.length,16);
    assert.equal(tools.find(t=>t.name==='yrkie_project_count').annotations.readOnlyHint,true);
    assert.ok(tools.every(t=>!('userId' in (t.inputSchema.properties??{}))));
    for (const name of ['yrkie_list_projects','yrkie_project_info','yrkie_project_outline']) {
      assert.equal(tools.find(t=>t.name===name).annotations.readOnlyHint,true);
    }
    const schema=tools.find(t=>t.name==='yrkie_project_outline').inputSchema;
    assert.deepEqual(Object.keys(schema.properties),['projectRef']);
    const slide=tools.find(t=>t.name==='yrkie_project_slide');
    assert.equal(slide.annotations.readOnlyHint,true);
    assert.deepEqual(Object.keys(slide.inputSchema.properties),['projectRef','pageNumber','expectedRevision']);
    assert.equal((await client.callTool({name:slide.name,arguments:{projectRef:'prj_'+'e'.repeat(64),pageNumber:0}})).isError,true);
    const invalid=await client.callTool({name:'yrkie_project_info',arguments:{projectRef:'real-session-id'}});
    assert.equal(invalid.isError,true);
    const result=await client.callTool({name:'yrkie_complete_binding',arguments:{}});
    assert.equal(result.isError,true);assert.ok(JSON.stringify(result).includes('binding_not_started'));
  } finally {await client.close();}
});
