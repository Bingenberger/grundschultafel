import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Simple in-memory queue to hold pending uploads
// Keys are session tokens, values are the URL path to the uploaded image
const uploadQueue: Record<string, string> = {};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const file = formData.get('image') as File;

    if (!token || !file) {
      return NextResponse.json({ error: 'Missing token or image' }, { status: 400 });
    }

    // Generate a unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Ensure the upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'assets', 'uploads');
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const filename = `${token}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    // Store the public URL path in the queue
    const publicUrl = `/assets/uploads/${filename}`;
    uploadQueue[token] = publicUrl;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Error handling mobile upload:', error);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Check if there is an image waiting for this token
    if (uploadQueue[token]) {
      const imageUrl = uploadQueue[token];
      // Clear it from the queue so we don't load it twice
      delete uploadQueue[token];
      return NextResponse.json({ imageUrl });
    }

    return NextResponse.json({ imageUrl: null });
  } catch (error) {
    console.error('Error polling mobile upload:', error);
    return NextResponse.json({ error: 'Failed to poll upload' }, { status: 500 });
  }
}
