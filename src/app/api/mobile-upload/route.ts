import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Pending uploads are stored as files so all worker processes can see them.
// File name: <token>.pending, content: the public URL of the uploaded image.
const pendingDir = path.join(process.cwd(), 'data', 'pending-uploads');

async function ensurePendingDir() {
  try { await fs.access(pendingDir); } catch { await fs.mkdir(pendingDir, { recursive: true }); }
}

function sanitizeToken(token: string) {
  return token.replace(/[^a-zA-Z0-9-]/g, '');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawToken = formData.get('token') as string;
    const file = formData.get('image') as File;

    if (!rawToken || !file) {
      return NextResponse.json({ error: 'Missing token or image' }, { status: 400 });
    }
    const token = sanitizeToken(rawToken);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), 'public', 'assets', 'uploads');
    try { await fs.access(uploadDir); } catch { await fs.mkdir(uploadDir, { recursive: true }); }

    const filename = `${token}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const publicUrl = `/assets/uploads/${filename}`;

    // Write token → URL mapping to disk so all workers can read it
    await ensurePendingDir();
    await fs.writeFile(path.join(pendingDir, `${token}.pending`), publicUrl, 'utf-8');

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Error handling mobile upload:', error);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawToken = url.searchParams.get('token');

    if (!rawToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }
    const token = sanitizeToken(rawToken);
    const pendingFile = path.join(pendingDir, `${token}.pending`);

    try {
      const imageUrl = (await fs.readFile(pendingFile, 'utf-8')).trim();
      await fs.unlink(pendingFile); // consume once
      return NextResponse.json({ imageUrl });
    } catch {
      // File doesn't exist yet — upload not received
      return NextResponse.json({ imageUrl: null });
    }
  } catch (error) {
    console.error('Error polling mobile upload:', error);
    return NextResponse.json({ error: 'Failed to poll upload' }, { status: 500 });
  }
}
