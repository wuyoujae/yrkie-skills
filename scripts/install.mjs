// Source installation: register the built MCP and install the bundled skill.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, copyFileSync, existsSync, constants, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { mcpConfig } from './mcp-config.mjs';

const {values,positionals}=parseArgs({allowPositionals:true,options:{origin:{type:'string'}}});
const client=positionals[0];
if(positionals.length!==1 || !['codex','claude'].includes(client))throw new Error('Usage: node scripts/install.mjs codex|claude [--origin <origin>]. Other clients: node scripts/mcp-config.mjs');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=join(root,'dist','index.js');
if(!existsSync(server))throw new Error('Run npm ci --ignore-scripts and npm run build first.');
const source=join(root,'skills','yrkie-account');
const targetRoot=client==='codex'
  ? join(process.env.CODEX_HOME || join(homedir(),'.codex'),'skills')
  : join(process.env.CLAUDE_CONFIG_DIR || join(homedir(),'.claude'),'skills');
const target=join(targetRoot,'yrkie-account');
const files=readdirSync(source,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile()).map(entry=>join(entry.parentPath,entry.name).slice(source.length+1));
for(const file of files) {
  if(existsSync(join(target,file)) && !readFileSync(join(target,file)).equals(readFileSync(join(source,file)))) {
    throw new Error(`A different skill file already exists at ${join(target,file)}. Review it before updating.`);
  }
}
function run(args) {
  // Quote every PowerShell literal, including paths. Never interpolate a shell command from JSON.
  // Register at user scope, outside this repository's auto-discovered plugin manifest.
  const options={encoding:'utf8',cwd:homedir()};
  const result=process.platform==='win32'
    ? spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',`& ${[client,...args].map(v=>"'"+v.replaceAll("'","''")+"'").join(' ')}; exit $LASTEXITCODE`],options)
    : spawnSync(client,args,options);
  return result;
}
const existing=run(['mcp','get','yrkie']);
if(existing.error)throw new Error(`Cannot run ${client}. Install the CLI first.`);
if(existing.status===0)throw new Error('An MCP named yrkie already exists. Review/remove it with your CLI before installing again.');
const config=mcpConfig(values.origin).mcpServers.yrkie;
const args=client==='codex'
  ? ['mcp','add','yrkie','--',config.command,...config.args]
  : ['mcp','add','--scope','user','--transport','stdio','yrkie','--',config.command,...config.args];
const installed=run(args);
if(installed.status!==0)throw new Error(`${client} MCP registration failed. Check the CLI installation and configuration permissions.`);
for(const file of files) {
  mkdirSync(dirname(join(target,file)),{recursive:true});
  if(!existsSync(join(target,file)))copyFileSync(join(source,file),join(target,file),constants.COPYFILE_EXCL);
}
console.log(`Installed Yrkie MCP and skill for ${client}. Keep this repository at ${root}. Restart the agent and ask it to connect your Yrkie account.`);
