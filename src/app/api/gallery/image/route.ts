import {GALLERY_ORIGIN} from '@/lib/gallery';
import {boundedBody} from '@/lib/platform';
export const dynamic='force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const src = searchParams.get('src');

    if (!src) {
      return NextResponse.json({ error: 'Invalid gallery asset request' }, { status: 400 });
    }

    if(!GALLERY_ORIGIN)return NextResponse.json({error:'Galerie derzeit nicht verfügbar'},{status:503});
    const remoteUrl = new URL(src);
    if (remoteUrl.origin !== new URL(GALLERY_ORIGIN).origin || remoteUrl.username || remoteUrl.password || !/^\/static\/(display|thumbnails)\//.test(remoteUrl.pathname)) {
      return NextResponse.json({ error: 'Invalid gallery asset source' }, { status: 400 });
    }

    const remoteRes = await fetch(remoteUrl.toString(), {
      headers: {
        'User-Agent': 'TafelPopafel/1.0'
      },
      cache: 'no-store',redirect:'error',signal:AbortSignal.timeout(5000),
    });

    if (!remoteRes.ok) {
      return NextResponse.json({ error: 'Gallery asset not found' }, { status: 404 });
    }

    if(!['image/png','image/jpeg','image/webp','image/gif'].includes((remoteRes.headers.get('content-type')||'').split(';')[0]))return NextResponse.json({error:'Bildformat nicht verfügbar'},{status:415});
    const buffer = await boundedBody(remoteRes as any,16*1024*1024);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': remoteRes.headers.get('content-type') || 'image/webp',
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options':'nosniff',
      },
    });
  } catch (error) {
    console.error('Gallery asset unavailable');
    return NextResponse.json({ error: 'Gallery asset not found' }, { status: 404 });
  }
}
