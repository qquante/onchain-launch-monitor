import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {config,ROOT,number,hex,utc,atomic,decodeLaunch,compareEvents,checkApiMatch} from './core.mjs';
import {Rpc,SushiApi} from './network.mjs';
import {Store} from './store.mjs';
const c=config(),rpc=new Rpc(c),api=new SushiApi(c),read=p=>JSON.parse(readFileSync(p,'utf8'));
const h=read(resolve(ROOT,'validation/history-latest.json')),history=read(resolve(h.directory,'events.json'));
let next=h.fromBlock;
for(const name of readdirSync(h.directory).filter(n=>/^\d+-\d+\.json$/.test(n)).sort((a,b)=>Number(a.split('-')[0])-Number(b.split('-')[0]))){const [from,to]=name.replace('.json','').split('-').map(Number);if(from>next)throw Error('History gap before '+from);next=Math.max(next,to+1);}
if(next!==h.toBlock+1)throw Error('History range incomplete');
const anchor=await rpc.call('eth_getBlockByNumber',[hex(h.toBlock),false]);if(anchor.hash!==h.anchorHash)throw Error('Historical anchor changed');
const targets=history.filter(e=>e.provider==='SUSHI_V2'||h.onchainMissingApi.includes(e.address));
const receipts=await rpc.batch(targets.map(e=>({method:'eth_getTransactionReceipt',params:[e.transactionHash]})));
const headers=await rpc.batch(receipts.map(r=>({method:'eth_getBlockByNumber',params:[r.blockNumber,false]})));
const verified=[];
for(let i=0;i<targets.length;i++){
 const e=targets[i],r=receipts[i],b=headers[i];if(!r||r.status!=='0x1'||r.blockHash!==b.hash)throw Error('Noncanonical or failed receipt');
 const l=r.logs.find(l=>l.address.toLowerCase()===e.factoryAddress&&number(l.logIndex)===e.logIndex);
 const decoded=decodeLaunch(l,c,b.timestamp);for(const k of ['address','provider','transactionHash','createdAtUtc','blockHash','name','symbol'])if(decoded[k]!==e[k])throw Error('Receipt mismatch '+k);
 verified.push(decoded);
}
atomic(resolve(ROOT,'validation/all-v2-and-extra-receipts.json'),{checkedAtUtc:utc(),receipts,headers,events:verified});
const db=new Store(resolve(ROOT,'data/monitor.sqlite'));
const all=db.events(),known=new Map(all.map(e=>[e.address,e])),nodes=[];let pages=0;
for await(const p of api.pages()){pages++;nodes.push(...p.edges.map(e=>e.node));}
const missing=[],mismatches=[];for(const t of nodes){const e=known.get(t.address.toLowerCase());if(!e)missing.push(t.address);else try{checkApiMatch(t,e);}catch(err){mismatches.push({address:t.address,error:err.message});}}
const status=read(resolve(ROOT,'data/status.json'));
const result={checkedAtUtc:utc(),ok:h.ok&&h.complete&&missing.length===0&&mismatches.length===0&&status.historyBridge?.complete===true&&status.running&&Date.now()-Date.parse(status.lastRpcOkUtc)<30000,historyRange:[h.fromBlock,h.toBlock],historyAnchorCanonical:true,historyCount:history.length,byProvider:Object.fromEntries(c.factories.map(f=>[f.provider,history.filter(e=>e.provider===f.provider).length])),apiPages:pages,apiCount:nodes.length,missing,mismatches,allV2ReceiptsVerified:verified.filter(e=>e.provider==='SUSHI_V2').length,apiOmissionsVerified:verified.filter(e=>h.onchainMissingApi.includes(e.address)).map(e=>({name:e.name,symbol:e.symbol,address:e.address,provider:e.provider,createdAtUtc:e.createdAtUtc,transactionHash:e.transactionHash})),historyBridge:status.historyBridge,liveStatus:status};
atomic(resolve(ROOT,'validation/acceptance.json'),result);
const v2=all.filter(e=>e.provider==='SUSHI_V2').sort(compareEvents);
const rows=['# Histórico Sushi Launch V2 validado','','Consultado UTC: '+utc(),'','14 tokens históricos não representam os primeiros após a abertura pública de 11/09. Nomes são autodeclarados; não demonstram afiliação.','','| Ordem on-chain | Token | Criação UTC | Contrato | Transação |','|---|---|---|---|---|'];
for(const [i,e] of v2.entries())rows.push('| '+(i+1)+' | '+e.name.replaceAll('|','/')+' ('+e.symbol.replaceAll('|','/')+') | '+e.createdAtUtc+' | '+e.address+' | [recibo](https://robinhoodchain.blockscout.com/tx/'+e.transactionHash+') |');
atomic(resolve(ROOT,'V2_HISTORICO_VALIDADO.md'),rows.join('\n')+'\n');
db.close();console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=2;
