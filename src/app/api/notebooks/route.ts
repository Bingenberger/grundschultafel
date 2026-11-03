export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import * as store from '@/lib/file-store.cjs';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  const directory=path.join(store.dataDir(),session.id);
  try {
    const files=(await fs.readdir(directory)).filter(file=>file.endsWith('.json')&&store.segment(file.slice(0,-5)));
    const notebooks=await Promise.all(files.map(async file=>{
      const target=path.join(directory,file);
      const raw=JSON.parse(await fs.readFile(target,'utf8'));
      return {id:file.slice(0,-5),name:typeof raw.name==='string'?raw.name:file.slice(0,-5),updatedAt:(await fs.stat(target)).mtime.toISOString()};
    }));
    return NextResponse.json({notebooks:notebooks.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
  }catch(error){
    if((error as NodeJS.ErrnoException).code==='ENOENT')return NextResponse.json({notebooks:[]});
    return NextResponse.json({error:'Notizbücher derzeit nicht verfügbar'},{status:503});
  }
}
