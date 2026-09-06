import * as z from 'zod';

export class PluginError extends Error {
  constructor(readonly code: string) { super(code); }
}
export interface Credentials {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  remove(): Promise<void>;
  check(): Promise<void>;
}
export function parseOrigin(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new PluginError('invalid_origin'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new PluginError('invalid_origin');
  }
  return url.origin;
}
const deviceSchema = z.object({
  device_code: z.string().regex(/^[0-9a-f]{64}$/), user_code: z.string().regex(/^[A-F0-9]{5}-[A-F0-9]{5}$/),
  verification_uri: z.string(), verification_uri_complete: z.string(), expires_in: z.number().int().min(1).max(600), interval: z.number().int().min(5).max(60),
});
const tokenSchema = z.object({access_token: z.string().regex(/^yrk_plugin_[a-f0-9]{64}$/), token_type: z.literal('Bearer'), scope: z.literal('projects:count'), expires_in:z.number().int().positive()});
const accountSchema = z.object({displayName:z.string().max(256),email:z.string().max(320),scope:z.literal('projects:count')});
const countSchema = z.object({count:z.number().int().nonnegative().safe(),scope:z.literal('library'),asOf:z.string().datetime({offset:true})});
const knownErrors = new Set(['authorization_pending','slow_down','access_denied','expired_token','invalid_grant','invalid_token','invalid_client','invalid_scope','device_limit','rate_limited','temporarily_unavailable']);

export class YrkieClient {
  readonly origin: string;
  private pending?: {device: z.infer<typeof deviceSchema>; expires: number; next: number; interval: number};
  private busy = false;
  constructor(origin: string, private readonly credentials: Credentials, private readonly fetcher: typeof fetch = fetch, private readonly now = Date.now) {
    this.origin = parseOrigin(origin);
  }
  private async request(path: string, form?: Record<string,string>, token?: string, method = 'GET'): Promise<unknown> {
    try {
      const response = await this.fetcher(this.origin + path, {
        method: form ? 'POST' : method, redirect:'error', signal:AbortSignal.timeout(15000),
        headers: {Accept:'application/json', ...(form ? {'Content-Type':'application/x-www-form-urlencoded'} : {}), ...(token ? {Authorization:`Bearer ${token}`} : {})},
        body: form ? new URLSearchParams(form) : undefined,
      });
      // Stream with a hard size limit; never return raw platform errors to the model.
      const reader=response.body?.getReader();
      if (!reader) throw new PluginError('invalid_response');
      let size=0; const parts:Uint8Array[]=[];
      try { while(true) {const {done,value}=await reader.read(); if(done)break;size+=value.byteLength;if(size>16384)throw new PluginError('invalid_response');parts.push(value);} }
      finally {await reader.cancel();reader.releaseLock();}
      let value:unknown;
      try { value=JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new PluginError(response.status===404?'plugin_unavailable':'invalid_response'); }
      if (!response.ok) {
        const data=value as Record<string,unknown>;
        const code=data && (data.error ?? data.code);
        throw new PluginError(typeof code==='string' && knownErrors.has(code) ? code : response.status===401?'invalid_token':response.status===429?'rate_limited':'platform_error');
      }
      return value;
    } catch(error) { if(error instanceof PluginError)throw error; throw new PluginError('network_error'); }
  }
  private parse<T>(schema:z.ZodType<T>,value:unknown):T {
    const parsed=schema.safeParse(value); if(!parsed.success)throw new PluginError('invalid_response');return parsed.data;
  }
  private async exclusive<T>(action:()=>Promise<T>):Promise<T> {
    if(this.busy)throw new PluginError('operation_in_progress');this.busy=true;
    try{return await action();}finally{this.busy=false;}
  }
  async begin(agentName = 'AI Agent') { return this.exclusive(async()=>{
    if(await this.credentials.read())throw new PluginError('already_bound');
    await this.credentials.check();
    if(this.pending && this.now()<this.pending.expires)return this.bindingInfo();
    const device=this.parse(deviceSchema,await this.request('/api/plugin/oauth/device_authorization',{client_id:'yrkie-agent-plugin',scope:'projects:count',agent_name:agentName}));
    if(device.verification_uri!==this.origin+'/plugin/authorize')throw new PluginError('invalid_response');
    if(device.verification_uri_complete) {
      const expected=this.origin+'/plugin/authorize#request=';
      if(!device.verification_uri_complete.startsWith(expected) || !/^[0-9a-f]{64}$/.test(device.verification_uri_complete.slice(expected.length)))throw new PluginError('invalid_response');
    }
    this.pending={device,expires:this.now()+device.expires_in*1000,next:this.now()+device.interval*1000,interval:device.interval};
    return this.bindingInfo();
  }); }
  private bindingInfo() {
    const p=this.pending!;
    return {status:'authorization_pending',verificationUrl:p.device.verification_uri_complete,expiresIn:Math.max(0,Math.ceil((p.expires-this.now())/1000)),retryAfter:Math.max(0,Math.ceil((p.next-this.now())/1000))};
  }
  async finish() { return this.exclusive(async()=>{
    const p=this.pending;if(!p)throw new PluginError('binding_not_started');
    if(this.now()>=p.expires){this.pending=undefined;throw new PluginError('expired_token');}
    if(this.now()<p.next)return this.bindingInfo();
    p.next=this.now()+p.interval*1000;
    try {
      const token=this.parse(tokenSchema,await this.request('/api/plugin/oauth/token',{client_id:'yrkie-agent-plugin',grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:p.device.device_code}));
      this.pending=undefined;
      try {
        if(await this.credentials.read())throw new PluginError('already_bound');
        await this.credentials.write(token.access_token);
      } catch(error) {
        try { await this.request('/api/plugin/oauth/revoke',undefined,token.access_token,'POST'); } catch { throw new PluginError('storage_failed_revoke_in_browser'); }
        throw error;
      }
      return {status:'bound',scope:token.scope,expiresIn:token.expires_in};
    } catch(error) {
      if(error instanceof PluginError && ['authorization_pending','slow_down'].includes(error.code)) {
        if(error.code==='slow_down')p.interval=Math.min(60,p.interval+5);
        p.next=this.now()+p.interval*1000;return this.bindingInfo();
      }
      if(error instanceof PluginError && ['expired_token','invalid_grant','access_denied'].includes(error.code))this.pending=undefined;
      throw error;
    }
  }); }
  private async token() {const token=await this.credentials.read();if(!token)throw new PluginError('not_bound');return token;}
  async status() {
    const token=await this.credentials.read();if(!token)return {status:'not_bound'};
    return {status:'bound',account:this.parse(accountSchema,await this.request('/api/plugin/v1/account',undefined,token))};
  }
  async count() {return this.parse(countSchema,await this.request('/api/plugin/v1/projects/count',undefined,await this.token()));}
  async logout() {return this.exclusive(async()=>{
    const token=await this.token();
    try{await this.request('/api/plugin/oauth/revoke',undefined,token,'POST');}
    catch(error){if(!(error instanceof PluginError && error.code==='invalid_token'))throw error;}
    await this.credentials.remove();this.pending=undefined;return {status:'unbound'};
  });}
}
