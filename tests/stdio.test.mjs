import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

test('real stdio handshake discovers read-only count and five narrowly scoped tools',async()=>{
  const client=new Client({name:'yrkie-protocol-test',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../dist/index.js',import.meta.url))],stderr:'pipe'});
  try {
    await client.connect(transport);
    const {tools}=await client.listTools();assert.equal(tools.length,5);
    assert.equal(tools.find(t=>t.name==='yrkie_project_count').annotations.readOnlyHint,true);
    assert.ok(tools.every(t=>!('userId' in (t.inputSchema.properties??{}))));
    const result=await client.callTool({name:'yrkie_complete_binding',arguments:{}});
    assert.equal(result.isError,true);assert.ok(JSON.stringify(result).includes('binding_not_started'));
  } finally {await client.close();}
});
