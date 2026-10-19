import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync,readFileSync,writeFileSync,openSync,closeSync,unlinkSync,mkdirSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
import {ROOT,json,utc} from './core.mjs';
const dir=resolve(ROOT,'data');mkdirSync(dir,{recursive:true});const lock=resolve(dir,'supervisor.lock');
if(existsSync(lock)){const old=JSON.parse(readFileSync(lock,'utf8'));let alive=false;try{process.kill(old.pid,0);alive=true;}catch{}if(alive)throw Error('Supervisor already running '+old.pid);unlinkSync(lock);}
const fd=openSync(lock,'wx');writeFileSync(fd,json({pid:process.pid,startedAtUtc:utc()}));closeSync(fd);
let stop=false,child;
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stop=true;child?.kill('SIGTERM');});
try{
 while(!stop&&!existsSync(resolve(dir,'stop.flag'))){
  const output=openSync(resolve(dir,'monitor.log'),'a');
  child=spawn(process.execPath,[resolve(ROOT,'src/monitor.mjs')],{cwd:ROOT,windowsHide:true,stdio:['ignore',output,output]});
  console.log(utc(),'started monitor PID',child.pid);
  const exit=await new Promise(r=>{child.once('error',e=>r({error:e.message}));child.once('exit',(code,signal)=>r({code,signal}));});
  closeSync(output);console.log(utc(),'monitor exit',json(exit));child=null;
  if(!stop&&!existsSync(resolve(dir,'stop.flag')))await sleep(10000);
 }
}finally{if(existsSync(lock))unlinkSync(lock);console.log(utc(),'supervisor stopped');}

