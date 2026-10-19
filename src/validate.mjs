import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { keccak256 } from 'viem';
import { config, ROOT, atomic, utc, number, hex, decodeLaunch, checkApiMatch, compareEvents } from './core.mjs';
import { Rpc, SushiApi, stableRange, IMPLEMENTATION_SLOT } from './network.mjs';
const c=config(), rpc=new Rpc(c),api=new SushiApi(c);
const dir=resolve(ROOT,'validation',utc().replace(/[:.]/g,'-'));mkdirSync(dir,{recursive:true});
const result={startedAtUtc:utc(),chainId:c.chainId,mode:'LIVE_READ_ONLY',factories:[],checks:[],errors:[],historicalCoverage:null};
const head=number(await rpc.call('eth_blockNumber'));result.snapshotBlock=head;
try{
 const providers=await api.providers();result.providers=providers;
 for(const f of c.factories) {
  if(!providers.includes(f.provider))throw Error('API missing '+f.provider);
  const code=await rpc.call('eth_getCode',[f.address,hex(head)]);
  if(code==='0x')throw Error('Factory has no bytecode '+f.provider);
  const slot=await rpc.call('eth_getStorageAt',[f.address,IMPLEMENTATION_SLOT,hex(head)]);
  const impl='0x'+slot.slice(-40); const isProxy=!/^0x0+$/.test(impl);
  const record={provider:f.provider,address:f.address,codeBytes:(code.length-2)/2,codeHash:keccak256(code),topic:f.topic,implementation:isProxy?impl:null};
  if(isProxy){const ic=await rpc.call('eth_getCode',[impl,hex(head)]);if(ic==='0x')throw Error('Empty implementation');record.implementationCodeHash=keccak256(ic);record.implementationCodeBytes=(ic.length-2)/2;}
  result.factories.push(record);console.log('CONTRACT',record.provider,record.address,'implementation',record.implementation);
 }
 atomic(resolve(dir,'contracts.json'),result.factories);
 const nodes=[];let pages=0,totals=new Set();
 for await(const p of api.pages({sortDirection:'ASC'})){pages++;totals.add(p.totalCount);nodes.push(...p.edges.map(e=>e.node));if(pages%5===0)console.log('API pages',pages,'tokens',nodes.length);}
 const unique=new Map(nodes.map(t=>[t.address.toLowerCase(),t]));
 atomic(resolve(dir,'api-tokens.json'),{observedAtUtc:utc(),tokens:[...unique.values()]});
 result.api={pages,uniqueCount:unique.size,reportedCounts:[...totals],byProvider:Object.fromEntries(c.factories.map(f=>[f.provider,[...unique.values()].filter(t=>t.provider===f.provider).length]))};
 console.log('Scanning factory logs from block 0 to',head);
 let logs=[];
 try{const r=await stableRange(rpc,c,0,head);logs=r.logs;result.historicalCoverage={fromBlock:0,toBlock:head,anchorHash:r.anchor.hash,complete:true,method:'eth_getLogs filtered by registered factories and topics'};}
 catch(e){result.errors.push('Full log scan unavailable: '+e.message);result.historicalCoverage={fromBlock:null,toBlock:head,complete:false};}
 atomic(resolve(dir,'raw-logs.json'),logs);
 const events=[];
 for(const log of logs){
  let ts=log.blockTimestamp;if(!ts || number(ts)===0){const block=await rpc.call('eth_getBlockByNumber',[log.blockNumber,false]);if(block.hash!==log.blockHash)throw Error('Log/header mismatch');ts=block.timestamp;}
  events.push(decodeLaunch(log,c,ts));
 }
 events.sort(compareEvents);
 const found=new Map(events.map(e=>[e.address,e]));
 let matches=0,mismatches=[],missing=[];
 for(const t of unique.values()){
  if(!found.has(t.address.toLowerCase())){missing.push({provider:t.provider,address:t.address});continue;}
  try{checkApiMatch(t,found.get(t.address.toLowerCase()));matches++;}catch(e){mismatches.push({address:t.address,error:e.message});}
 }
 result.reconciliation={logEvents:events.length,uniqueEventTokens:found.size,matched:matches,mismatches,apiMissingOnchain:missing,onchainMissingApi:events.filter(e=>!unique.has(e.address)).map(e=>e.address)};
 // Independently verify all indexed V2 receipts, including tokens omitted by any log provider.
 const verified=[];
 for(const t of [...unique.values()].filter(t=>t.provider==='SUSHI_V2')){
  const receipt=await rpc.call('eth_getTransactionReceipt',[t.creationTransactionHash]);
  if(!receipt||receipt.status!=='0x1')throw Error('Missing/successless V2 receipt '+t.address);
  const log=receipt.logs.find(l=>l.address.toLowerCase()===t.factoryAddress.toLowerCase()&&l.topics[0]===c.factories.find(f=>f.provider==='SUSHI_V2').topic);
  if(!log)throw Error('No V2 creation log');
  const block=await rpc.call('eth_getBlockByNumber',[receipt.blockNumber,false]);
  if(block.hash!==receipt.blockHash||log.blockHash!==block.hash)throw Error('Noncanonical receipt');
  const event=decodeLaunch(log,c,block.timestamp);checkApiMatch(t,event);
  verified.push(event);atomic(resolve(dir,'receipt-'+t.address+'.json'),receipt);
 }
 atomic(resolve(dir,'events.json'),events);
 atomic(resolve(dir,'v2-receipt-verified.json'),verified.sort(compareEvents));
 result.v2ReceiptsVerified=verified.length;
 result.ok=result.historicalCoverage.complete&&mismatches.length===0&&missing.length===0;
 if(!result.ok)process.exitCode=2;
}catch(e){result.ok=false;result.errors.push(e.message);process.exitCode=1;}
result.finishedAtUtc=utc();atomic(resolve(dir,'summary.json'),result);
atomic(resolve(ROOT,'validation/latest.json'),{directory:dir,...result});
console.log(JSON.stringify(result,null,2));

