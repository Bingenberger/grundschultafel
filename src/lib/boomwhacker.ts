// Boomwhacker score ("Rasterpartitur"): one row per tube in its usual colour, one column per
// beat. Stored as a Fabric object (mathKind 'score') with its notes in `mathData`, so it is
// saved in the notebook, can be moved, resized, duplicated and undone like other material.
import * as fabric from 'fabric';

export interface ScoreData {
  beats: number;              // number of columns (beats) of the whole song
  cells: string[];            // active cells as "row:col"
  bpm: number;
  loop: boolean;
  perRow?: number;            // beats per system before wrapping (default 16 = 4 bars)
  lyrics?: string[];          // optional text under the columns (presets)
}

export const DEFAULT_PER_ROW = 16;
export const perRowOf = (data: ScoreData) => data.perRow ?? DEFAULT_PER_ROW;

// Diatonic set, highest note first (rows from top to bottom)
export const TUBES = [
  { name: "C'", color: '#e53935', freq: 523.25 },
  { name: 'H', color: '#d81b60', freq: 493.88 },
  { name: 'A', color: '#7e57c2', freq: 440.0 },
  { name: 'G', color: '#00897b', freq: 392.0 },
  { name: 'F', color: '#7cb342', freq: 349.23 },
  { name: 'E', color: '#fdd835', freq: 329.63 },
  { name: 'D', color: '#fb8c00', freq: 293.66 },
  { name: 'C', color: '#e53935', freq: 261.63 },
];

const LABEL_W = 96;
const CELL = 46;
const HEAD = 28;
const LYRICS = 34;
const PAD = 10;
const SYSTEM_GAP = 18;

// Layout of a long song: it wraps into several systems (rows of bars), like in a song book
function layout(data: ScoreData) {
  const perRow = Math.min(perRowOf(data), data.beats);
  const systems = Math.max(1, Math.ceil(data.beats / perRow));
  const systemH = HEAD + TUBES.length * CELL + (data.lyrics?.length ? LYRICS : 0);
  return { perRow, systems, systemH };
}

export class BoomwhackerScore extends fabric.Rect {
  static type = 'BoomwhackerScore';
  declare mathKind: string;
  declare mathData: ScoreData;
  playhead: number | null = null; // runtime only: column currently playing

  constructor(options: Partial<fabric.RectProps> & { mathData?: ScoreData; mathKind?: string } = {}) {
    const data = options.mathData ?? { beats: 16, cells: [], bpm: 90, loop: false };
    super({ ...BoomwhackerScore.size(data), fill: 'transparent', originX: 'left', originY: 'top', ...options });
    this.mathKind = 'score';
    this.mathData = data;
    this.objectCaching = false;
  }

  static size(data: ScoreData) {
    const { perRow, systems, systemH } = layout(data);
    return {
      width: LABEL_W + perRow * CELL + 2 * PAD,
      height: systems * systemH + (systems - 1) * SYSTEM_GAP + 2 * PAD,
    };
  }

  // Replace the data (always a new object, history snapshots must not change) and resize
  update(data: ScoreData) {
    this.mathData = data;
    this.set(BoomwhackerScore.size(data));
    this.setCoords();
  }

  _render(ctx: CanvasRenderingContext2D) {
    const { beats, cells, lyrics } = this.mathData;
    const { perRow, systems, systemH } = layout(this.mathData);
    const active = new Set(cells);
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(0, 0, this.width, this.height, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let sys = 0; sys < systems; sys++) {
      const first = sys * perRow;
      const count = Math.min(perRow, beats - first);
      const top = PAD + sys * (systemH + SYSTEM_GAP);
      const gx = PAD + LABEL_W;
      const gy = top + HEAD;
      const playing = this.playhead !== null && this.playhead >= first && this.playhead < first + count ? this.playhead - first : null;
      const x = (c: number) => gx + c * CELL; // c = column inside this system

      if (playing !== null) {
        ctx.fillStyle = 'rgba(59,130,246,0.18)';
        ctx.fillRect(x(playing), top, CELL, HEAD);
      }
      // beat numbers (1 2 3 4 per bar)
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 15px Arial, sans-serif';
      for (let c = 0; c < count; c++) ctx.fillText(String(((first + c) % 4) + 1), x(c) + CELL / 2, top + HEAD / 2);

      TUBES.forEach((tube, r) => {
        const y = gy + r * CELL;
        ctx.fillStyle = tube.color;
        ctx.beginPath();
        ctx.roundRect(PAD + 4, y + 6, LABEL_W - 14, CELL - 12, 10);
        ctx.fill();
        ctx.fillStyle = tube.name === 'E' ? '#1e293b' : 'white';
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillText(tube.name, PAD + 4 + (LABEL_W - 14) / 2, y + CELL / 2 + 1);
        // row background stripe, and the playing column on top of it
        ctx.fillStyle = r % 2 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(gx, y, count * CELL, CELL);
        if (playing !== null) {
          ctx.fillStyle = 'rgba(59,130,246,0.22)';
          ctx.fillRect(x(playing), y, CELL, CELL);
        }
        for (let c = 0; c < count; c++) {
          if (!active.has(`${r}:${first + c}`)) continue;
          ctx.fillStyle = tube.color;
          ctx.beginPath();
          ctx.roundRect(x(c) + 4, y + 4, CELL - 8, CELL - 8, 9);
          ctx.fill();
          if (playing === c) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#1e293b';
            ctx.stroke();
          }
        }
      });

      // grid lines; strong line at every bar
      for (let c = 0; c <= count; c++) {
        const bar = (first + c) % 4 === 0 || c === count;
        ctx.beginPath();
        ctx.moveTo(x(c), gy);
        ctx.lineTo(x(c), gy + TUBES.length * CELL);
        ctx.lineWidth = bar ? 3 : 1;
        ctx.strokeStyle = bar ? '#334155' : '#cbd5e1';
        ctx.stroke();
      }
      for (let r = 0; r <= TUBES.length; r++) {
        ctx.beginPath();
        ctx.moveTo(gx, gy + r * CELL);
        ctx.lineTo(gx + count * CELL, gy + r * CELL);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#cbd5e1';
        ctx.stroke();
      }
      if (lyrics?.length) {
        ctx.fillStyle = '#1e293b';
        ctx.font = '20px Grundschrift, Arial, sans-serif';
        for (let c = 0; c < count; c++) {
          const word = lyrics[first + c];
          if (word) ctx.fillText(word, x(c) + CELL / 2, gy + TUBES.length * CELL + LYRICS / 2 + 2);
        }
      }
    }
    ctx.restore();
  }

  // What is under a (local) point: a cell, a tube label or nothing
  hit(local: fabric.Point): { cell: [number, number] } | { tube: number } | null {
    const { perRow, systems, systemH } = layout(this.mathData);
    const x = local.x + this.width / 2 - PAD;
    const yAll = local.y + this.height / 2 - PAD;
    const sys = Math.floor(yAll / (systemH + SYSTEM_GAP));
    if (sys < 0 || sys >= systems) return null;
    const y = yAll - sys * (systemH + SYSTEM_GAP) - HEAD;
    const row = Math.floor(y / CELL);
    if (row < 0 || row >= TUBES.length) return null;
    if (x >= 0 && x < LABEL_W) return { tube: row };
    const inRow = Math.floor((x - LABEL_W) / CELL);
    const col = sys * perRow + inRow;
    if (inRow < 0 || inRow >= perRow || col >= this.mathData.beats) return null;
    return { cell: [row, col] };
  }

  toggleCell(row: number, col: number) {
    const key = `${row}:${col}`;
    const cells = this.mathData.cells.includes(key) ? this.mathData.cells.filter((k) => k !== key) : [...this.mathData.cells, key];
    this.update({ ...this.mathData, cells });
    return cells.includes(key); // true = note is now set
  }

  notesAt(col: number) {
    return TUBES.map((_, r) => r).filter((r) => this.mathData.cells.includes(`${r}:${col}`));
  }
}

fabric.classRegistry.setClass(BoomwhackerScore);

// --- Sound ---------------------------------------------------------------------------

let audio: AudioContext | null = null;
export function playTubes(rows: number[], duration = 0.45) {
  if (rows.length === 0) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  const now = audio.currentTime;
  rows.forEach((r) => {
    const tube = TUBES[r];
    if (!tube || !audio) return;
    // a hollow, slightly percussive tone: triangle + short decay
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.value = tube.freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35 / Math.max(1, rows.length * 0.7), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  });
}

// --- Presets ---------------------------------------------------------------------------

const row = (name: string) => TUBES.findIndex((t) => t.name === name);

// melody as one entry per beat ('' = rest), lyrics per beat
function fromMelody(melody: string[], lyrics: string[], bpm: number): ScoreData {
  const cells = melody.flatMap((note, c) => (note ? [`${row(note)}:${c}`] : []));
  return { beats: melody.length, cells, bpm, loop: false, lyrics };
}

export const SCORE_PRESETS: { id: string; name: string; data: () => ScoreData }[] = [
  { id: 'empty', name: 'Leere Partitur (4 Takte)', data: () => ({ beats: 16, cells: [], bpm: 90, loop: false }) },
  {
    id: 'entchen',
    name: 'Alle meine Entchen',
    data: () => fromMelody(
      ['C', 'D', 'E', 'F', 'G', '', 'G', '', 'A', 'A', 'A', 'A', 'G', '', '', '', 'A', 'A', 'A', 'A', 'G', '', '', '', 'F', 'F', 'F', 'F', 'E', '', 'E', '', 'D', 'D', 'D', 'D', 'C', '', '', ''],
      ['Al', 'le', 'mei', 'ne', 'Ent', '', 'chen', '', 'schwim', 'men', 'auf', 'dem', 'See,', '', '', '', 'schwim', 'men', 'auf', 'dem', 'See.', '', '', '', 'Köpf', 'chen', 'in', 'das', 'Was', '', 'ser,', '', 'Schwänz', 'chen', 'in', 'die', 'Höh.', '', '', ''],
      100,
    ),
  },
];

export function createScore(presetId = 'empty') {
  const preset = SCORE_PRESETS.find((p) => p.id === presetId) ?? SCORE_PRESETS[0];
  return new BoomwhackerScore({ mathData: preset.data() });
}
