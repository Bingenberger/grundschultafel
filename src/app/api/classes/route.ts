export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {boundedJson} from '@/lib/platform';
import * as store from '@/lib/file-store.cjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Class lists of a teacher (for "Namen ziehen" / "Gruppen bilden"). Stored next to the
// notebooks but in a sub folder, so the notebook list does not pick the file up.
const MAX_CLASSES=20;
const MAX_STUDENTS=60;
const MAX_NAME=60;

interface ClassList {name:string;students:string[]}

const file=(userId:string)=>path.join(store.dataDir(),userId,'settings','classes.json');

function sanitize(body:unknown):ClassList[] {
  const classes=(body as {classes?:unknown})?.classes;
  if(!Array.isArray(classes)||classes.length>MAX_CLASSES)throw new Error('Invalid classes');
  return classes.map(entry=>{
    const name=typeof entry?.name==='string'?entry.name.trim().slice(0,MAX_NAME):'';
    const students=Array.isArray(entry?.students)?entry.students:[];
    if(students.length>MAX_STUDENTS)throw new Error('Too many students');
    return {
      name:name||'Klasse',
      students:students.filter((s:unknown):s is string=>typeof s==='string').map((s:string)=>s.trim().slice(0,MAX_NAME)).filter(Boolean),
    };
  });
}

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const raw=JSON.parse(await fs.readFile(file(session.id),'utf8'));
    return NextResponse.json({classes:sanitize(raw)});
  }catch(error){
    if((error as NodeJS.ErrnoException).code==='ENOENT')return NextResponse.json({classes:[]});
    return NextResponse.json({error:'Klassenlisten nicht verfügbar'},{status:503});
  }
}

export async function PUT(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const classes=sanitize(await boundedJson(request,256*1024));
    const lock='classes-'+createHash('sha256').update(session.id).digest('hex');
    await store.lock(lock,async()=>store.atomic(file(session.id),{classes}));
    return NextResponse.json({classes});
  }catch{
    return NextResponse.json({error:'Klassenlisten konnten nicht gespeichert werden'},{status:400});
  }
}
