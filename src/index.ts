import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PluginError, YrkieClient, parseOrigin } from './client.js';
import { systemCredentials } from './credentials.js';
import { parseArgs } from 'node:util';
import { agentName } from './clientIdentity.js';

async function main() {
  const {values}=parseArgs({options:{origin:{type:'string'}}});
  const origin=parseOrigin(values.origin || process.env.YRKIE_ORIGIN || 'https://yrkie.com');
  const server=new McpServer({name:'yrkie',version:'0.1.3'});
  let client: YrkieClient | undefined;
  const application=()=>agentName(server.server.getClientVersion()?.name);
  const account=()=>client ??= new YrkieClient(origin,systemCredentials(origin,application()));
  const tools=[
    ['yrkie_bind_account','Start binding your own Yrkie account for this agent. Show the complete clickable verification URL unchanged; the user logs in and clicks Authorize in their browser.',()=>account().begin(application()),false],
    ['yrkie_complete_binding','Check a pending account binding once after the user approves. Honor retryAfter; no tight polling.',()=>account().finish(),false],
    ['yrkie_account_status','Read the current Yrkie account binding status.',()=>account().status(),true],
    ['yrkie_project_count','Count your current Library projects across all project types. Excludes archived/deleted projects.',()=>account().count(),true],
    ['yrkie_unbind_account','Revoke this Yrkie binding and remove the local credential. Use when the user asks to disconnect.',()=>account().logout(),false],
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
