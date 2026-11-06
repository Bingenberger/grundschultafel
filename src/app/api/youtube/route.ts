export const dynamic='force-dynamic';
import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';

// Platform: key as a mounted secret file (YOUTUBE_API_KEY_FILE); standalone: YOUTUBE_API_KEY.
function youtubeKey() {
  const file = process.env.YOUTUBE_API_KEY_FILE;
  if (file) {
    try { return readFileSync(file, 'utf8').trim(); } catch { return ''; }
  }
  return (process.env.YOUTUBE_API_KEY || '').trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    if(process.env.TAFEL_YOUTUBE_ENABLED!=='1')return NextResponse.json({error:'Videosuche derzeit nicht verfügbar'},{status:503});
    const API_KEY = youtubeKey();
    if (!API_KEY) {
      return NextResponse.json({ error: 'Videosuche derzeit nicht verfügbar' }, { status: 503 });
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${API_KEY}`
    );

    if (!response.ok) {
      console.error('Video search unavailable');
      throw new Error(`YouTube API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ items: data.items });
  } catch (error) {
    console.error('Video search unavailable');
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
