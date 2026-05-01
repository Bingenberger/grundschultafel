import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const USER_DATA_DIR = path.join(process.cwd(), 'data', session.id);
    await fs.mkdir(USER_DATA_DIR, { recursive: true });
    
    const files = await fs.readdir(USER_DATA_DIR);
    
    // We need to read the content to get the actual name stored inside the JSON
    const notebooksPromises = files
      .filter(f => f.endsWith('.json'))
      .map(async (file) => {
        const filePath = path.join(USER_DATA_DIR, file);
        const stats = await fs.stat(filePath);
        const id = file.replace('.json', '');
        let name = id.replace(/_/g, ' ');

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (data.name) {
            name = data.name;
          }
        } catch (e) {
          // fallback to filename if reading fails
        }

        return {
          id,
          name,
          updatedAt: stats.mtime.toISOString()
        };
      });

    // Resolve all promises
    const resolvedNotebooks = await Promise.all(notebooksPromises);

    // Sort by most recent
    resolvedNotebooks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ notebooks: resolvedNotebooks });
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    return NextResponse.json({ error: 'Failed to fetch notebooks' }, { status: 500 });
  }
}
