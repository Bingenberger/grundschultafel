import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const API_KEY = process.env.YOUTUBE_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${API_KEY}`
    );

    if (!response.ok) {
      console.error('YouTube API Error:', await response.text());
      throw new Error(`YouTube API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ items: data.items });
  } catch (error) {
    console.error('Error fetching from YouTube:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
