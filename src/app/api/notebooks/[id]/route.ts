import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSession } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const USER_DATA_DIR = path.join(process.cwd(), 'data', session.id);
    const id = (await params).id;
    const filePath = path.join(USER_DATA_DIR, `${id}.json`);
    
    // Check if file exists to prevent throwing hard error
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const data = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error loading notebook:', error);
    return NextResponse.json({ error: 'Failed to load notebook' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const USER_DATA_DIR = path.join(process.cwd(), 'data', session.id);
    const id = (await params).id;
    const body = await request.json();
    
    await fs.mkdir(USER_DATA_DIR, { recursive: true });
    
    const filePath = path.join(USER_DATA_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(body), 'utf-8');
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error saving notebook:', error);
    return NextResponse.json({ error: 'Failed to save notebook' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const USER_DATA_DIR = path.join(process.cwd(), 'data', session.id);
    const id = (await params).id;
    const filePath = path.join(USER_DATA_DIR, `${id}.json`);
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error deleting notebook:', error);
    return NextResponse.json({ error: 'Failed to delete notebook' }, { status: 500 });
  }
}
