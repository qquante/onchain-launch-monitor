import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {ROOT,clean} from './core.mjs';
const path=resolve(ROOT,'data/status.json');
if(!existsSync(path)){console.log('Monitor ainda não iniciou.');process.exit(1);}
const s=JSON.parse(readFileSync(path,'utf8'));const age=Date.now()-Date.parse(s.updatedAtUtc);
console.log(JSON.stringify({...s,statusAgeMs:age,statusFresh:age<30000},null,2));
const p=resolve(ROOT,'data/new-tokens.json');if(existsSync(p)){const d=JSON.parse(readFileSync(p,'utf8'));for(const t of d.tokens.slice(-20))console.log(t.provider,clean(t.name),t.address,t.createdAtUtc);}
if(age>60000||!s.running||!s.lastRpcOkUtc||Date.now()-Date.parse(s.lastRpcOkUtc)>60000)process.exitCode=2;

