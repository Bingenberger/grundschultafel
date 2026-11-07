// Server-side storage for shared templates: data/shared/templates/<id>.meta.json (small,
// for listing) and <id>.json (the notebook content that colleagues copy).
import fs from 'node:fs/promises';
import path from 'node:path';
import * as store from '@/lib/file-store.cjs';
import { SUBJECTS, GRADES, type TemplateMeta, type Subject } from '@/lib/templates';

export const templateDir = () => path.join(store.dataDir(), 'shared', 'templates');
export const metaFile = (id: string) => path.join(templateDir(), `${id}.meta.json`);
export const contentFile = (id: string) => path.join(templateDir(), `${id}.json`);

export async function listTemplates(): Promise<TemplateMeta[]> {
  let names: string[];
  try {
    names = await fs.readdir(templateDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const rows = await Promise.all(
    names
      .filter((n) => n.endsWith('.meta.json') && store.segment(n.slice(0, -'.meta.json'.length)))
      .map(async (n) => {
        try {
          return JSON.parse(await fs.readFile(path.join(templateDir(), n), 'utf8')) as TemplateMeta;
        } catch {
          return null; // a damaged entry must not hide the others
        }
      })
  );
  return rows.filter((r): r is TemplateMeta => r !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function readMeta(id: string): Promise<TemplateMeta | null> {
  if (!store.segment(id)) return null;
  try {
    return JSON.parse(await fs.readFile(metaFile(id), 'utf8'));
  } catch {
    return null;
  }
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Validates the user-editable fields of a share request
export function sanitizeShare(body: any) {
  const name = text(body?.name, 120);
  if (!name) throw new Error('Name fehlt');
  const subject = SUBJECTS.includes(body?.subject) ? (body.subject as Subject) : null;
  if (!subject) throw new Error('Fach ungültig');
  const grades = Array.isArray(body?.grades)
    ? [...new Set(body.grades.filter((g: unknown) => (GRADES as readonly unknown[]).includes(g)) as number[])].sort()
    : [];
  const description = text(body?.description, 500);
  const thumbnail = typeof body?.thumbnail === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(body.thumbnail) && body.thumbnail.length < 300_000
    ? body.thumbnail
    : null;
  if (!Array.isArray(body?.pages) || body.pages.length === 0 || body.pages.length > 200) throw new Error('Seiten ungültig');
  const sourceNotebookId = store.segment(body?.sourceNotebookId) ? body.sourceNotebookId as string : null;
  return {
    name, subject, grades, description, thumbnail, sourceNotebookId,
    pages: body.pages,
    journalImages: Array.isArray(body?.journalImages) ? body.journalImages : [],
  };
}
