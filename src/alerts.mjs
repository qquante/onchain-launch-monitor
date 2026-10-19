import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {ROOT,atomic,utc,json} from './core.mjs';
const dir=process.env.SUSHI_ALERTS_DATA_DIR?resolve(process.env.SUSHI_ALERTS_DATA_DIR):resolve(ROOT,'data'),statePath=resolve(dir,'heartbeat-state.json'),pendingPath=resolve(dir,'heartbeat-pending.json');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
if(process.argv[2]==='--ack'){
 const pending=read(pendingPath);if(pending.snapshotId!==process.argv[3])throw Error('Snapshot acknowledgement mismatch');
 atomic(statePath,pending.nextState);console.log(json({acknowledged:pending.snapshotId}));process.exit(0);
}
if(existsSync(resolve(dir,'stop.flag'))){console.log(json({intentionalStop:true,notify:false}));process.exit(0);}
const state=existsSync(statePath)?read(statePath):{lastOutboxId:0,lastIssueFingerprint:null};
const status=existsSync(resolve(dir,'status.json'))?read(resolve(dir,'status.json')):null;
const issues=[];let notifications=[],lastId=state.lastOutboxId;
if(!status||!status.running||Date.now()-Date.parse(status.updatedAtUtc)>120000||!status.lastRpcOkUtc||Date.now()-Date.parse(status.lastRpcOkUtc)>120000)issues.push({kind:'MONITOR_UNHEALTHY',detail:status?.lastError||'Monitor sem atualização RPC há mais de 2 minutos.'});
if(status?.lastApiOkUtc&&Date.now()-Date.parse(status.lastApiOkUtc)>180000)issues.push({kind:'API_UNHEALTHY'});
if(status?.contractAttention)issues.push(status.contractAttention);
if(status?.releaseAttention)issues.push(status.releaseAttention);
if(existsSync(resolve(dir,'monitor.sqlite'))){
 const db=new DatabaseSync(resolve(dir,'monitor.sqlite'),{readOnly:true,timeout:5000});
 const rows=db.prepare('SELECT id,kind,payload FROM outbox WHERE id>? ORDER BY id').all(state.lastOutboxId);
 for(const row of rows){lastId=row.id;const e=JSON.parse(row.payload);
  if(row.kind!=='REORG_REMOVED'&&!db.prepare('SELECT 1 FROM events WHERE canonical=1 AND address=? AND block_hash=?').get(e.address,e.blockHash))continue;
  const api=db.prepare('SELECT payload FROM api_tokens WHERE address=?').get(e.address);
  notifications.push({id:row.id,kind:row.kind,provider:e.provider,name:e.name,symbol:e.symbol,address:e.address,createdAtUtc:e.createdAtUtc,firstObservedAtUtc:e.firstObservedAtUtc,blockNumber:e.blockNumber,transactionIndex:e.transactionIndex,logIndex:e.logIndex,blockHash:e.blockHash,transactionHash:e.transactionHash,transactionUrl:'https://robinhoodchain.blockscout.com/tx/'+e.transactionHash,afterPublicLaunch:status?.publicLaunchAtUtc?Date.parse(e.createdAtUtc)>=Date.parse(status.publicLaunchAtUtc):null,links:api?JSON.parse(api.payload).metadata?.links:[]});
 }db.close();
}
const stableIssues=issues.map(({atUtc,...rest})=>rest),fingerprint=createHash('sha256').update(json(stableIssues)).digest('hex');
const changes=fingerprint!==state.lastIssueFingerprint;
const result={snapshotId:createHash('sha256').update(json({lastId,fingerprint,at:utc()})).digest('hex'),checkedAtUtc:utc(),notify:notifications.length>0||(changes&&issues.length>0)||(changes&&state.hadIssues===true),notifications,issues:changes?issues:[],recovered:changes&&state.hadIssues===true&&issues.length===0,status:status?{running:status.running,updatedAtUtc:status.updatedAtUtc,lastRpcOkUtc:status.lastRpcOkUtc,knownV2:status.knownV2,newTokens:status.newSinceMonitorStarted,publicLaunchAtUtc:status.publicLaunchAtUtc}:null,nextState:{lastOutboxId:lastId,lastIssueFingerprint:fingerprint,hadIssues:issues.length>0,acknowledgedAtUtc:utc()}};
atomic(pendingPath,result);console.log(json(result));
