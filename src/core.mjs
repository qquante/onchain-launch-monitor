import { decodeEventLog, parseAbi, keccak256, toBytes } from 'viem';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const json = x => JSON.stringify(x, (_,v)=>typeof v==='bigint'?v.toString():v);
export const utc = () => new Date().toISOString();
export const hex = n => '0x'+BigInt(n).toString(16);
export const number = x => { const n=Number(BigInt(x)); if(!Number.isSafeInteger(n)||n<0) throw Error('Unsafe chain integer'); return n; };
export const lower = x => String(x).toLowerCase();
export const clean = x => String(x??'').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,800);
export function atomic(path,value) { mkdirSync(dirname(path),{recursive:true}); const t=path+'.tmp'; writeFileSync(t,typeof value==='string'?value:json(value),'utf8'); renameSync(t,path); }
export function config(path=resolve(ROOT,'config/monitor.json')) {
  const c=JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
  c.rpcHttp=process.env.SUSHI_RPC_HTTP||c.rpcHttp;
  c.rpcFallbackHttp=process.env.SUSHI_RPC_FALLBACK_HTTP||c.rpcFallbackHttp;
  c.rpcWs=process.env.SUSHI_RPC_WS||c.rpcWs;
  if(c.chainId!==4663) throw Error('Unvalidated chain configuration');
  if(c.publicLaunchAtUtc && (!/^\d{4}-\d\d-\d\dT.*Z$/.test(c.publicLaunchAtUtc)||!Number.isFinite(Date.parse(c.publicLaunchAtUtc)))) throw Error('Public launch cutoff must be UTC ISO ending Z');
  for(const f of c.factories) { f.address=lower(f.address); f.abiParsed=parseAbi([f.abi]); f.topic=keccak256(toBytes(f.signature)); }
  return c;
}
export function decodeLaunch(log,c,blockTimestamp) {
  const f=c.factories.find(f=>f.address===lower(log.address)&&f.topic===lower(log.topics?.[0]));
  if(!f) throw Error('Unrecognized factory/event pair');
  if(!/^0x[0-9a-f]{64}$/i.test(log.blockHash)||!/^0x[0-9a-f]{64}$/i.test(log.transactionHash)) throw Error('Missing event identity');
  const a=decodeEventLog({abi:f.abiParsed,data:log.data,topics:log.topics,strict:true}).args;
  if(!blockTimestamp || number(blockTimestamp)===0)throw Error('Missing authoritative block timestamp');
  const createdAtUtc=new Date(number(blockTimestamp)*1000).toISOString();
  return {chainId:c.chainId,provider:f.provider,factoryAddress:f.address,address:lower(a.token),creator:lower(a.launchCreator??a.creator),poolAddress:lower(a.pool),quoteToken:lower(a.quoteToken),name:a.name,symbol:a.symbol,blockNumber:number(log.blockNumber),transactionIndex:number(log.transactionIndex),logIndex:number(log.logIndex),blockHash:lower(log.blockHash),transactionHash:lower(log.transactionHash),createdAtUtc,initialLiquidityMode:a.liquidityMode===undefined?null:Number(a.liquidityMode),initialFeeDisposition:a.feeDisposition===undefined?null:Number(a.feeDisposition),initialFeeReceiver:a.initialFeeReceiver?lower(a.initialFeeReceiver):null,rawLog:log,args:JSON.parse(json(a)),removed:!!log.removed};
}
export function compareEvents(a,b){return a.blockNumber-b.blockNumber||a.transactionIndex-b.transactionIndex||a.logIndex-b.logIndex;}
export function cohort(event,startBlock,cutoff) { return {sinceMonitorStart:event.blockNumber>startBlock,afterPublicLaunch:cutoff?Date.parse(event.createdAtUtc)>=Date.parse(cutoff):null}; }
export function checkApiMatch(api,event) {
  const pairs=[['address',api.address,event.address],['provider',api.provider,event.provider],['factory',api.factoryAddress,event.factoryAddress],['transaction',api.creationTransactionHash,event.transactionHash],['pool',api.pool.address,event.poolAddress],['quote',api.pool.quoteToken.address,event.quoteToken]];
  for(const [label,a,b] of pairs) if(lower(a)!==lower(b))throw Error('API/on-chain mismatch: '+label);
  if(api.name!==event.name||api.symbol!==event.symbol||Date.parse(api.createdAt)!==Date.parse(event.createdAtUtc))throw Error('API/on-chain name/time mismatch');
  // API creator can change; original creator is retained from the creation log.
  return true;
}

