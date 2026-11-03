export const dynamic='force-dynamic';
import * as store from '@/lib/file-store.cjs';
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const backgroundsDir = path.join(store.assetDir(), 'backgrounds');
    
    // Check if directory exists
    try {
      await fs.access(backgroundsDir);
    } catch {
      // If it doesn't exist, return empty array
      return NextResponse.json({ backgrounds: [] });
    }

    const files = await fs.readdir(backgroundsDir);
    const backgrounds = files
      .filter(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'))
      .map(file => `/assets/backgrounds/${file}`);

    return NextResponse.json({ backgrounds });
  } catch (error) {
    console.error('Asset operation failed');
    return NextResponse.json({ error: 'Failed to fetch backgrounds' }, { status: 500 });
  }
}
