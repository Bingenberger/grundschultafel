import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const rsDir = path.join(process.cwd(), 'public', 'assets', 'rs');

    try {
      await fs.access(rsDir);
    } catch {
      return NextResponse.json({ images: [] });
    }

    const files = await fs.readdir(rsDir);
    const images = files
      .filter((file) => file.match(/\.(webp|jpg|jpeg|png|svg)$/i))
      .map((file) => ({
        name: file.replace(/\.[^.]+$/, ''),
        url: `/assets/rs/${file}`,
      }));

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error fetching RS symbols:', error);
    return NextResponse.json({ error: 'Failed to fetch RS symbols' }, { status: 500 });
  }
}
