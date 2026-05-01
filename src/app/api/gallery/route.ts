import { NextRequest, NextResponse } from 'next/server';
import { searchGallery } from '@/lib/gallery';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const result = await searchGallery(query, page);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching gallery search:', error);
    return NextResponse.json({ error: 'Failed to fetch gallery' }, { status: 500 });
  }
}
