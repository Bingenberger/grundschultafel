import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const galleryDir = path.join(process.cwd(), 'public', 'assets', 'gallery');

    try {
      await fs.access(galleryDir);
    } catch {
      return NextResponse.json({ folders: [] });
    }

    const entries = await fs.readdir(galleryDir, { withFileTypes: true });
    const folderEntries = entries.filter((entry) => entry.isDirectory());

    const folders = await Promise.all(
      folderEntries.map(async (entry) => {
        const folderPath = path.join(galleryDir, entry.name);
        const files = await fs.readdir(folderPath);
        const images = files
          .filter((file) => /\.(webp|jpg|jpeg|png)$/i.test(file))
          .map((file) => `/assets/gallery/${entry.name}/${file}`);

        return {
          name: entry.name,
          images,
        };
      })
    );

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Error fetching local gallery folders:', error);
    return NextResponse.json({ error: 'Failed to fetch local gallery folders' }, { status: 500 });
  }
}
