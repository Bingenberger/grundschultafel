export const dynamic='force-dynamic';
import {NextRequest,NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {galleryEnabled,galleryImage,statusOf} from '@/lib/gallery';

// Thumbnail or display image of the Bildergalerie; only /media/thumbnails/… and /media/display/….
// Inserted images become data URLs in the notebook, so saved notebooks never depend on the gallery.
export async function GET(request:NextRequest){
  const session=await getSession();
  if(!session)return new NextResponse(null,{status:401});
  if(!galleryEnabled())return new NextResponse(null,{status:503});
  try {
    const {type,body}=await galleryImage(request.nextUrl.searchParams.get('path')||'');
    return new NextResponse(new Uint8Array(body),{headers:{
      'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=86400',
    }});
  }catch(error){
    const status=statusOf(error);
    return new NextResponse(null,{status:status===400||status===415?status:404});
  }
}
