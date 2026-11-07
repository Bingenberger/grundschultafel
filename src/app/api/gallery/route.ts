export const dynamic='force-dynamic';
import {NextRequest,NextResponse} from 'next/server';
import {getSession} from '@/lib/session';
import {galleryEnabled,searchGallery,statusOf} from '@/lib/gallery';

// Image search in the Bildergalerie (JSON-API v1), e.g. /api/gallery?q=apfel&tags=obst&page=2
export async function GET(request:NextRequest){
  const session=await getSession();
  if(!session)return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!galleryEnabled())return NextResponse.json({error:'Galerie derzeit nicht verfügbar'},{status:503});
  const params=request.nextUrl.searchParams;
  try {
    const result=await searchGallery({
      q:(params.get('q')||'').slice(0,100),
      tags:(params.get('tags')||'').split(',').filter(Boolean),
      page:Number(params.get('page')||'1'),
      perPage:Number(params.get('pageSize')||'36'),
    });
    return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('Gallery search unavailable');
    return NextResponse.json({error:'Galerie derzeit nicht erreichbar'},{status:statusOf(error)===400?400:502});
  }
}
