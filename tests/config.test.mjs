import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mcpConfig } from '../scripts/mcp-config.mjs';

test('generic configuration starts a standard MCP client without agent-specific setup',async()=>{
  const config=mcpConfig('http://127.0.0.1:7622').mcpServers.yrkie;
  assert.deepEqual(config.args.slice(-2),['--origin','http://127.0.0.1:7622']);
  const client=new Client({name:'generic-agent-test',version:'1.0.0'});
  try {
    await client.connect(new StdioClientTransport({...config,env:{YRKIE_ORIGIN:'invalid-env-origin'},stderr:'pipe'}));
    assert.equal((await client.listTools()).tools.length,8);
  } finally {await client.close();}
});

test('origin rejects request paths and credentials before producing install config',()=>{
  assert.throws(()=>mcpConfig('https://example.com/private/path'));
  assert.throws(()=>mcpConfig('https://user:secret@example.com'));
});

test('skill includes component contract without platform HTTP routes',()=>{
  const skill=readFileSync(new URL('../skills/yrkie-account/SKILL.md',import.meta.url),'utf8');
  const schema=readFileSync(new URL('../skills/yrkie-account/references/component-schema.md',import.meta.url),'utf8');
  assert.match(skill,/references\/component-schema\.md/);
  assert.match(schema,/version: 4/);
  assert.doesNotMatch(skill+schema,/\/api\/|https?:\/\/|curl\s|fetch\(/);
});
