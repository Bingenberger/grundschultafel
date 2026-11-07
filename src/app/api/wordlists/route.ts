export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {getSession} from '@/lib/session';
import {boundedJson} from '@/lib/platform';
import * as store from '@/lib/file-store.cjs';

// Own word lists of a teacher (Blitzlesen, Silbenrutsche), stored next to the class lists
const MAX_LISTS=50;
const MAX_WORDS=200;
const MAX_WORD=60;

interface StoredList {id:string;name:string;words:string[]}
const file=(userId:string)=>path.join(store.dataDir(),userId,'settings','wordlists.json');

function sanitize(body:unknown):StoredList[]{
  const lists=(body as {lists?:unknown})?.lists;
  if(!Array.isArray(lists)||lists.length>MAX_LISTS)throw new Error('Invalid lists');
  return lists.map((entry)=>{
    const name=typeof entry?.name==='string'?entry.name.trim().slice(0,80):'';
    const words=Array.isArray(entry?.words)?entry.words:[];
    if(words.length>MAX_WORDS)throw new Error('Too many words');
    return {
      id:typeof entry?.id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(entry.id)?entry.id:randomUUID(),
      name:name||'Wortliste',
      words:words.filter((w:unknown):w is string=>typeof w==='string').map((w:string)=>w.trim().slice(0,MAX_WORD)).filter(Boolean),
    };
  });
}

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    return NextResponse.json({lists:sanitize(JSON.parse(await fs.readFile(file(session.id),'utf8')))});
  }catch(error){
    if((error as NodeJS.ErrnoException).code==='ENOENT')return NextResponse.json({lists:[]});
    return NextResponse.json({error:'Wortlisten nicht verfügbar'},{status:503});
  }
}

export async function PUT(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const lists=sanitize(await boundedJson(request,512*1024));
    const lock='wordlists-'+createHash('sha256').update(session.id).digest('hex');
    await store.lock(lock,async()=>store.atomic(file(session.id),{lists}));
    return NextResponse.json({lists});
  }catch{
    return NextResponse.json({error:'Wortlisten konnten nicht gespeichert werden'},{status:400});
  }
}
