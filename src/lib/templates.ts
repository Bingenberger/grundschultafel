// Shared school templates ("Vorlagen"): constants used by client and server.

export const SUBJECTS = [
  'Deutsch',
  'Mathematik',
  'Sachunterricht',
  'Englisch',
  'Musik',
  'Kunst',
  'Religion/Ethik',
  'Sport',
  'Sonstiges',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const GRADES = [1, 2, 3, 4] as const;

export interface TemplateMeta {
  id: string;
  name: string;
  subject: Subject;
  grades: number[]; // empty = jahrgangsübergreifend
  description: string;
  ownerId: string;
  ownerName: string;
  sourceNotebookId: string | null;
  pageCount: number;
  thumbnail: string | null; // small JPEG data URL of the first page
  createdAt: string;
  updatedAt: string;
}

export const gradeLabel = (grades: number[]) =>
  grades.length === 0 ? 'alle Jahrgänge' : grades.length === 1 ? `Klasse ${grades[0]}` : `Klassen ${grades.join(', ')}`;
