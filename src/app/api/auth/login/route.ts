import {NextResponse} from 'next/server';
import {authenticate,getUser} from '@/lib/users';
import {createSession,knownDevice,rememberDevice} from '@/lib/session';
import {boundedJson} from '@/lib/platform';
import * as store from '@/lib/file-store.cjs';
import path from 'node:path';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const MAX_FAILURES=5;
const WINDOW_MS=15*60*1000;
type Attempts=Record<string,{count:number,until:number,start:number}>;

// Check and count in one locked step: parallel requests cannot all pass the check before
// any failure is recorded. Every attempt is counted up front; a success clears the counter.
async function reserveAttempt(key:string):Promise<boolean> {
  return store.lock('attempts',async()=>{
    const file=path.join(store.dataDir(),'login-attempts.json');
    let rows:Attempts={};
    try{rows=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    const now=Date.now();
    for(const name of Object.keys(rows))if(now-rows[name].start>2*WINDOW_MS&&rows[name].until<=now)delete rows[name];
    const row=rows[key];
    if(row&&row.until>now){store.atomic(file,rows);return false;}
    const current=!row||now-row.start>WINDOW_MS?{count:0,until:0,start:now}:row;
    current.count++;
    if(current.count>=MAX_FAILURES)current.until=now+WINDOW_MS;
    rows[key]=current;
    store.atomic(file,rows);
    return true;
  });
}
async function clearAttempts(key:string) {
  await store.lock('attempts',async()=>{
    const file=path.join(store.dataDir(),'login-attempts.json');
    let rows:Attempts={};
    try{rows=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(!(key in rows))return;
    delete rows[key];
    store.atomic(file,rows);
  });
}

export async function POST(request:Request) {
  try {
    const {username,password}=await boundedJson(request);
    if(typeof username!=='string'||typeof password!=='string'||username.length>80||password.length>256) return NextResponse.json({error:'Ungültige Anmeldedaten'},{status:400});
    const account=await getUser(username);
    // A device this account has logged in on before gets its own failure counter, so PIN
    // guessing elsewhere (the names are listed publicly) cannot lock the teacher out here.
    const device=account?await knownDevice():null;
    const key=!account?'_unknown'
      :device?.users.includes(account.id)?'device:'+createHash('sha256').update(device.nonce+':'+account.id).digest('hex')
      :username.toLowerCase();
    if(!await reserveAttempt(key))return NextResponse.json({error:'Zu viele Versuche. Bitte später erneut versuchen.'},{status:429,headers:{'Retry-After':'900'}});
    const user=await authenticate(username,password);
    if(!user)return NextResponse.json({error:'Ungültige Anmeldedaten'},{status:401});
    await clearAttempts(key);
    await createSession({id:user.id,username:user.username,role:user.role,mustChangePassword:user.mustChangePassword??false},user.passwordHash);
    await rememberDevice(user.id);
    return NextResponse.json({success:true,redirect:user.mustChangePassword?'/change-password':'/'});
  }catch{return NextResponse.json({error:'Anmeldung fehlgeschlagen'},{status:400});}
}
