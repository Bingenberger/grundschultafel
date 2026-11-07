export const dynamic='force-dynamic';
import {NextRequest,NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {WOERTERBUCH_ORIGIN,MEDIA_PATH,woerterbuchUrl,fetchWoerterbuch} from '@/lib/woerterbuch';

const TYPES=['image/webp','image/png','image/jpeg','audio/mpeg','audio/mp3'];

// Picture or recording of a dictionary word (only /static/images/… and /static/audio/…)
export async function GET(request:NextRequest){
  const session=await getSession();
  if(!session)return new NextResponse(null,{status:401});
  if(!WOERTERBUCH_ORIGIN)return new NextResponse(null,{status:503});
  const path=request.nextUrl.searchParams.get('path')||'';
  if(!MEDIA_PATH.test(path))return new NextResponse(null,{status:400});
  try {
    const {res,body}=await fetchWoerterbuch(woerterbuchUrl(path),8*1024*1024);
    const type=(res.headers.get('content-type')||'').split(';')[0];
    if(!TYPES.includes(type))return new NextResponse(null,{status:415});
    return new NextResponse(new Uint8Array(body),{headers:{
      'Content-Type':type,'X-Content-Type-Options':'nosniff',
      // pictures and recordings rarely change; let the board cache them for a day
      'Cache-Control':'private, max-age=86400',
    }});
  }catch{
    return new NextResponse(null,{status:404});
  }
}
