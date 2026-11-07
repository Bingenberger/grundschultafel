export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import fs from 'node:fs/promises';
import {getSession} from '@/lib/session';
import * as store from '@/lib/file-store.cjs';
import {readMeta,metaFile,contentFile} from '@/lib/templateStore';

// Content of a template, used to open an own copy
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=(await params).id;
  const meta=await readMeta(id);
  if(!meta)return NextResponse.json({error:'Vorlage nicht gefunden'},{status:404});
  try {
    const content=JSON.parse(await fs.readFile(contentFile(id),'utf8'));
    return NextResponse.json({meta,pages:content.pages,journalImages:content.journalImages??[]});
  }catch{
    return NextResponse.json({error:'Vorlage nicht verfügbar'},{status:404});
  }
}

// Withdraw a template: its owner or an admin. Copies colleagues already opened stay.
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  const id=(await params).id;
  const meta=await readMeta(id);
  if(!meta)return NextResponse.json({error:'Vorlage nicht gefunden'},{status:404});
  if(meta.ownerId!==session.id&&session.role!=='admin')return NextResponse.json({error:'Nur die Erstellerin oder der Admin kann diese Vorlage entfernen'},{status:403});
  await store.lock('templates',async()=>{
    for(const file of [metaFile(id),contentFile(id)]){
      try{await fs.unlink(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    }
  });
  return NextResponse.json({success:true});
}
