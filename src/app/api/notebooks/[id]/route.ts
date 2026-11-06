export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {boundedJson} from '@/lib/platform';
import * as store from '@/lib/file-store.cjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
async function target(params:Promise<{id:string}>) {
  const session=await getSession();
  if(!session)return null;
  const id=(await params).id;
  if(!store.segment(id))throw new Error('Invalid notebook id');
  return {session,id,file:path.join(store.dataDir(),session.id,id+'.json')};
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try {
    const row=await target(params);if(!row)return NextResponse.json({error:'Unauthorized'},{status:401});
    const raw=await fs.readFile(row.file,'utf8');
    return NextResponse.json(JSON.parse(raw));
  }catch{return NextResponse.json({error:'Notizbuch nicht verfügbar'},{status:404});}
}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  try {
    const row=await target(params);if(!row)return NextResponse.json({error:'Unauthorized'},{status:401});
    // Next's proxy truncates bodies above its limit, so reject oversized saves by header first
    if(Number(request.headers.get('content-length')||0)>20*1024*1024)return NextResponse.json({error:'Notizbuch ist zu groß'},{status:413});
    const body=await boundedJson(request,20*1024*1024);
    const lock='notebook-'+createHash('sha256').update(row.session.id+':'+row.id).digest('hex');
    await store.lock(lock,async()=>store.atomic(row.file,body));
    return NextResponse.json({success:true,id:row.id});
  }catch(error){
    // Distinguish "too large" so the client can tell the teacher what to do
    if(error instanceof Error&&error.message==='Body limit')return NextResponse.json({error:'Notizbuch ist zu groß'},{status:413});
    return NextResponse.json({error:'Notizbuch konnte nicht gespeichert werden'},{status:400});
  }
}
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  try {
    const row=await target(params);if(!row)return NextResponse.json({error:'Unauthorized'},{status:401});
    const lock='notebook-'+createHash('sha256').update(row.session.id+':'+row.id).digest('hex');
    await store.lock(lock,async()=>fs.unlink(row.file));
    return NextResponse.json({success:true});
  }catch{return NextResponse.json({error:'Notizbuch nicht verfügbar'},{status:404});}
}
