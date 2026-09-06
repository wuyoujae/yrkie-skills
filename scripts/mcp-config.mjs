import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseOrigin } from '../dist/client.js';

export function mcpConfig(origin) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const args=[resolve(root,'dist/index.js')];
  if(origin)args.push('--origin',parseOrigin(origin));
  return {mcpServers:{yrkie:{command:process.execPath,args}}};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {values}=parseArgs({options:{origin:{type:'string'}}});
  process.stdout.write(JSON.stringify(mcpConfig(values.origin),null,2)+'\n');
}
