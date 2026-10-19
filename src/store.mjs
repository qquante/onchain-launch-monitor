import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { json, utc, cohort } from './core.mjs';
export class Store {
 constructor(path){if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path,{timeout:5000});
 this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS api_tokens(address TEXT PRIMARY KEY,provider TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,address TEXT NOT NULL,provider TEXT NOT NULL,block INTEGER NOT NULL,tx_index INTEGER NOT NULL,log_index INTEGER NOT NULL,block_hash TEXT NOT NULL,canonical INTEGER NOT NULL,first_seen TEXT NOT NULL,payload TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS event_order ON events(canonical,block,tx_index,log_index);
 CREATE TABLE IF NOT EXISTS anchors(block INTEGER PRIMARY KEY,hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT UNIQUE NOT NULL,kind TEXT NOT NULL,address TEXT NOT NULL,created_at TEXT NOT NULL,payload TEXT NOT NULL,printed INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS audits(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,created_at TEXT NOT NULL,payload TEXT NOT NULL);
 `);}
 get(k){const r=this.db.prepare('SELECT value FROM settings WHERE key=?').get(k);return r?JSON.parse(r.value):null;}
 set(k,v){this.db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,json(v));}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 api(t,now=utc()){const address=t.address.toLowerCase();this.db.prepare('INSERT INTO api_tokens VALUES (?,?,?,?,?) ON CONFLICT(address) DO UPDATE SET last_seen=excluded.last_seen,payload=excluded.payload,provider=excluded.provider').run(address,t.provider,now,now,json(t));}
 apiToken(address){const r=this.db.prepare('SELECT payload FROM api_tokens WHERE address=?').get(address);return r?JSON.parse(r.payload):null;}
 audit(kind,payload){this.db.prepare('INSERT INTO audits(kind,created_at,payload) VALUES (?,?,?)').run(kind,utc(),json(payload));}
 queue(key,kind,e){this.db.prepare('INSERT OR IGNORE INTO outbox(event_key,kind,address,created_at,payload) VALUES (?,?,?,?,?)').run(key,kind,e.address,utc(),json(e));}
 event(e,{now=utc(),emit=true}={}){
  const id=[e.chainId,e.blockHash,e.transactionHash,e.logIndex].join(':');
  const previous=this.db.prepare('SELECT canonical,first_seen FROM events WHERE id=?').get(id);
  if(e.removed){if(previous?.canonical){this.db.prepare('UPDATE events SET canonical=0 WHERE id=?').run(id);if(emit&&cohort(e,this.get('startBlock')??Number.MAX_SAFE_INTEGER,null).sinceMonitorStart)this.queue(id+':removed','REORG_REMOVED',e);}return;}
  const older=this.db.prepare('SELECT id,payload FROM events WHERE address=? AND canonical=1 AND id<>?').all(e.address,id);
  for(const o of older){this.db.prepare('UPDATE events SET canonical=0 WHERE id=?').run(o.id);if(emit&&JSON.parse(o.payload).sinceMonitorStart)this.queue(o.id+':removed','REORG_REMOVED',JSON.parse(o.payload));}
  const firstSeen=previous?.first_seen||now;
  const value={...e,firstObservedAtUtc:firstSeen,...cohort(e,this.get('startBlock')??Number.MAX_SAFE_INTEGER,this.get('publicLaunchAtUtc'))};
  this.db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET canonical=1,payload=excluded.payload').run(id,e.address,e.provider,e.blockNumber,e.transactionIndex,e.logIndex,e.blockHash,1,firstSeen,json(value));
  if(emit&&(!previous||!previous.canonical)&&value.sinceMonitorStart)this.queue(id+(previous?':reinstated':':new'),previous?'REORG_REINSTATED':'NEW_TOKEN',value);
  return value;
 }
 commitRange(events,anchor,{emit=true}={}){
  this.transaction(()=>{for(const e of events)this.event(e,{emit});this.db.prepare('INSERT OR REPLACE INTO anchors VALUES (?,?)').run(Number(BigInt(anchor.number)),anchor.hash.toLowerCase());this.set('cursor',{block:Number(BigInt(anchor.number)),hash:anchor.hash.toLowerCase()});});
 }
 rollback(ancestor){
  this.transaction(()=>{
   for(const r of this.db.prepare('SELECT id,payload FROM events WHERE canonical=1 AND block>?').all(ancestor.block)){
    const e=JSON.parse(r.payload);this.db.prepare('UPDATE events SET canonical=0 WHERE id=?').run(r.id);
    if(e.sinceMonitorStart)this.queue(r.id+':removed','REORG_REMOVED',e);
   }
   this.db.prepare('DELETE FROM anchors WHERE block>?').run(ancestor.block);
   this.set('cursor',ancestor);this.audit('REORG_ROLLBACK',ancestor);
  });
 }
 anchors(){return this.db.prepare('SELECT block,hash FROM anchors ORDER BY block DESC').all();}
 events({provider=null,sinceStart=false,limit=100000}={}){
  let sql='SELECT payload FROM events WHERE canonical=1',params=[];
  if(provider){sql+=' AND provider=?';params.push(provider);}
  if(sinceStart){sql+=' AND block>?';params.push(this.get('startBlock')??Number.MAX_SAFE_INTEGER);}
  sql+=' ORDER BY block,tx_index,log_index LIMIT ?';params.push(limit);
  return this.db.prepare(sql).all(...params).map(r=>{const e=JSON.parse(r.payload);return {...e,...cohort(e,this.get('startBlock')??Number.MAX_SAFE_INTEGER,this.get('publicLaunchAtUtc')),api:this.apiToken(e.address)};});
 }
 pending(){return this.db.prepare('SELECT * FROM outbox WHERE printed=0 ORDER BY id').all();}
 printed(id){this.db.prepare('UPDATE outbox SET printed=1 WHERE id=?').run(id);}
 close(){this.db.close();}
}

