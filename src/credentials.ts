import { randomUUID } from 'node:crypto';
import { PluginError, type Credentials } from './client.js';

export function systemCredentials(origin:string):Credentials {
  const service=`yrkie-agent-plugin:${origin}`;
  async function entry(name='account') {const {AsyncEntry}=await import('@napi-rs/keyring');return new AsyncEntry(service,name);}
  async function safe<T>(action:()=>Promise<T>):Promise<T> {try{return await action();}catch{throw new PluginError('secure_storage_unavailable');}}
  return {
    read:()=>safe(async()=> (await (await entry()).getPassword())??null),
    write:(token)=>safe(async()=>{await(await entry()).setPassword(token);}),
    remove:()=>safe(async()=>{await(await entry()).deletePassword();}),
    check:()=>safe(async()=>{
      const probe=await entry(`probe-${randomUUID()}`);const value=randomUUID();
      try{await probe.setPassword(value);if(await probe.getPassword()!==value)throw new Error();}
      finally{await probe.deletePassword();}
    }),
  };
}
