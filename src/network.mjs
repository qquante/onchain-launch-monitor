import { setTimeout as sleep } from 'node:timers/promises';
import { hex, number } from './core.mjs';
const READ_METHODS=new Set(['eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getTransactionReceipt','eth_getLogs','eth_getCode','eth_getStorageAt','eth_call','web3_sha3']);
export async function request(url,body,{timeout=20000,retries=2}={}) {
 for(let i=0;;i++){
  try {
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
   if(!r.ok){ const e=Error('HTTP '+r.status); e.retryAfter=Number(r.headers.get('retry-after'))||(r.status===429?10:0);throw e; }
   const data=await r.json(); if(data.errors)throw Error('GraphQL: '+data.errors.map(x=>x.message).join('; ')); return data;
  }catch(e){if(i>=retries)throw e;await sleep(Math.min(15000,Math.max((e.retryAfter||0)*1000,500*2**i))+Math.random()*200);}
 }
}
export class Rpc {
 constructor(c){this.urls=[c.rpcHttp,c.rpcFallbackHttp].filter(Boolean);this.active=0;this.id=0;this.calls=0;this.chainId=c.chainId;this.checked=new Set();}
 async call(method,params=[]){
  if(!READ_METHODS.has(method))throw Error('RPC method is not read-only');
  let failure;
  for(let attempt=0;attempt<this.urls.length;attempt++){
   const ix=(this.active+attempt)%this.urls.length;
   try{
    if(!this.checked.has(ix)){
     const identity=await request(this.urls[ix],{jsonrpc:'2.0',id:++this.id,method:'eth_chainId',params:[]});
     if(identity.error||number(identity.result)!==this.chainId)throw Error('RPC chain mismatch');this.checked.add(ix);
    }
    this.calls++;
    const d=await request(this.urls[ix],{jsonrpc:'2.0',id:++this.id,method,params});
    if(d.error)throw Error('RPC '+d.error.code+': '+d.error.message);
    if(!Object.hasOwn(d,'result'))throw Error('RPC missing result');this.active=ix;return d.result;
   }catch(e){failure=e;}
  }throw failure;
 }
 async batch(calls){
  if(calls.length>50||calls.some(x=>!READ_METHODS.has(x.method)))throw Error('Invalid read-only batch');
  await this.call('eth_chainId');
  const requests=calls.map(x=>({...x,jsonrpc:'2.0',id:++this.id}));
  const data=await request(this.urls[this.active],requests);
  if(!Array.isArray(data))throw Error('RPC batch unavailable');
  const map=new Map(data.map(x=>[x.id,x]));
  return requests.map(x=>{const r=map.get(x.id);if(!r||r.error)throw Error('RPC batch: '+(r?.error?.message||'missing result'));return r.result;});
 }
 async logs(from,to,c){return this.call('eth_getLogs',[{fromBlock:hex(from),toBlock:hex(to),address:c.factories.map(x=>x.address),topics:[c.factories.map(x=>x.topic)]}]);}
}
export const TOKEN_QUERY=`query MonitorTokens($input:LaunchpadTokensInput!){ launchpad { tokens(input:$input){ totalCount pageInfo{endCursor hasNextPage} edges{cursor node{__typename chainId provider factoryAddress address creator name symbol decimals initialSupply initialFdvUsd indexingStatus creationTransactionHash createdAt pool{address feeTier quoteToken{address symbol name decimals}} metadata{description revision updatedAt links{kind url label}} metrics{version priceUsd marketCapitalizationUsd currentTvlUsd asOf source isStale} }}}}}`;
export class SushiApi {
 constructor(c){this.c=c;}
 async query(query,variables={}){if(/\bmutation\b/i.test(query))throw Error('Mutations forbidden');return request(this.c.apiUrl,{query,variables});}
 async providers(){ const x=await this.query('{__type(name:"LaunchpadProvider"){enumValues{name}}}'); return x.data.__type.enumValues.map(x=>x.name); }
 async page({providers=this.c.factories.map(f=>f.provider),after,first=100,sortDirection='DESC'}={}){
  const input={chainId:this.c.chainId,providers,first,sortBy:'CREATED_AT',sortDirection};if(after)input.after=after;
  const d=await this.query(TOKEN_QUERY,{input});const out=d.data.launchpad.tokens;
  if(!Array.isArray(out.edges)||!out.pageInfo)throw Error('Unexpected API schema');return out;
 }
 async *pages(options={}){let after,seen=new Set();for(let n=0;n<1000;n++){
  const p=await this.page({...options,after});yield p;
  if(!p.pageInfo.hasNextPage)return;
  const next=p.pageInfo.endCursor;if(!next||seen.has(next))throw Error('Non-advancing API cursor');seen.add(next);after=next;await sleep(300);
 }throw Error('API pagination cap reached');}
}
export async function stableRange(rpc,c,from,to) {
 const before=await rpc.call('eth_getBlockByNumber',[hex(to),false]);if(!before)throw Error('Missing range anchor');
 const logs=await rpc.logs(from,to,c);
 const after=await rpc.call('eth_getBlockByNumber',[hex(to),false]);if(!after||before.hash!==after.hash)throw Error('Reorg during range read; retry');
 if(logs.some(l=>number(l.blockNumber)<from||number(l.blockNumber)>to||l.removed))throw Error('Invalid log range');
 return {logs,anchor:after};
}
export const IMPLEMENTATION_SLOT='0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

