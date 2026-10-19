import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,unlinkSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {config,ROOT,decodeLaunch,compareEvents,cohort,checkApiMatch,clean,hex} from '../src/core.mjs';
import {Store} from '../src/store.mjs';
import {Engine} from '../src/engine.mjs';
import {Rpc,SushiApi} from '../src/network.mjs';
const c=config(),read=n=>JSON.parse(readFileSync(resolve(ROOT,'evidence/live',n),'utf8'));
const receipt=read('v2-receipts.body')[0].result;
const v2log=receipt.logs.find(l=>l.address.toLowerCase()===c.factories[1].address&&l.topics[0]===c.factories[1].topic);
const event=decodeLaunch(v2log,c,v2log.blockTimestamp);
const ev=(block=11,suffix='1')=>({...event,blockNumber:block,blockHash:'0x'+suffix.repeat(64),transactionHash:'0x'+'2'.repeat(64),transactionIndex:2,logIndex:3});
function db(){const s=new Store(':memory:');s.set('startBlock',10);return s;}
test('real V2 receipt decodes exact API identity, modes and name',()=>{
 const token=read('v2-baseline.body').data.launchpad.tokens.edges.find(e=>e.node.address.toLowerCase()===event.address).node;
 assert.equal(checkApiMatch(token,event),true);assert.equal(event.initialLiquidityMode,1);assert.equal(event.initialFeeDisposition,0);
});
test('all 13 historical V2 receipts decode against independent API payloads',()=>{
 const api=read('v2-baseline.body').data.launchpad.tokens.edges.map(e=>e.node);
 const receipts=read('v2-receipts.body');
 for(const r of receipts){const l=r.result.logs.find(l=>l.address.toLowerCase()===c.factories[1].address&&l.topics[0]===c.factories[1].topic);const e=decodeLaunch(l,c,l.blockTimestamp);checkApiMatch(api.find(a=>a.address.toLowerCase()===e.address),e);}
 assert.equal(receipts.length,13);
});
test('real V1 receipt decodes with a different signature',()=>{
 const r=read('rpc-receipts.body')[0].result;
 const l=r.logs.find(l=>l.address.toLowerCase()===c.factories[0].address&&l.topics[0]===c.factories[0].topic);
 const e=decodeLaunch(l,c,l.blockTimestamp);assert.equal(e.provider,'SUSHI_V1');assert.equal(e.initialLiquidityMode,null);
 assert.equal(checkApiMatch(read('graphql-api-graphql.body').data.launchpad.tokens.edges[0].node,e),true);
});
test('spoof factory using the genuine topic is rejected',()=>assert.throws(()=>decodeLaunch({...v2log,address:'0x'+'9'.repeat(40)},c,v2log.blockTimestamp),/Unrecognized/));
test('wrong event version and malformed ABI are rejected',()=>{
 assert.throws(()=>decodeLaunch({...v2log,address:c.factories[0].address},c,v2log.blockTimestamp));
 assert.throws(()=>decodeLaunch({...v2log,data:'0x01'},c,v2log.blockTimestamp));
});
test('missing chain event identity is rejected',()=>assert.throws(()=>decodeLaunch({...v2log,blockHash:null},c,v2log.blockTimestamp),/identity/));
test('same-second order follows chain transaction/log positions',()=>{
 const a=ev();const b={...a,transactionIndex:1,logIndex:100};const d={...b,logIndex:2};
 assert.deepEqual([a,b,d].sort(compareEvents),[d,b,a]);
});
test('cutoff is distinct from monitor start; historical late arrival is not new',()=>{
 assert.deepEqual(cohort(ev(9),10,null),{sinceMonitorStart:false,afterPublicLaunch:null});
 assert.equal(cohort({...ev(),createdAtUtc:'2026-09-11T12:00:00Z'},10,'2026-09-11T12:00:00Z').afterPublicLaunch,true);
});
test('API mismatched tx is rejected; current creator may legitimately differ',()=>{
 const t=read('v2-baseline.body').data.launchpad.tokens.edges.find(e=>e.node.address.toLowerCase()===event.address).node;
 assert.equal(checkApiMatch({...t,creator:'0x'+'9'.repeat(40)},event),true);
 assert.throws(()=>checkApiMatch({...t,creationTransactionHash:'0x'+'9'.repeat(64)},event),/transaction/);
});
test('replay is idempotent and baseline cannot emit new notifications',()=>{
 const s=db();s.event({...ev(9,'4'),address:'0x'+'4'.repeat(40)});s.event(ev());s.event(ev());assert.equal(s.pending().length,1);assert.equal(s.events().length,2);s.close();
});
test('first observed timestamp survives repeated polls',()=>{
 const s=db();s.event(ev(),{now:'2026-09-10T01:00:00Z'});s.event(ev(),{now:'2026-09-10T02:00:00Z'});
 assert.equal(s.events()[0].firstObservedAtUtc,'2026-09-10T01:00:00Z');s.close();
});
test('transaction failure cannot partially advance cursor or save alerts',()=>{
 const s=db();assert.throws(()=>s.transaction(()=>{s.event(ev());s.set('cursor',{block:11});throw Error('disk-like abort');}));
 assert.equal(s.get('cursor'),null);assert.equal(s.events().length,0);assert.equal(s.pending().length,0);s.close();
});
test('reorg removes orphan from ranking and replacement becomes canonical',()=>{
 const s=db();s.commitRange([ev()],{number:'0xb',hash:ev().blockHash});
 s.rollback({block:10,hash:'0x'+'0'.repeat(64)});assert.equal(s.events().length,0);
 s.event(ev(11,'3'));assert.equal(s.events().length,1);assert.equal(s.events()[0].blockHash,ev(11,'3').blockHash);
 assert.deepEqual(s.pending().map(x=>x.kind),['NEW_TOKEN','REORG_REMOVED','NEW_TOKEN']);s.close();
});
test('SQLite restart preserves cursor, dedupe and notification state',()=>{
 const p=resolve(ROOT,'data','test-'+randomUUID()+'.sqlite');
 let s=new Store(p);s.set('startBlock',10);s.commitRange([ev()],{number:'0xb',hash:ev().blockHash});const id=s.pending()[0].id;s.printed(id);s.close();
 s=new Store(p);s.event(ev());assert.equal(s.get('cursor').block,11);assert.equal(s.pending().length,0);assert.equal(s.events().length,1);s.close();
 for(const suffix of ['','-wal','-shm'])if(existsSync(p+suffix))unlinkSync(p+suffix);
});
test('RPC failure leaves the scanner cursor for replay after reconnect',async()=>{
 const s=db();const anchor={number:hex(10),hash:'0x'+'0'.repeat(64)};s.commitRange([],anchor);
 let fail=true;
 const rpc={call:async(method,params)=>{if(method==='eth_blockNumber')return hex(12);if(method==='eth_getBlockByNumber')return {number:params[0],hash:params[0]===hex(10)?anchor.hash:'0x'+'3'.repeat(64)};throw Error(method);},
 logs:async()=>{if(fail)throw Error('connection lost');return [];}};
 const engine=new Engine(c,rpc,s);await assert.rejects(engine.scanOnce(),/connection lost/);assert.equal(s.get('cursor').block,10);
 fail=false;await engine.scanOnce();assert.equal(s.get('cursor').block,12);s.close();
});
test('scanner finds a saved common ancestor and fails closed on deeper reorg',async()=>{
 const s=db();s.commitRange([], {number:hex(10),hash:'0x'+'0'.repeat(64)});s.commitRange([ev()],{number:hex(12),hash:'0x'+'1'.repeat(64)});
 const rpc={call:async(m,p)=>({number:p[0],hash:p[0]===hex(10)?'0x'+'0'.repeat(64):'0x'+'8'.repeat(64)})};
 const e=new Engine(c,rpc,s);assert.equal(await e.repairReorg(),true);assert.equal(s.get('cursor').block,10);assert.equal(s.events().length,0);
 rpc.call=async(m,p)=>({number:p[0],hash:'0x'+'9'.repeat(64)});await assert.rejects(e.repairReorg(),/REORG_REQUIRES_BACKFILL/);assert.equal(s.get('cursor').block,10);s.close();
});
test('API paginator handles more than one page and rejects repeating cursors',async()=>{
 const api=new SushiApi(c);let calls=0;api.page=async()=>({edges:[{node:{address:String(calls)}}],pageInfo:{hasNextPage:++calls<3,endCursor:String(calls)}});
 const pages=[];for await(const p of api.pages())pages.push(p);assert.equal(pages.length,3);
 api.page=async()=>({edges:[],pageInfo:{hasNextPage:true,endCursor:'same'}});
 await assert.rejects(async()=>{for await(const p of api.pages()){}},/Non-advancing/);
});
test('no signing/broadcast or GraphQL mutations are allowed',async()=>{
 const rpc=new Rpc(c);await assert.rejects(rpc.call('eth_sendRawTransaction',['0x']),/not read-only/);
 const api=new SushiApi(c);await assert.rejects(api.query('mutation{anything}'),/forbidden/);
});
test('untrusted terminal control characters are removed',()=>assert.equal(clean('token\x1b[2J\nname').includes('\x1b'),false));


test('zero timestamp from historical getLogs cannot become 1970',()=>assert.throws(()=>decodeLaunch(v2log,c,'0x0'),/timestamp/));

test('historical gap replay is atomic, idempotent and preserves the live cursor',async()=>{
 const {reconcileHistoricalGap}=await import('../src/history-gap.mjs');
 const s=db(),base={number:hex(10),hash:'0x'+'0'.repeat(64)},tip={number:hex(20),hash:'0x'+'8'.repeat(64)};
 s.set('startBlock',20);s.commitRange([],tip);s.set('coverageStartBlock',15);s.set('historicalCoverage',{complete:true,ok:true,toBlock:10,anchorHash:base.hash});
 const l={...v2log,blockNumber:hex(12),blockHash:'0x'+'2'.repeat(64),blockTimestamp:'0x0'};
 let fail=true;
 const rpc={call:async(m,p)=>({number:p[0],hash:p[0]===hex(10)?base.hash:p[0]===hex(12)?l.blockHash:'0x'+'4'.repeat(64),timestamp:v2log.blockTimestamp}),logs:async()=>{if(fail)throw Error('temporary outage');return [l];}};
 await assert.rejects(reconcileHistoricalGap(c,rpc,s),/outage/);assert.equal(s.get('historyBridge'),null);assert.equal(s.get('cursor').block,20);
 fail=false;const result=await reconcileHistoricalGap(c,rpc,s);assert.equal(result.complete,true);assert.equal(result.events,1);assert.equal(s.get('cursor').block,20);assert.equal(s.pending().length,0);
 await reconcileHistoricalGap(c,rpc,s);assert.equal(s.events().length,1);assert.equal(s.events()[0].createdAtUtc,event.createdAtUtc);assert.equal(s.events()[0].rawLog.data,l.data);s.close();
});

test('scanner replaces zero log timestamp with canonical block header',async()=>{
 const s=db(),base={number:hex(10),hash:'0x'+'0'.repeat(64)};s.commitRange([],base);
 const l={...v2log,blockNumber:hex(11),blockHash:'0x'+'1'.repeat(64),blockTimestamp:'0x0'};
 const rpc={call:async(m,p)=>m==='eth_blockNumber'?hex(11):{number:p[0],hash:p[0]===hex(10)?base.hash:l.blockHash,timestamp:v2log.blockTimestamp},logs:async()=>[l]};
 await new Engine(c,rpc,s).scanOnce();assert.equal(s.events()[0].createdAtUtc,event.createdAtUtc);assert.equal(s.pending().length,1);s.close();
});

test('notification command reports real SQLite fixture once after explicit acknowledgement',async()=>{
 const {mkdirSync,writeFileSync}=await import('node:fs');const {spawnSync}=await import('node:child_process');
 const dir=resolve(ROOT,'data','test-alerts-'+randomUUID());mkdirSync(dir);
 const s=new Store(resolve(dir,'monitor.sqlite'));s.set('startBlock',10);s.event(ev());s.close();
 writeFileSync(resolve(dir,'status.json'),JSON.stringify({running:true,updatedAtUtc:new Date().toISOString(),lastRpcOkUtc:new Date().toISOString(),lastApiOkUtc:new Date().toISOString(),knownV2:1,newSinceMonitorStarted:1}));
 const run=(...args)=>{const r=spawnSync(process.execPath,[resolve(ROOT,'src/alerts.mjs'),...args],{env:{...process.env,SUSHI_ALERTS_DATA_DIR:dir},encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const first=run();assert.equal(first.notify,true);assert.equal(first.notifications.length,1);assert.equal(first.notifications[0].address,event.address);
 assert.equal(run('--ack',first.snapshotId).acknowledged,first.snapshotId);assert.equal(run().notify,false);
 writeFileSync(resolve(dir,'status.json'),JSON.stringify({running:false,updatedAtUtc:new Date().toISOString()}));
 const unhealthy=run();assert.equal(unhealthy.notify,true);assert.equal(unhealthy.issues[0].kind,'MONITOR_UNHEALTHY');run('--ack',unhealthy.snapshotId);assert.equal(run().notify,false);
 writeFileSync(resolve(dir,'stop.flag'),'intentional');assert.equal(run().intentionalStop,true);
 for(const name of ['monitor.sqlite','monitor.sqlite-wal','monitor.sqlite-shm','status.json','heartbeat-state.json','heartbeat-pending.json','stop.flag']){const path=resolve(dir,name);if(existsSync(path))unlinkSync(path);}
 const {rmdirSync}=await import('node:fs');rmdirSync(dir);
});
