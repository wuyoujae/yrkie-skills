import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PluginError, YrkieClient, parseOrigin } from './client.js';
import { systemCredentials } from './credentials.js';
import { parseArgs } from 'node:util';

async function main() {
  const {values}=parseArgs({options:{origin:{type:'string'}}});
  const origin=parseOrigin(values.origin || process.env.YRKIE_ORIGIN || 'https://yrkie.com');
  const client=new YrkieClient(origin,systemCredentials(origin));
  const server=new McpServer({name:'yrkie',version:'0.1.1'});
  const tools=[
    ['yrkie_bind_account','Start binding your own Yrkie account. Show the clickable verification URL; the user must approve in their browser.',()=>client.begin(),false],
    ['yrkie_complete_binding','Check a pending account binding once after the user approves. Honor retryAfter; no tight polling.',()=>client.finish(),false],
    ['yrkie_account_status','Read the current Yrkie account binding status.',()=>client.status(),true],
    ['yrkie_project_count','Count your current Library projects across all project types. Excludes archived/deleted projects.',()=>client.count(),true],
    ['yrkie_unbind_account','Revoke this Yrkie binding and remove the local credential. Use when the user asks to disconnect.',()=>client.logout(),false],
  ] as const;
  for(const [name,description,action,readOnlyHint] of tools) {
    server.registerTool(name,{description,inputSchema:{},annotations:{readOnlyHint,destructiveHint:name==='yrkie_unbind_account',idempotentHint:readOnlyHint,openWorldHint:true}},async()=>{
      try {const result=await action();return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}
      catch(error){const code=error instanceof PluginError?error.code:'plugin_error';return {isError:true,content:[{type:'text',text:JSON.stringify({error:code})}]};}
    });
  }
  await server.connect(new StdioServerTransport());
}
main().catch(()=>{process.stderr.write('Yrkie MCP startup failed. Check the configured origin and Node.js installation.\n');process.exitCode=1;});
