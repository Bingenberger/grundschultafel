import {NextResponse} from 'next/server';
import {authenticate,getUser} from '@/lib/users';
import {createSession} from '@/lib/session';
import {boundedJson} from '@/lib/platform';
import * as store from '@/lib/file-store.cjs';
import path from 'node:path';
import fs from 'node:fs';
async function attempt(username:string, failed?:boolean) {
  return store.lock('attempts',async()=>{
    const file=path.join(store.dataDir(),'login-attempts.json');
    let rows:Record<string,{count:number,until:number,start:number}>={};
    try{rows=JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    const key=(await getUser(username))?username.toLowerCase():'_unknown';
    const now=Date.now();const row=rows[key];
    if(failed===undefined)return !row||row.until<=now;
    if(!failed)delete rows[key];
    else {
      const current=!row||now-row.start>900000?{count:0,until:0,start:now}:row;
      current.count++;if(current.count>=5)current.until=now+900000;rows[key]=current;
    }
    for(const name of Object.keys(rows))if(now-rows[name].start>1800000&&rows[name].until<=now)delete rows[name];
    store.atomic(file,rows);return true;
  });
}
export async function POST(request:Request) {
  try {
    const {username,password}=await boundedJson(request);
    if(typeof username!=='string'||typeof password!=='string'||username.length>80||password.length>256) return NextResponse.json({error:'Ungültige Anmeldedaten'},{status:400});
    if(!await attempt(username))return NextResponse.json({error:'Zu viele Versuche. Bitte später erneut versuchen.'},{status:429,headers:{'Retry-After':'900'}});
    const user=await authenticate(username,password);
    if(!user){await attempt(username,true);return NextResponse.json({error:'Ungültige Anmeldedaten'},{status:401});}
    await attempt(username,false);
    await createSession({id:user.id,username:user.username,role:user.role,mustChangePassword:user.mustChangePassword??false},user.passwordHash);
    return NextResponse.json({success:true,redirect:user.mustChangePassword?'/change-password':'/'});
  }catch{return NextResponse.json({error:'Anmeldung fehlgeschlagen'},{status:400});}
}
