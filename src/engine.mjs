import { number,hex,decodeLaunch,utc } from './core.mjs';
import { stableRange } from './network.mjs';
export class Engine {
 constructor(c,rpc,store){this.c=c;this.rpc=rpc;this.store=store;this.chunk=c.chunkBlocks;}
 async initialize(){
  const head=number(await this.rpc.call('eth_blockNumber'));
  if(this.store.get('startBlock')===null){this.store.set('startBlock',head);this.store.set('monitorStartedAtUtc',utc());}
  this.store.set('publicLaunchAtUtc',this.c.publicLaunchAtUtc);
  if(!this.store.get('cursor')){
   const block=await this.rpc.call('eth_getBlockByNumber',[hex(Math.max(0,head-this.c.reorgWindowBlocks)),false]);
   if(!block)throw Error('Initial block unavailable');
   this.store.commitRange([],block);this.store.set('coverageStartBlock',number(block.number)+1);
  }return head;
 }
 async repairReorg(){
  const cursor=this.store.get('cursor');const actual=await this.rpc.call('eth_getBlockByNumber',[hex(cursor.block),false]);
  if(actual&&actual.hash.toLowerCase()===cursor.hash)return false;
  for(const anchor of this.store.anchors()){
   const now=await this.rpc.call('eth_getBlockByNumber',[hex(anchor.block),false]);
   if(now&&now.hash.toLowerCase()===anchor.hash){this.store.rollback(anchor);return true;}
  }
  // No durable common ancestor: do not silently skip a potentially deep reorg.
  throw Error('REORG_REQUIRES_BACKFILL: no matching saved anchor');
 }
 async scanOnce(){
  await this.repairReorg();
  const head=number(await this.rpc.call('eth_blockNumber'));const cursor=this.store.get('cursor');
  if(head<=cursor.block)return {head,cursor:cursor.block,events:0};
  const to=Math.min(head,cursor.block+this.chunk);
  let range;
  try{range=await stableRange(this.rpc,this.c,cursor.block+1,to);}
  catch(e){if(/limit|range|too large|timed out/i.test(e.message))this.chunk=Math.max(1,Math.floor(this.chunk/2));throw e;}
  const events=[];
  for(const log of range.logs){
   let ts=log.blockTimestamp;
   if(!ts || number(ts)===0){const b=await this.rpc.call('eth_getBlockByNumber',[log.blockNumber,false]);if(!b||b.hash!==log.blockHash)throw Error('Log/header mismatch');ts=b.timestamp;}
   events.push(decodeLaunch(log,this.c,ts));
  }
  events.sort((a,b)=>a.blockNumber-b.blockNumber||a.transactionIndex-b.transactionIndex||a.logIndex-b.logIndex);
  this.store.commitRange(events,range.anchor);
  this.chunk=Math.min(this.c.chunkBlocks,Math.max(this.chunk+10,this.chunk*2));
  return {head,cursor:to,events:events.length};
 }
}

