import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const dirPath = path.join(process.cwd(), 'public', 'assets', 'journal');
    
    // Check if directory exists, if not create it
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }

    const files = await fs.readdir(dirPath);
    // Filter for common image extensions
    const images = files.filter(file => 
      file.toLowerCase().endsWith('.png') || 
      file.toLowerCase().endsWith('.jpg') || 
      file.toLowerCase().endsWith('.jpeg') || 
      file.toLowerCase().endsWith('.gif') || 
      file.toLowerCase().endsWith('.svg') ||
      file.toLowerCase().endsWith('.webp')
    );

    // Return the URLs relative to public directory
    const urls = images.map(file => `/assets/journal/${file}`);
    return NextResponse.json({ images: urls });
  } catch (error) {
    console.error('Error reading journal directory:', error);
    return NextResponse.json({ error: 'Failed to read images' }, { status: 500 });
  }
}
