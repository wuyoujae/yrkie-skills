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
    assert.equal((await client.listTools()).tools.length,19);
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

test('the self-contained skill includes both complete Schema and Design pairs',()=>{
  const root=new URL('../skills/yrkie-account/',import.meta.url);
  const visited=new Set();
  function readReference(file) {
    assert.ok(file.href.startsWith(root.href),'Skill references must stay inside the installed folder');
    if(visited.has(file.href))return;
    visited.add(file.href);
    const content=readFileSync(file,'utf8');
    if(!file.pathname.endsWith('.md'))return;
    for(const match of content.matchAll(/\]\(([^\s)#]+)(?:#[^)]*)?\)/g)) {
      if(/^[a-z]+:/i.test(match[1]))continue;
      readReference(new URL(match[1],file));
    }
  }
  readReference(new URL('SKILL.md',root));
  for(const file of ['outline-schema.md','outline-design.md','slide-schema.md','slide-design.md']) {
    assert.ok(visited.has(new URL('references/'+file,root).href),file+' must be reachable from SKILL.md');
  }
});
