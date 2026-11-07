export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getSession} from '@/lib/session';
import {boundedJson} from '@/lib/platform';
import * as store from '@/lib/file-store.cjs';
import {listTemplates,metaFile,contentFile,sanitizeShare} from '@/lib/templateStore';
import type {TemplateMeta} from '@/lib/templates';

const LIMIT=20*1024*1024;

// All shared templates of the school (metadata only)
export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    return NextResponse.json({templates:await listTemplates()});
  }catch{
    return NextResponse.json({error:'Vorlagen derzeit nicht verfügbar'},{status:503});
  }
}

// Share a notebook as template. Sharing the same notebook again updates the existing
// template (only its owner may do that).
export async function POST(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(Number(request.headers.get('content-length')||0)>LIMIT)return NextResponse.json({error:'Tafelheft ist zu groß'},{status:413});
  let share;
  try {
    share=sanitizeShare(await boundedJson(request,LIMIT));
  }catch(error){
    if(error instanceof Error&&error.message==='Body limit')return NextResponse.json({error:'Tafelheft ist zu groß'},{status:413});
    return NextResponse.json({error:error instanceof Error?error.message:'Ungültige Freigabe'},{status:400});
  }
  try {
    const meta=await store.lock('templates',async()=>{
      const existing=share.sourceNotebookId
        ?(await listTemplates()).find(t=>t.ownerId===session.id&&t.sourceNotebookId===share.sourceNotebookId)
        :undefined;
      const now=new Date().toISOString();
      const id=existing?.id??randomUUID();
      const row:TemplateMeta={
        id,
        name:share.name,
        subject:share.subject,
        grades:share.grades,
        description:share.description,
        ownerId:session.id,
        ownerName:session.username,
        sourceNotebookId:share.sourceNotebookId,
        pageCount:share.pages.length,
        thumbnail:share.thumbnail,
        createdAt:existing?.createdAt??now,
        updatedAt:now,
      };
      store.atomic(contentFile(id),{name:share.name,pages:share.pages,journalImages:share.journalImages});
      store.atomic(metaFile(id),row);
      return row;
    });
    return NextResponse.json({template:meta,updated:meta.createdAt!==meta.updatedAt});
  }catch{
    return NextResponse.json({error:'Freigabe fehlgeschlagen'},{status:500});
  }
}

