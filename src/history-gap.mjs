import {hex,number,decodeLaunch,utc} from './core.mjs';
import {stableRange} from './network.mjs';
// Fill the snapshot-to-live interval without moving the live scanner's cursor.
export async function reconcileHistoricalGap(c,rpc,db){
 const h=db.get('historicalCoverage'),liveStart=db.get('coverageStartBlock');
 if(!h?.complete||!h.ok||liveStart===null)return null;
 const toBlock=liveStart-1;
 let p=db.get('historyBridge')||{fromBlock:h.toBlock+1,toBlock,cursor:{block:h.toBlock,hash:h.anchorHash},events:0,complete:false};
 if(p.complete)return p;
 const prior=await rpc.call('eth_getBlockByNumber',[hex(p.cursor.block),false]);
 if(prior?.hash.toLowerCase()!==p.cursor.hash.toLowerCase())throw Error('Historical bridge anchor changed; explicit backfill required');
 while(p.cursor.block<toBlock){
  const to=Math.min(toBlock,p.cursor.block+c.chunkBlocks),range=await stableRange(rpc,c,p.cursor.block+1,to),events=[];
  for(const l of range.logs){const b=await rpc.call('eth_getBlockByNumber',[l.blockNumber,false]);if(!b||b.hash.toLowerCase()!==l.blockHash.toLowerCase())throw Error('Bridge log/header mismatch');events.push(decodeLaunch(l,c,b.timestamp));}
  p={...p,cursor:{block:number(range.anchor.number),hash:range.anchor.hash.toLowerCase()},events:p.events+events.length};
  db.transaction(()=>{for(const e of events)db.event(e,{emit:false});db.set('historyBridge',p);});
 }
 p={...p,complete:true,finishedAtUtc:utc()};db.set('historyBridge',p);return p;
}
