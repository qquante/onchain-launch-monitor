import { resolve } from 'node:path';
import { existsSync,readFileSync,appendFileSync,writeFileSync,openSync,closeSync,unlinkSync,mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { keccak256 } from 'viem';
import { config,ROOT,json,utc,clean,atomic,number,decodeLaunch,checkApiMatch,hex } from './core.mjs';
import { Rpc,SushiApi,IMPLEMENTATION_SLOT } from './network.mjs';
import { Store } from './store.mjs';
import { Engine } from './engine.mjs';
import { reconcileHistoricalGap } from './history-gap.mjs';
const c=config(),dir=resolve(ROOT,'data');mkdirSync(dir,{recursive:true});
const lock=resolve(dir,'monitor.lock');
if(existsSync(lock)){const old=JSON.parse(readFileSync(lock,'utf8'));let alive=false;try{process.kill(old.pid,0);alive=true;}catch{}if(alive)throw Error('Monitor already running PID '+old.pid);unlinkSync(lock);}
const fd=openSync(lock,'wx');writeFileSync(fd,json({pid:process.pid,startedAtUtc:utc()}));closeSync(fd);
const db=new Store(resolve(dir,'monitor.sqlite')),rpc=new Rpc(c),api=new SushiApi(c),engine=new Engine(c,rpc,db);
let wakeChain=null;
let stop=false,ws=null,lastRpcOk=null,lastApiOk=null,lastHealthOk=null,lastError=null,wsState='not_configured';
let chainState={head:null,cursor:db.get('cursor')?.block,events:0};
const pendingCandidates=new Map();
const log=(kind,value)=>console.log(utc(),kind,clean(typeof value==='string'?value:json(value)));
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{stop=true;ws?.close();});
function recordError(source,e){lastError={source,message:clean(e.message),atUtc:utc()};log('ERROR',lastError);db.audit('ERROR',lastError);}
function emitOutbox(){
 for(const a of db.pending()){
  const e=JSON.parse(a.payload),meta=db.apiToken(e.address),links=meta?.metadata?.links||[];
  const message={id:a.id,kind:a.kind,...e,api:meta,observedDelayMs:Date.parse(e.firstObservedAtUtc)-Date.parse(e.createdAtUtc)};
  appendFileSync(resolve(dir,'notifications.jsonl'),json(message)+'\n','utf8');
  log(a.kind,e.provider+' | '+e.name+' ('+e.symbol+') | '+e.address);
  log('CREATED/RECEIVED',e.createdAtUtc+' / '+e.firstObservedAtUtc+' | block '+e.blockNumber+' tx '+e.transactionIndex+' log '+e.logIndex);
  log('LINKS',links.length?links.map(l=>l.kind+': '+l.url).join(' | '):'metadados pendentes');
  log('TX','https://robinhoodchain.blockscout.com/tx/'+e.transactionHash);
  db.printed(a.id);
 }
}
function exportStatus(){
 const all=db.events(),newTokens=all.filter(e=>e.sinceMonitorStart),v2=all.filter(e=>e.provider==='SUSHI_V2');
 const status={updatedAtUtc:utc(),pid:process.pid,running:!stop,mode:c.rpcWs?'HTTP_WITH_WS_HINTS':'HTTP_POLLING_READ_ONLY',pollMs:c.pollMs,monitorStartedAtUtc:db.get('monitorStartedAtUtc'),monitorStartBlock:db.get('startBlock'),coverageStartBlock:db.get('coverageStartBlock'),cursor:db.get('cursor'),headBlock:chainState.head,lagBlocks:chainState.head===null?null:Math.max(0,chainState.head-(db.get('cursor')?.block??0)),lastRpcOkUtc:lastRpcOk,lastApiOkUtc:lastApiOk,lastContractCheckUtc:lastHealthOk,lastError,wsState,publicLaunchAtUtc:c.publicLaunchAtUtc,publicLaunchRankingStatus:c.publicLaunchAtUtc?'configured':'pending_cutoff',knownCanonicalEvents:all.length,knownV2:v2.length,newSinceMonitorStarted:newTokens.length,newV2SinceMonitorStarted:newTokens.filter(e=>e.provider==='SUSHI_V2').length,pendingApiVerification:pendingCandidates.size,rpcCalls:rpc.calls,history:db.get('historicalCoverage'),historyBridge:db.get('historyBridge'),contractAttention:db.get('contractAttention'),releaseAttention:db.get('releaseAttention'),lastReleaseCheckUtc:db.get('lastReleaseCheckUtc'),rpcHealth:lastRpcOk&&Date.now()-Date.parse(lastRpcOk)<30000?'ok':'stale',apiHealth:lastApiOk&&Date.now()-Date.parse(lastApiOk)<90000?'ok':'stale'};
 atomic(resolve(dir,'status.json'),status);
 atomic(resolve(dir,'new-tokens.json'),{updatedAtUtc:utc(),scope:'canonical launches strictly after monitorStartBlock; not the public-launch cutoff',tokens:newTokens});
 atomic(resolve(dir,'v2-tokens.json'),{updatedAtUtc:utc(),scope:db.get('historicalCoverage')||'known receipt/log verified tokens; archive completeness not proven',tokens:v2.map((e,i)=>({...e,rankAmongKnownV2:i+1}))});
 const rows=['# Sushi Launch — monitor local','', 'Atualizado UTC: '+status.updatedAtUtc,'','Estado RPC: '+status.rpcHealth+' | API: '+status.apiHealth+' | Bloco: '+status.cursor?.block+' | Atraso: '+status.lagBlocks,'','Novos desde início: '+newTokens.length+' | V2: '+status.newV2SinceMonitorStarted,'','Corte da abertura pública: '+(c.publicLaunchAtUtc||'ainda não informado'),'','| Provider | Token | Criado UTC | Contrato |','|---|---|---|---|'];
 for(const e of newTokens.slice(-50).reverse())rows.push('| '+e.provider+' | '+clean(e.name).replaceAll('|','/')+' | '+e.createdAtUtc+' | '+e.address+' |');
 if(!newTokens.length)rows.push('','Nenhum novo lançamento on-chain observado após o início. Os tokens históricos ficam em data/v2-tokens.json.');
 atomic(resolve(dir,'LIVE.md'),rows.join('\n')+'\n');
}
async function hydrateHistory(){
 const validationPath=resolve(ROOT,'validation/latest.json');
 if(!existsSync(validationPath))return;
 const v=JSON.parse(readFileSync(validationPath,'utf8'));
 const apiFile=resolve(v.directory,'api-tokens.json');if(existsSync(apiFile)&&!db.get('importedApiBaseline'))db.transaction(()=>{for(const t of JSON.parse(readFileSync(apiFile,'utf8')).tokens)db.api(t);db.set('importedApiBaseline',true);});
 const verifiedFile=resolve(v.directory,'v2-receipt-verified.json');
 if(existsSync(verifiedFile)&&!db.get('importedV2Baseline')){
  for(const e of JSON.parse(readFileSync(verifiedFile,'utf8'))){
   const b=await rpc.call('eth_getBlockByNumber',[hex(e.blockNumber),false]);
   if(b?.hash.toLowerCase()===e.blockHash)db.event(e,{emit:false});
  }db.set('importedV2Baseline',true);
 }
 const hp=resolve(ROOT,'validation/history-latest.json');
 if(existsSync(hp)){
  const h=JSON.parse(readFileSync(hp,'utf8'));
  if(h.complete&&h.ok&&!db.get('importedHistory')){
   const b=await rpc.call('eth_getBlockByNumber',[hex(h.toBlock),false]);
   if(b?.hash.toLowerCase()!==h.anchorHash.toLowerCase())throw Error('Historical anchor changed');
   db.transaction(()=>{for(const e of JSON.parse(readFileSync(resolve(h.directory,'events.json'),'utf8')))db.event(e,{emit:false});db.set('historicalCoverage',h);db.set('importedHistory',true);});
  }
 }
}
async function verifyCandidate(t){
 if(db.db.prepare('SELECT 1 FROM events WHERE address=? AND canonical=1').get(t.address.toLowerCase()))return true;
 if(!c.factories.some(f=>f.address===t.factoryAddress.toLowerCase()&&f.provider===t.provider)){db.audit('UNKNOWN_FACTORY_API',t);return false;}
 const r=await rpc.call('eth_getTransactionReceipt',[t.creationTransactionHash]);if(!r||r.status!=='0x1')return false;
 const f=c.factories.find(f=>f.provider===t.provider&&f.address===t.factoryAddress.toLowerCase());
 const l=r.logs.find(l=>l.address.toLowerCase()===f.address&&l.topics[0]===f.topic);if(!l)throw Error('API creation receipt missing launch event');
 const b=await rpc.call('eth_getBlockByNumber',[r.blockNumber,false]);if(!b||b.hash!==r.blockHash)throw Error('API receipt not canonical');
 const e=decodeLaunch(l,c,b.timestamp);checkApiMatch(t,e);db.event(e);return true;
}
let providers=c.factories.map(f=>f.provider);
async function apiSweep(full=false){
 let pages=0;
 for await(const p of api.pages({providers})){
  pages++;
  for(const {node:t} of p.edges){
   const previous=db.apiToken(t.address.toLowerCase());db.api(t);
   if(!previous || !db.db.prepare('SELECT 1 FROM events WHERE address=? AND canonical=1').get(t.address.toLowerCase()))pendingCandidates.set(t.address.toLowerCase(),t);
  }
  // Fast sweeps are deliberately bounded; the on-chain cursor captures every block.
  if(!full&&pages>=2)break;
 }
 lastApiOk=utc();
 // Bound enrichment work to keep the independent block scanner responsive.
 for(const address of pendingCandidates.keys())if(db.db.prepare('SELECT 1 FROM events WHERE address=? AND canonical=1').get(address))pendingCandidates.delete(address);
 for(const [address,t] of [...pendingCandidates].sort((a,b)=>Date.parse(b[1].createdAt)-Date.parse(a[1].createdAt)).slice(0,10)){try{if(await verifyCandidate(t))pendingCandidates.delete(address);}catch(e){recordError('candidate',e);}}
}
async function releaseCheck(){
 if(Date.now()-Date.parse(db.get('lastReleaseCheckUtc')||0)<300000)return;
 const r=await fetch('https://api.github.com/repos/sushi-labs/sushiswap/pulls/2242',{headers:{'Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('GitHub PR check HTTP '+r.status);
 const p=await r.json(),fingerprint={number:p.number,head:p.head.sha,state:p.state,draft:p.draft,merged:p.merged,mergeCommit:p.merge_commit_sha};
 const old=db.get('releaseFingerprint');if(old&&json(old)!==json(fingerprint)){const change={kind:'RELEASE_SOURCE_CHANGED',before:old,after:fingerprint,atUtc:utc()};db.set('releaseAttention',change);db.audit('RELEASE_SOURCE_CHANGED',change);log('RELEASE_SOURCE_CHANGED',change);}
 db.set('releaseFingerprint',fingerprint);db.set('lastReleaseCheckUtc',utc());
}
async function contracts(){
 const p=await api.providers();const unseen=p.filter(x=>/^SUSHI_/.test(x)&&!c.factories.some(f=>f.provider===x));
 providers=p.filter(x=>/^SUSHI_/.test(x));
 if(unseen.length){db.set('contractAttention',{kind:'NEW_PROVIDER_REQUIRES_REVIEW',providers:unseen,atUtc:utc()});log('NEW_PROVIDER_REQUIRES_REVIEW',unseen);db.audit('NEW_PROVIDER_REQUIRES_REVIEW',unseen);}
 const entries=[];
 for(const f of c.factories){
  const code=await rpc.call('eth_getCode',[f.address,'latest']);if(code==='0x')throw Error('Factory disappeared '+f.provider);
  const slot=await rpc.call('eth_getStorageAt',[f.address,IMPLEMENTATION_SLOT,'latest']);
  const implementation='0x'+slot.slice(-40),proxy=!/^0x0+$/.test(implementation);
  const item={provider:f.provider,address:f.address,codeHash:keccak256(code),implementation:proxy?implementation:null};
  if(proxy){const code=await rpc.call('eth_getCode',[implementation,'latest']);if(code==='0x')throw Error('Implementation disappeared');item.implementationCodeHash=keccak256(code);}
  entries.push(item);
 }
 const old=db.get('contractFingerprints');
 if(old&&json(old)!==json(entries)){db.set('contractAttention',{kind:'CONTRACT_CHANGE',before:old,after:entries,atUtc:utc()});db.audit('CONTRACT_CHANGE',{before:old,after:entries});log('CONTRACT_CHANGE_REQUIRES_REVIEW',entries);}
 db.set('contractFingerprints',entries);lastHealthOk=utc();
}
function connectWs(){
 if(!c.rpcWs)return;
 ws=new WebSocket(c.rpcWs);wsState='connecting';let sub;
 ws.onopen=()=>{wsState='connected';ws.send(json({jsonrpc:'2.0',id:1,method:'eth_subscribe',params:['logs',{address:c.factories.map(x=>x.address),topics:[c.factories.map(x=>x.topic)]}]}));};
 // WS is a low-latency hint only; HTTP replay persists and checks canonical ordering.
 ws.onmessage=event=>{try{const m=JSON.parse(event.data);if(m.error){wsState='subscription_error';return;}if(m.method==='eth_subscription'){wsState='receiving';wakeChain?.();}}catch{wsState='invalid_message';}};
 ws.onerror=()=>{wsState='error';};
 ws.onclose=()=>{wsState='disconnected';if(!stop)setTimeout(connectWs,5000);};
}
async function loop(source,ms,fn){
 let errors=0;
 while(!stop&&!existsSync(resolve(dir,'stop.flag'))){
  try{await fn();errors=0;}catch(e){errors++;recordError(source,e);}
  emitOutbox();exportStatus();
  const delay=Math.min(60000,ms*2**Math.min(errors,4));
  if(source==='chain'&&!errors){await new Promise(resolve=>{const timer=setTimeout(()=>{wakeChain=null;resolve();},delay);wakeChain=()=>{clearTimeout(timer);wakeChain=null;resolve();};});}else await sleep(delay);
 }
 stop=true;
}
try{
 await engine.initialize();log('START','V1/V2 read-only | início '+db.get('monitorStartedAtUtc')+' | bloco '+db.get('startBlock'));
 await hydrateHistory();await reconcileHistoricalGap(c,rpc,db);await contracts();connectWs();
 let apiRound=0;
 await Promise.all([
  loop('chain',c.pollMs,async()=>{chainState=await engine.scanOnce();lastRpcOk=utc();}),
  loop('api',c.apiPollMs,()=>apiSweep(++apiRound===1||apiRound%Math.ceil(c.apiFullScanMs/c.apiPollMs)===0)),
  loop('contracts',c.healthPollMs,async()=>{await contracts();await hydrateHistory();await reconcileHistoricalGap(c,rpc,db);try{await releaseCheck();}catch(e){recordError('release',e);}})
 ]);
}catch(e){recordError('fatal',e);process.exitCode=1;}
finally{stop=true;ws?.close();exportStatus();db.close();if(existsSync(lock))unlinkSync(lock);log('STOP','cursor salvo');}


