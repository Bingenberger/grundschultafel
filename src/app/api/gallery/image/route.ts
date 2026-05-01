import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const src = searchParams.get('src');

    if (!src) {
      return NextResponse.json({ error: 'Invalid gallery asset request' }, { status: 400 });
    }

    const remoteUrl = new URL(src);
    if (remoteUrl.origin !== 'https://pix.foerster.rocks') {
      return NextResponse.json({ error: 'Invalid gallery asset source' }, { status: 400 });
    }

    const remoteRes = await fetch(remoteUrl.toString(), {
      headers: {
        'User-Agent': 'TafelPopafel/1.0'
      },
      cache: 'force-cache',
    });

    if (!remoteRes.ok) {
      return NextResponse.json({ error: 'Gallery asset not found' }, { status: 404 });
    }

    const buffer = await remoteRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': remoteRes.headers.get('content-type') || 'image/webp',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('Error serving gallery asset:', error);
    return NextResponse.json({ error: 'Gallery asset not found' }, { status: 404 });
  }
}
