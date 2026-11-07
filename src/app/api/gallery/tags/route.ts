export const dynamic='force-dynamic';
import {NextRequest,NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {galleryEnabled,galleryTags} from '@/lib/gallery';

// Tag suggestions of the Bildergalerie, e.g. /api/gallery/tags?q=ap
export async function GET(request:NextRequest){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!galleryEnabled())return NextResponse.json({error:'Galerie derzeit nicht verfügbar'},{status:503});
  try {
    return NextResponse.json({tags:await galleryTags((request.nextUrl.searchParams.get('q')||'').slice(0,50))});
  }catch{
    return NextResponse.json({error:'Galerie derzeit nicht erreichbar'},{status:502});
  }
}
