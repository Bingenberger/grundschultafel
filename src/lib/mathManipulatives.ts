// Interactive maths material for the board. Every item is an ordinary Fabric object (or a
// small custom class) with `mathKind` set, so it can be moved, is saved in the notebook and
// restored on load. Interaction (flipping counters, sliding abacus beads, turning clock
// hands) is handled in the Whiteboard via `handleMathTap` / `pickClockHand`.
import * as fabric from 'fabric';
import { BoomwhackerScore, createScore, playTubes, SCORE_PRESETS } from '@/lib/boomwhacker';

export type MathKind =
  | 'counter' | 'field' | 'card'
  | 'dienes'
  | 'abacus' | 'clock'
  | 'money'
  | 'score';

// Fabric 7 positions objects by their centre by default; this material is laid out by its
// top-left corner, so every shape states its origin explicitly.
const TL = { originX: 'left', originY: 'top' } as const;

const FONT = 'Grundschrift, Arial, sans-serif';
const INK = '#1e293b';
const RED = '#ef4444';
const BLUE = '#3b82f6';

// ---------------------------------------------------------------------------------------
// Custom classes with their own drawing and state (stored in `mathData`)

export interface AbacusData { rows: number; left: number[] }

const BEAD = 36;
const ROW_H = 46;
const PAD = 22;

export class Abacus extends fabric.Rect {
  static type = 'Abacus';
  declare mathKind: MathKind;
  declare mathData: AbacusData;

  constructor(options: Partial<fabric.RectProps> & { mathData?: AbacusData; mathKind?: MathKind } = {}) {
    const rows = options.mathData?.rows ?? 2;
    super({ width: 21 * BEAD + 2 * PAD, height: rows * ROW_H + 2 * PAD - 8, fill: 'transparent', ...TL, ...options });
    this.mathKind = 'abacus';
    this.mathData = options.mathData ?? { rows, left: Array(rows).fill(0) };
    this.objectCaching = false;
  }

  beadX(row: number, k: number) {
    const left = this.mathData.left[row] ?? 0;
    const inner = 21 * BEAD;
    return k < left ? PAD + k * BEAD + BEAD / 2 : PAD + inner - (10 - k) * BEAD + BEAD / 2;
  }

  _render(ctx: CanvasRenderingContext2D) {
    const w = this.width;
    const h = this.height;
    ctx.save();
    ctx.translate(-w / 2, -h / 2);
    // frame
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 14);
    ctx.fill();
    ctx.stroke();
    for (let r = 0; r < this.mathData.rows; r++) {
      const y = PAD + r * ROW_H + BEAD / 2 - 4;
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(PAD - 8, y);
      ctx.lineTo(w - PAD + 8, y);
      ctx.stroke();
      // 100er frame: rows 6–10 swap colours so that 50 is visible at a glance
      const swap = this.mathData.rows === 10 && r >= 5;
      for (let k = 0; k < 10; k++) {
        const red = (k < 5) !== swap;
        ctx.beginPath();
        ctx.arc(this.beadX(r, k), y, BEAD / 2 - 1, 0, Math.PI * 2);
        ctx.fillStyle = red ? RED : '#f8fafc';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = red ? '#991b1b' : '#64748b';
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Tap on a bead: like a real Rechenrahmen, the bead and all beads beyond it move across.
  tap(local: fabric.Point) {
    const x = local.x + this.width / 2;
    const y = local.y + this.height / 2;
    const row = Math.floor((y - PAD + 4) / ROW_H);
    if (row < 0 || row >= this.mathData.rows) return false;
    for (let k = 0; k < 10; k++) {
      if (Math.abs(x - this.beadX(row, k)) <= BEAD / 2) {
        const left = [...this.mathData.left];
        left[row] = k < left[row] ? k : k + 1;
        this.mathData = { ...this.mathData, left }; // new object: history snapshots must not change
        return true;
      }
    }
    return false;
  }
}

export interface ClockData { h: number; m: number }
const CLOCK = 360;

export class LearningClock extends fabric.Rect {
  static type = 'LearningClock';
  declare mathKind: MathKind;
  declare mathData: ClockData;

  constructor(options: Partial<fabric.RectProps> & { mathData?: ClockData; mathKind?: MathKind } = {}) {
    super({ width: CLOCK, height: CLOCK, fill: 'transparent', ...TL, ...options });
    this.mathKind = 'clock';
    this.mathData = options.mathData ?? { h: 3, m: 0 };
    this.objectCaching = false;
  }

  handAngles() {
    const { h, m } = this.mathData;
    return { hour: (((h % 12) + m / 60) * 30 * Math.PI) / 180, minute: (m * 6 * Math.PI) / 180 };
  }

  _render(ctx: CanvasRenderingContext2D) {
    const R = CLOCK / 2 - 6;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = INK;
    ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180;
      const long = i % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (R - (long ? 22 : 12)), -Math.cos(a) * (R - (long ? 22 : 12)));
      ctx.lineTo(Math.sin(a) * (R - 4), -Math.cos(a) * (R - 4));
      ctx.lineWidth = long ? 4 : 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let n = 1; n <= 12; n++) {
      const a = (n * 30 * Math.PI) / 180;
      ctx.fillText(String(n), Math.sin(a) * (R - 50), -Math.cos(a) * (R - 50) + 2);
    }
    const { hour, minute } = this.handAngles();
    const hand = (angle: number, length: number, width: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(-Math.sin(angle) * 14, Math.cos(angle) * 14);
      ctx.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length);
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    hand(hour, R * 0.5, 14, BLUE);
    hand(minute, R * 0.8, 8, RED);
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();
  }

  // Which hand is under the (local) pointer? Minute hand wins further out.
  pickHand(local: fabric.Point): 'hour' | 'minute' | null {
    const R = CLOCK / 2 - 6;
    const dist = Math.hypot(local.x, local.y);
    if (dist < 12 || dist > R * 0.9) return null;
    const angle = Math.atan2(local.x, -local.y);
    const diff = (a: number) => Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a)));
    const { hour, minute } = this.handAngles();
    const nearMinute = diff(minute) < 0.35;
    const nearHour = diff(hour) < 0.35 && dist < R * 0.6;
    if (nearMinute && (!nearHour || dist > R * 0.45)) return 'minute';
    if (nearHour) return 'hour';
    return null;
  }

  // Turn a hand to point at `local`. Turning the minute hand past 12 moves the hour on.
  turnHand(hand: 'hour' | 'minute', local: fabric.Point) {
    let degrees = (Math.atan2(local.x, -local.y) * 180) / Math.PI;
    if (degrees < 0) degrees += 360;
    let { h, m } = this.mathData;
    if (hand === 'minute') {
      const next = Math.round(degrees / 6) % 60;
      if (m > 45 && next < 15) h = (h + 1) % 12;
      else if (m < 15 && next > 45) h = (h + 11) % 12;
      m = next;
    } else {
      h = Math.floor(degrees / 30) % 12;
    }
    if (h === this.mathData.h && m === this.mathData.m) return false;
    this.mathData = { h, m };
    return true;
  }
}

fabric.classRegistry.setClass(Abacus);
fabric.classRegistry.setClass(LearningClock);

// ---------------------------------------------------------------------------------------
// Simple material built from shapes

const tag = <T extends fabric.FabricObject>(obj: T, kind: MathKind): T => {
  (obj as any).mathKind = kind;
  return obj;
};

const counter = (color: 'red' | 'blue', left = 0, top = 0) =>
  tag(new fabric.Circle({ left, top, radius: 28, fill: color === 'red' ? RED : BLUE, stroke: INK, strokeWidth: 2, ...TL }), 'counter');

const CELL = 66;
const FIELD_GAP = 14;

function field(cols: number) {
  const cell = CELL;
  const parts: fabric.FabricObject[] = [];
  const gap = cols === 10 ? FIELD_GAP : 0;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      parts.push(new fabric.Rect({ left: c * cell + (c >= 5 ? gap : 0), top: r * cell, width: cell, height: cell, fill: 'white', stroke: INK, strokeWidth: 3, ...TL }));
    }
  }
  const g = tag(new fabric.Group(parts, TL), 'field');
  (g as any).mathData = { cols };
  return g;
}

function card(label: string, left = 0) {
  const rect = new fabric.Rect({ width: 78, height: 104, rx: 10, ry: 10, fill: 'white', stroke: INK, strokeWidth: 3, ...TL });
  const text = new fabric.FabricText(label, { fontFamily: FONT, fontSize: 70, fill: INK, originX: 'center', originY: 'center', left: 39, top: 54 });
  const g = new fabric.Group([rect, text], { left, ...TL });
  return tag(g, 'card');
}

const WOOD = '#fcd34d';
const WOOD_EDGE = '#92400e';
const UNIT = 30;

function dienes(kind: 'one' | 'ten' | 'hundred', left = 0, top = 0) {
  const size = kind === 'one' ? [1, 1] : kind === 'ten' ? [1, 10] : [10, 10];
  const parts: fabric.FabricObject[] = [
    new fabric.Rect({ width: size[0] * UNIT, height: size[1] * UNIT, fill: WOOD, stroke: WOOD_EDGE, strokeWidth: 3, ...TL }),
  ];
  for (let i = 1; i < size[0]; i++) parts.push(new fabric.Line([i * UNIT, 0, i * UNIT, size[1] * UNIT], { stroke: WOOD_EDGE, strokeWidth: 1.5, ...TL }));
  for (let i = 1; i < size[1]; i++) parts.push(new fabric.Line([0, i * UNIT, size[0] * UNIT, i * UNIT], { stroke: WOOD_EDGE, strokeWidth: 1.5, ...TL }));
  const g = tag(new fabric.Group(parts, { left, top, ...TL }), 'dienes');
  (g as any).mathData = { piece: kind };
  return g;
}

// Play money in a simplified, own design (no reproduction of real banknotes/coins)
const COINS: Record<string, { r: number; label: string; fill: string; ring?: string }> = {
  '1ct': { r: 26, label: '1 ct', fill: '#c0773a' },
  '2ct': { r: 30, label: '2 ct', fill: '#c0773a' },
  '5ct': { r: 34, label: '5 ct', fill: '#c0773a' },
  '10ct': { r: 32, label: '10 ct', fill: '#e2b93b' },
  '20ct': { r: 36, label: '20 ct', fill: '#e2b93b' },
  '50ct': { r: 39, label: '50 ct', fill: '#e2b93b' },
  '1eur': { r: 37, label: '1 €', fill: '#cbd5e1', ring: '#e2b93b' },
  '2eur': { r: 41, label: '2 €', fill: '#e2b93b', ring: '#cbd5e1' },
};
const NOTES: Record<string, { label: string; fill: string }> = {
  '5eur': { label: '5 €', fill: '#cbd5e1' },
  '10eur': { label: '10 €', fill: '#fca5a5' },
  '20eur': { label: '20 €', fill: '#93c5fd' },
  '50eur': { label: '50 €', fill: '#fdba74' },
  '100eur': { label: '100 €', fill: '#86efac' },
};
export const MONEY_VALUES = [...Object.keys(COINS), ...Object.keys(NOTES)];
export const moneyLabel = (value: string) => COINS[value]?.label ?? NOTES[value]?.label ?? value;

function money(value: string) {
  const coin = COINS[value];
  if (coin) {
    const parts: fabric.FabricObject[] = [];
    if (coin.ring) parts.push(new fabric.Circle({ radius: coin.r, fill: coin.ring, stroke: '#78716c', strokeWidth: 2, ...TL }));
    const inner = coin.ring ? coin.r * 0.72 : coin.r;
    parts.push(new fabric.Circle({ radius: inner, left: coin.r - inner, top: coin.r - inner, fill: coin.fill, stroke: '#78716c', strokeWidth: 2, ...TL }));
    parts.push(new fabric.FabricText(coin.label, { fontFamily: 'Arial, sans-serif', fontWeight: 'bold', fontSize: coin.r * 0.62, fill: INK, originX: 'center', originY: 'center', left: coin.r, top: coin.r }));
    return tag(new fabric.Group(parts, TL), 'money');
  }
  const note = NOTES[value];
  const rect = new fabric.Rect({ width: 240, height: 128, rx: 8, ry: 8, fill: note.fill, stroke: '#475569', strokeWidth: 2, ...TL });
  const border = new fabric.Rect({ left: 8, top: 8, width: 224, height: 112, rx: 6, ry: 6, fill: 'transparent', stroke: 'rgba(30,41,59,0.35)', strokeWidth: 2, strokeDashArray: [6, 4], ...TL });
  const big = new fabric.FabricText(note.label, { fontFamily: 'Arial, sans-serif', fontWeight: 'bold', fontSize: 52, fill: INK, originX: 'center', originY: 'center', left: 120, top: 58 });
  const small = new fabric.FabricText('Spielgeld', { fontFamily: 'Arial, sans-serif', fontSize: 16, fill: INK, originX: 'center', originY: 'center', left: 120, top: 104 });
  return tag(new fabric.Group([rect, border, big, small], TL), 'money');
}

// ---------------------------------------------------------------------------------------
// Menu entries → objects (laid out from 0,0; the caller moves them to the visible centre)

export interface MathMenuEntry { id: string; label: string }
export const MATH_MENU: { title: string; items: MathMenuEntry[] }[] = [
  { title: 'Legematerial', items: [
    { id: 'counter-1', label: 'Wendeplättchen' },
    { id: 'counter-10', label: '10 Plättchen' },
    { id: 'field-5', label: 'Zehnerfeld' },
    { id: 'field-10', label: 'Zwanzigerfeld' },
    { id: 'digits', label: 'Ziffernkarten 0–9' },
    { id: 'operators', label: 'Rechenzeichen' },
  ] },
  { title: 'Zehnersystem', items: [
    { id: 'dienes-one', label: 'Einer' },
    { id: 'dienes-one-10', label: '10 Einer' },
    { id: 'dienes-ten', label: 'Zehner' },
    { id: 'dienes-hundred', label: 'Hunderter' },
  ] },
  { title: 'Rechenrahmen & Uhr', items: [
    { id: 'abacus-20', label: 'Rechenrahmen 20' },
    { id: 'abacus-100', label: 'Rechenrahmen 100' },
    { id: 'clock', label: 'Lernuhr' },
  ] },
  { title: 'Rechengeld', items: MONEY_VALUES.map((v) => ({ id: `money-${v}`, label: moneyLabel(v) })) },
];

export function createMathItems(id: string): fabric.FabricObject[] {
  switch (id) {
    case 'counter-1': return [counter('red')];
    case 'counter-10': return Array.from({ length: 10 }, (_, i) => counter('red', i * 64));
    case 'field-5': return [field(5)];
    case 'field-10': return [field(10)];
    case 'digits': return Array.from({ length: 10 }, (_, i) => card(String(i), i * 90));
    case 'operators': return ['+', '−', '·', ':', '=', '<', '>'].map((op, i) => card(op, i * 90));
    case 'dienes-one': return [dienes('one')];
    case 'dienes-one-10': return Array.from({ length: 10 }, (_, i) => dienes('one', i * 40));
    case 'dienes-ten': return [dienes('ten')];
    case 'dienes-hundred': return [dienes('hundred')];
    case 'abacus-20': return [new Abacus({ mathData: { rows: 2, left: [0, 0] } })];
    case 'abacus-100': return [new Abacus({ mathData: { rows: 10, left: Array(10).fill(0) } })];
    case 'clock': return [new LearningClock()];
    default:
      if (id.startsWith('money-')) return [money(id.slice(6))];
      if (id.startsWith('score-')) return [createScore(id.slice(6))];
      return [];
  }
}

// Flip a counter (red ↔ blue). Returns true when something changed.
export function handleMathTap(obj: fabric.FabricObject, scenePoint: fabric.Point): boolean {
  const kind = (obj as any).mathKind as MathKind | undefined;
  if (kind === 'counter') {
    obj.set('fill', obj.fill === RED ? BLUE : RED);
    return true;
  }
  if (obj instanceof Abacus) {
    return obj.tap(toLocal(obj, scenePoint));
  }
  if (obj instanceof BoomwhackerScore) {
    const hit = obj.hit(toLocal(obj, scenePoint));
    if (!hit) return false;
    if ('tube' in hit) { playTubes([hit.tube]); return false; } // label: just listen
    if (obj.toggleCell(hit.cell[0], hit.cell[1])) playTubes([hit.cell[0]]);
    return true;
  }
  return false;
}

export function toLocal(obj: fabric.FabricObject, scenePoint: fabric.Point) {
  return scenePoint.transform(fabric.util.invertTransform(obj.calcTransformMatrix()));
}

// --- Zehner-/Zwanzigerfeld: cell centres and snapping ------------------------------------

function fieldCols(f: fabric.FabricObject) {
  const cols = (f as any).mathData?.cols;
  if (cols === 5 || cols === 10) return cols;
  return f.width > 6 * CELL ? 10 : 5; // fields created before mathData existed
}

// Cell centres in scene coordinates (respects position, scaling and rotation of the field)
export function fieldCellCenters(f: fabric.FabricObject): fabric.Point[] {
  const cols = fieldCols(f);
  const gap = cols === 10 ? FIELD_GAP : 0;
  const matrix = f.calcTransformMatrix();
  const x0 = -f.width / 2 + 1.5;
  const y0 = -f.height / 2 + 1.5;
  const points: fabric.Point[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      points.push(new fabric.Point(x0 + c * CELL + (c >= 5 ? gap : 0) + CELL / 2, y0 + r * CELL + CELL / 2).transform(matrix));
    }
  }
  return points;
}

// Magnetic cells: a counter close to a cell centre jumps into the cell. Returns true if snapped.
export function snapCounterToFields(piece: fabric.FabricObject, fields: fabric.FabricObject[]): boolean {
  const centre = piece.getCenterPoint();
  let best: { point: fabric.Point; dist: number } | null = null;
  for (const f of fields) {
    const threshold = (CELL * (f.scaleX || 1)) / 2;
    for (const point of fieldCellCenters(f)) {
      const dist = Math.hypot(point.x - centre.x, point.y - centre.y);
      if (dist < threshold && (!best || dist < best.dist)) best = { point, dist };
    }
  }
  if (!best) return false;
  piece.setPositionByOrigin(best.point, 'center', 'center');
  piece.setCoords();
  return true;
}

// Pieces that lie on a field (their centre inside it) and move together with it
export function piecesOnField(f: fabric.FabricObject, all: fabric.FabricObject[]): fabric.FabricObject[] {
  const index = all.indexOf(f);
  return all.filter((o, i) => {
    const kind = (o as any).mathKind;
    if (i <= index || !kind || kind === 'field' || kind === 'abacus' || kind === 'clock') return false;
    return f.containsPoint(o.getCenterPoint());
  });
}

// Zehnerstangen can be turned by 90° with a button
export const isRotatablePiece = (o: fabric.FabricObject) =>
  (o as any).mathKind === 'dienes' && ((o as any).mathData?.piece === 'ten' || Math.abs(o.width - o.height) > 50);

// --- Bündeln / Entbündeln (Zehnersystem) -------------------------------------------------

export type DienesPiece = 'one' | 'ten' | 'hundred';
export const DIENES_UNIT = UNIT;

export function dienesPiece(o: fabric.FabricObject): DienesPiece | null {
  if ((o as any).mathKind !== 'dienes') return null;
  const piece = (o as any).mathData?.piece;
  if (piece === 'one' || piece === 'ten' || piece === 'hundred') return piece;
  // pieces created before mathData existed: tell them apart by their size
  const long = Math.max(o.width, o.height);
  const short = Math.min(o.width, o.height);
  return long < 2 * UNIT ? 'one' : short < 2 * UNIT ? 'ten' : 'hundred';
}

export function createDienes(piece: DienesPiece) {
  return dienes(piece);
}

// Music menu (Werkzeugkoffer → Musik)
export const MUSIC_MENU: MathMenuEntry[] = SCORE_PRESETS.map((p) => ({ id: `score-${p.id}`, label: p.name }));
