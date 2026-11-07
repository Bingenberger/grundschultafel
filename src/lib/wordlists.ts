// Word lists for German reading tools (Blitzlesen, Silbenrutsche).
// A word may carry its syllables as hyphens ("Ba-na-ne"); otherwise they are guessed with
// a simple German heuristic. Later the Grundschul-Wörterbuch (gswb) can deliver exact
// syllables, pictures and audio through the same `ReadingWord` shape.

export interface ReadingWord {
  text: string;          // display form without hyphens
  syllables: string[];   // e.g. ["Ba", "na", "ne"]
  image?: string | null; // URL of a picture (later: from the dictionary)
  audio?: string | null; // URL of a recording (later: from the dictionary)
}

export interface WordList {
  id: string;
  name: string;
  words: string[]; // as typed, hyphens mark syllables
  builtIn?: boolean;
}

// Own, freely usable starter lists
export const BUILT_IN_LISTS: WordList[] = [
  { id: 'start-maloi', name: 'Erste Wörter (M, A, L, O, I)', builtIn: true, words: ['Ma-ma', 'O-ma', 'La-ma', 'Mi-a', 'A-li', 'Lo-la', 'Mi-mi', 'Mi-o', 'Mi-la', 'Li-mo', 'Mal', 'Mo-li'] },
  { id: 'start-zwei', name: 'Zweisilbige Wörter', builtIn: true, words: ['Ha-se', 'Na-se', 'Ro-se', 'Do-se', 'Ho-se', 'Ta-fel', 'Ra-be', 'Lu-pe', 'Mu-schel', 'Bir-ne', 'Rei-se', 'Kat-ze', 'Son-ne', 'Gar-ten', 'Mau-er'] },
  { id: 'start-drei', name: 'Dreisilbige Wörter', builtIn: true, words: ['Ba-na-ne', 'To-ma-te', 'Ra-ke-te', 'Me-lo-ne', 'Te-le-fon', 'Pa-pa-gei', 'Ka-ro-te', 'Fe-der-ball', 'Ap-fel-saft', 'Ka-pi-tän', 'Do-mi-no', 'Ma-ri-en-kä-fer'] },
  { id: 'start-klein', name: 'Kleine Wörter', builtIn: true, words: ['und', 'die', 'der', 'das', 'ist', 'ein', 'ei-ne', 'im', 'in', 'mit', 'auf', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'nicht', 'ja', 'nein'] },
  { id: 'start-tiere', name: 'Tiere', builtIn: true, words: ['Hund', 'Kat-ze', 'Maus', 'Pferd', 'Kuh', 'E-sel', 'I-gel', 'Ha-se', 'Fuchs', 'En-te', 'Lö-we', 'Ze-bra', 'Gi-raf-fe', 'E-le-fant'] },
];

const VOWEL_UNITS = ['aa', 'ee', 'oo', 'au', 'äu', 'eu', 'ei', 'ai', 'ie', 'a', 'e', 'i', 'o', 'u', 'ä', 'ö', 'ü', 'y'];
const CONSONANT_UNITS = ['sch', 'ch', 'ck', 'ph', 'qu', 'th'];

// Simple German syllabification for primary school words: one consonant goes to the next
// syllable (Ro-se, Zu-cker), of several the last one does (Kat-ze, Fens-ter). Compound
// words and some vowel combinations can be wrong; hyphens in the word list override it.
export function guessSyllables(word: string): string[] {
  if (word.length <= 2) return [word];
  const lower = word.toLowerCase();
  const units: { text: string; vowel: boolean }[] = [];
  let i = 0;
  while (i < word.length) {
    const rest = lower.slice(i);
    const v = VOWEL_UNITS.find((u) => rest.startsWith(u));
    const c = v ? undefined : CONSONANT_UNITS.find((u) => rest.startsWith(u));
    const len = (v ?? c ?? rest[0]).length;
    units.push({ text: word.slice(i, i + len), vowel: !!v });
    i += len;
  }
  const nuclei = units.map((u, idx) => (u.vowel ? idx : -1)).filter((idx) => idx >= 0);
  if (nuclei.length <= 1) return [word];
  const cuts: number[] = []; // unit index where a new syllable starts
  for (let n = 0; n < nuclei.length - 1; n++) {
    const between = nuclei[n + 1] - nuclei[n] - 1;
    cuts.push(between === 0 ? nuclei[n + 1] : nuclei[n + 1] - 1);
  }
  const syllables: string[] = [];
  let start = 0;
  for (const cut of [...cuts, units.length]) {
    syllables.push(units.slice(start, cut).map((u) => u.text).join(''));
    start = cut;
  }
  return syllables.filter(Boolean);
}

export function toReadingWord(entry: string): ReadingWord {
  const trimmed = entry.trim();
  if (trimmed.includes('-')) {
    const syllables = trimmed.split('-').map((s) => s.trim()).filter(Boolean);
    return { text: syllables.join(''), syllables };
  }
  return { text: trimmed, syllables: guessSyllables(trimmed) };
}

// Parse a textarea (one word per line; commas also allowed)
export function parseWords(text: string): string[] {
  return text.split(/[\n,;]+/).map((w) => w.trim()).filter(Boolean).slice(0, 200);
}

// Silbenrutsche: consonants that slide to the vowels
export const SLIDE_CONSONANTS = ['M', 'L', 'S', 'R', 'N', 'T', 'F', 'W', 'H', 'D', 'B', 'P', 'K', 'G', 'Sch', 'Ch'];
export const SLIDE_VOWELS = ['a', 'e', 'i', 'o', 'u', 'au', 'ei', 'eu'];
