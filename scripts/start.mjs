import fs from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url);
if(process.env.SESSION_SECRET_FILE) {
  if(process.env.SESSION_SECRET) throw new Error('Configure one session key source');
  process.env.SESSION_SECRET=fs.readFileSync(process.env.SESSION_SECRET_FILE,'utf8').trim();
}
if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32) throw new Error('Private session key required');
const origin=new URL(process.env.BASE_URL||'http://localhost:3000');
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash) throw new Error('Invalid public origin');
process.umask(0o077);
const child=spawn(process.execPath,['server.js'],{stdio:'inherit',env:{...process.env,HOSTNAME:'0.0.0.0'}});
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>child.kill(signal));
child.on('exit',(code)=>process.exit(code??1));
