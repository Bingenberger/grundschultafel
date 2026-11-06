import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import * as store from '@/lib/file-store.cjs';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function GET(_request:Request,{params}:{params:Promise<{segments:string[]}>}){
  const session=await getSession();
  if(!session)return new NextResponse(null,{status:401});
  try{
    const segments=(await params).segments;
    if(!segments.length||segments.some(value=>!store.segment(value)))throw new Error('Invalid asset');
    if(!['backgrounds','journal','rs','gallery','uploads'].includes(segments[0]))throw new Error('Invalid category');
    if(segments[0]==='uploads'&&segments[1]!==session.id)throw new Error('Private asset');
    // Resolve symlinks on both sides, so a symlinked data/asset directory keeps working
    const root=await fs.realpath(path.resolve(store.assetDir()));
    const file=await fs.realpath(path.join(root,...segments));
    if(!file.startsWith(root+path.sep)||(await fs.stat(file)).size>16*1024*1024)throw new Error('Invalid asset');
    const types:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml'};
    const mime=types[path.extname(file).toLowerCase()];if(!mime)throw new Error('Invalid type');
    return new NextResponse(new Uint8Array(await fs.readFile(file)),{headers:{'Content-Type':mime,'X-Content-Type-Options':'nosniff',
      'Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
  }catch{return new NextResponse(null,{status:404});}
}
