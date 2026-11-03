export const dynamic='force-dynamic';
import {NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {boundedBody} from '@/lib/platform';
import * as mobile from '@/lib/mobile-store.cjs';
export async function POST(request:Request) {
  try {
    const bytes=await boundedBody(request,6*1024*1024);
    const form=await new Response(bytes as BodyInit,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
    const token=form.get('token');
    const image=form.get('image');
    if(typeof token!=='string'||!(image instanceof File)) throw new Error('Invalid upload');
    const url=await mobile.upload(token,Buffer.from(await image.arrayBuffer()));
    return NextResponse.json({success:true,url});
  } catch {return NextResponse.json({error:'Upload ungültig, abgelaufen oder belegt. PNG, JPEG oder WebP bis 5 MiB verwenden.'},{status:400});}
}
export async function GET(request:Request) {
  const session=await getSession();
  if(!session) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const token=new URL(request.url).searchParams.get('token');
    const imageUrl=await mobile.poll(token,session.id);
    return NextResponse.json({imageUrl});
  } catch {return NextResponse.json({error:'Upload nicht verfügbar'},{status:404});}
}
