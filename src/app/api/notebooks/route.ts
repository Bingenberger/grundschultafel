export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import * as store from '@/lib/file-store.cjs';
import fs from 'node:fs/promises';
import path from 'node:path';
// Notebooks can be many MB (inline images). The client always writes "name" as the first
// key, so read only the start of the file; fall back to a full parse for other layouts.
async function notebookName(file:string):Promise<string|undefined> {
  const handle=await fs.open(file,'r');
  try {
    const {buffer,bytesRead}=await handle.read(Buffer.alloc(4096),0,4096,0);
    const head=/^\s*\{\s*"name"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(buffer.subarray(0,bytesRead).toString('utf8'));
    if(head)return JSON.parse(head[1]);
  } finally {await handle.close();}
  const raw=JSON.parse(await fs.readFile(file,'utf8'));
  return typeof raw?.name==='string'?raw.name:undefined;
}
export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  const directory=path.join(store.dataDir(),session.id);
  try {
    const files=(await fs.readdir(directory)).filter(file=>file.endsWith('.json')&&store.segment(file.slice(0,-5)));
    const entries=await Promise.all(files.map(async file=>{
      const target=path.join(directory,file);
      try {
        return {id:file.slice(0,-5),name:(await notebookName(target))??file.slice(0,-5),updatedAt:(await fs.stat(target)).mtime.toISOString()};
      } catch(error) {
        // One damaged file must not hide all other notebooks
        console.error('Notizbuch nicht lesbar, wird übersprungen:',file,(error as Error).message);
        return null;
      }
    }));
    const notebooks=entries.filter((entry):entry is NonNullable<typeof entry>=>entry!==null);
    return NextResponse.json({notebooks:notebooks.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
  }catch(error){
    if((error as NodeJS.ErrnoException).code==='ENOENT')return NextResponse.json({notebooks:[]});
    return NextResponse.json({error:'Notizbücher derzeit nicht verfügbar'},{status:503});
  }
}
