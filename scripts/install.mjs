// Source installation: register the built MCP and install the bundled skill.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, copyFileSync, existsSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const client=process.argv[2];
if(!['codex','claude'].includes(client))throw new Error('Usage: node scripts/install.mjs codex|claude');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const server=join(root,'dist','index.js');
if(!existsSync(server))throw new Error('Run npm ci --ignore-scripts and npm run build first.');
const source=join(root,'skills','yrkie-account','SKILL.md');
const targetRoot=client==='codex'
  ? join(process.env.CODEX_HOME || join(homedir(),'.codex'),'skills')
  : join(process.env.CLAUDE_CONFIG_DIR || join(homedir(),'.claude'),'skills');
const target=join(targetRoot,'yrkie-account','SKILL.md');
if(existsSync(target) && readFileSync(target,'utf8')!==readFileSync(source,'utf8')) {
  throw new Error(`A different skill already exists at ${target}. Review it before updating.`);
}
function run(args) {
  // Quote every PowerShell literal, including paths. Never interpolate a shell command from JSON.
  const result=process.platform==='win32'
    ? spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',`& ${[client,...args].map(v=>"'"+v.replaceAll("'","''")+"'").join(' ')}; exit $LASTEXITCODE`],{encoding:'utf8'})
    : spawnSync(client,args,{encoding:'utf8'});
  return result;
}
const existing=run(['mcp','get','yrkie']);
if(existing.error)throw new Error(`Cannot run ${client}. Install the CLI first.`);
if(existing.status===0)throw new Error('An MCP named yrkie already exists. Review/remove it with your CLI before installing again.');
const args=client==='codex'
  ? ['mcp','add','yrkie','--',process.execPath,server]
  : ['mcp','add','--scope','user','--transport','stdio','yrkie','--',process.execPath,server];
const installed=run(args);
if(installed.status!==0)throw new Error(`${client} MCP registration failed. Check the CLI installation and configuration permissions.`);
mkdirSync(dirname(target),{recursive:true});
if(!existsSync(target))copyFileSync(source,target,constants.COPYFILE_EXCL);
console.log(`Installed Yrkie MCP and skill for ${client}. Keep this repository at ${root}. Restart the agent and ask it to connect your Yrkie account.`);
