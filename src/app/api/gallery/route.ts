export const dynamic='force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { searchGallery } from '@/lib/gallery';

export async function GET(request: NextRequest) {
  try {
    if(!process.env.GALLERY_ORIGIN)return NextResponse.json({error:'Galerie derzeit nicht verfügbar'},{status:503});
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const result = await searchGallery(query, page);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Gallery search unavailable');
    return NextResponse.json({ error: 'Failed to fetch gallery' }, { status: 500 });
  }
}
