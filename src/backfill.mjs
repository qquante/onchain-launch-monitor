import {setTimeout as sleep} from 'node:timers/promises';
import { resolve } from 'node:path';
import { readFileSync,existsSync,mkdirSync,appendFileSync } from 'node:fs';
import { config,ROOT,atomic,utc,hex,number,decodeLaunch,checkApiMatch,compareEvents,json } from './core.mjs';
import { Rpc,stableRange } from './network.mjs';
const c=config(),rpc=new Rpc(c),validation=JSON.parse(readFileSync(resolve(ROOT,'validation/latest.json'),'utf8'));
const out=resolve(validation.directory,'history');mkdirSync(out,{recursive:true});
const head=validation.snapshotBlock;
async function deployment(f){let lo=0,hi=head;while(lo<hi){const mid=Math.floor((lo+hi)/2);const code=await rpc.call('eth_getCode',[f.address,hex(mid)]);if(code==='0x')lo=mid+1;else hi=mid;}return lo;}
const deploys=[];
for(const f of c.factories){let first=0;try{first=await deployment(f);}catch(e){console.log('Historical state unavailable; scan from genesis',e.message);}deploys.push({...f,firstBlock:first});console.log('DEPLOYMENT',f.provider,first);atomic(resolve(out,'deployments.json'),deploys.map(({abiParsed,...f})=>f));}
const stateFile=resolve(out,'progress.json');let state=existsSync(stateFile)?JSON.parse(readFileSync(stateFile,'utf8')):{fromBlock:Math.min(...deploys.map(f=>f.firstBlock)),nextBlock:Math.min(...deploys.map(f=>f.firstBlock)),toBlock:head,chunks:0,events:0};
let chunk=500000;
while(state.nextBlock<=head){
 const to=Math.min(head,state.nextBlock+chunk-1);
 try{
  const anchor=await rpc.call('eth_getBlockByNumber',[hex(head),false]);const part={logs:await rpc.logs(state.nextBlock,to,c),anchor};
  atomic(resolve(out,state.nextBlock+'-'+to+'.json'),part.logs);
  state={...state,nextBlock:to+1,chunks:state.chunks+1,events:state.events+part.logs.length,updatedAtUtc:utc(),lastHash:part.anchor.hash};
  atomic(stateFile,state);console.log('HISTORY',state.nextBlock,'/',head,'events',state.events,'chunk',chunk);
 }catch(e){if(/metadata is not found|missing trie|pruned/i.test(e.message)||chunk<=1000)throw e;chunk=Math.max(1000,Math.floor(chunk/2));console.log('SMALLER RANGE',chunk,e.message);}
}
const {readdirSync}=await import('node:fs');const logs=[];
for(const name of readdirSync(out).filter(n=>/^\d+-\d+\.json$/.test(n)))logs.push(...JSON.parse(readFileSync(resolve(out,name),'utf8')));
const unique=new Map();for(const l of logs)unique.set([l.blockHash,l.transactionHash,l.logIndex].join(':'),l);
const headerFile=resolve(out,'headers.json');const events=[],headers=new Map(existsSync(headerFile)?Object.entries(JSON.parse(readFileSync(headerFile,'utf8'))):[]);
const hashes=[...new Set([...unique.values()].map(l=>l.blockNumber))].filter(n=>!headers.has(n));
for(let i=0;i<hashes.length;i+=20){
 const batch=hashes.slice(i,i+20);const blocks=await rpc.batch(batch.map(n=>({method:'eth_getBlockByNumber',params:[n,false]})));
 for(let j=0;j<blocks.length;j++){const b=blocks[j];if(!b)throw Error('Historical block missing');headers.set(batch[j],b);}
 atomic(headerFile,Object.fromEntries(headers));console.log('HEADERS',headers.size,'remaining',hashes.length-Math.min(i+20,hashes.length));await sleep(1500);
}
atomic(resolve(out,'headers.json'),Object.fromEntries(headers));
for(const l of unique.values()){const b=headers.get(l.blockNumber);if(b.hash!==l.blockHash)throw Error('Historical log/header mismatch');events.push(decodeLaunch(l,c,b.timestamp));}
events.sort(compareEvents);atomic(resolve(out,'events.json'),events);
const api=JSON.parse(readFileSync(resolve(validation.directory,'api-tokens.json'),'utf8')).tokens;
const byToken=new Map(events.map(e=>[e.address,e]));let matched=0;const mismatches=[],missing=[];
for(const t of api){const e=byToken.get(t.address.toLowerCase());if(!e){missing.push(t.address);continue;}try{checkApiMatch(t,e);matched++;}catch(err){mismatches.push({address:t.address,error:err.message});}}
const summary={finishedAtUtc:utc(),fromBlock:state.fromBlock,toBlock:head,anchorHash:state.lastHash,complete:true,events:events.length,matchedApi:matched,missingApiOnchain:missing,mismatches,onchainMissingApi:events.filter(e=>!api.some(t=>t.address.toLowerCase()===e.address)).map(e=>e.address),deployments:deploys.map(f=>({provider:f.provider,address:f.address,block:f.firstBlock===0?null:f.firstBlock})),ok:missing.length===0&&mismatches.length===0};
atomic(resolve(out,'summary.json'),summary);atomic(resolve(ROOT,'validation/history-latest.json'),{directory:out,...summary});console.log(json({...summary,mismatches:summary.mismatches.slice(0,5),missingApiOnchain:summary.missingApiOnchain.slice(0,5)}));if(!summary.ok)process.exitCode=2;


