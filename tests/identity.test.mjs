import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentName } from '../dist/clientIdentity.js';
test('normalizes handshake names while supporting other agents',()=>{
  assert.equal(agentName('codex-mcp-client'),'Codex');
  assert.equal(agentName('claude-code'),'Claude Code');
  assert.equal(agentName('Cursor'),'Cursor');
  assert.equal(agentName(undefined),'AI Agent');
  assert.ok(!agentName('<script>bad</script>').includes('<'));
  assert.equal(agentName('x'.repeat(100)).length,64);
});
