// Built-in background templates (Lineaturen, Karo, Mathe). Generated as SVG so they are
// available in every installation without importing asset files, stay sharp at any size and
// are stored compactly inside the notebook. All templates use a 1920×1080 (16:9) canvas.

export interface BackgroundTemplate {
  id: string;
  name: string;
  group: 'Deutsch' | 'Mathematik';
  url: string;
  // cover: fill the board (ruled paper, grids); contain: show completely (charts)
  fit: 'cover' | 'contain';
}

const W = 1920;
const H = 1080;
const LINE = '#1e3a8a';     // dark blue writing lines
const HELP = '#93c5fd';     // light helper lines
const BAND = '#e5e7eb';     // grey middle band (as in the existing Lineatur 1)
const GRID = '#bfdbfe';
const FONT = 'Arial, Helvetica, sans-serif';

const svg = (body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`
  )}`;

const hline = (y: number, color: string, width: number, x1 = 60, x2 = W - 60, dash = '') =>
  `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

// German school ruling: Oberlinie, Mittellinie, Grundlinie, Unterlinie.
// `unit` = height of one band (Oberlänge = Mittelband = Unterlänge), `gap` = space between rows.
function lineatur(unit: number, gap: number, options: { band: boolean; outer: boolean; helperDashed?: boolean }) {
  const row = 3 * unit + gap;
  const rows = Math.floor((H - 60) / row);
  const top = (H - (rows * row - gap)) / 2;
  let body = '';
  for (let r = 0; r < rows; r++) {
    const y0 = top + r * row; // Oberlinie
    const yMid = y0 + unit;   // Mittellinie
    const yBase = y0 + 2 * unit; // Grundlinie
    const yLow = y0 + 3 * unit;  // Unterlinie
    if (options.band) body += `<rect x="60" y="${yMid}" width="${W - 120}" height="${unit}" fill="${BAND}"/>`;
    if (options.outer) body += hline(y0, HELP, 2) + hline(yLow, HELP, 2);
    body += hline(yMid, options.helperDashed ? HELP : LINE, options.helperDashed ? 2 : 2.5, 60, W - 60, options.helperDashed ? '10 8' : '');
    body += hline(yBase, LINE, 3.5);
  }
  return svg(body);
}

function grid(size: number) {
  let body = '';
  for (let x = size; x < W; x += size) body += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID}" stroke-width="1.5"/>`;
  for (let y = size; y < H; y += size) body += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID}" stroke-width="1.5"/>`;
  return svg(body);
}

function hundredChart(withNumbers: boolean) {
  const cell = 96;
  const size = cell * 10;
  const x0 = (W - size) / 2;
  const y0 = (H - size) / 2;
  let body = `<rect x="${x0}" y="${y0}" width="${size}" height="${size}" fill="white" stroke="${LINE}" stroke-width="4"/>`;
  for (let i = 1; i < 10; i++) {
    const strong = i === 5;
    body += `<line x1="${x0 + i * cell}" y1="${y0}" x2="${x0 + i * cell}" y2="${y0 + size}" stroke="${LINE}" stroke-width="${strong ? 4 : 1.5}"/>`;
    body += `<line x1="${x0}" y1="${y0 + i * cell}" x2="${x0 + size}" y2="${y0 + i * cell}" stroke="${LINE}" stroke-width="${strong ? 4 : 1.5}"/>`;
  }
  if (withNumbers) {
    for (let n = 1; n <= 100; n++) {
      const col = (n - 1) % 10;
      const row = Math.floor((n - 1) / 10);
      body += `<text x="${x0 + col * cell + cell / 2}" y="${y0 + row * cell + cell / 2 + 13}" font-family="${FONT}" font-size="36" text-anchor="middle" fill="#334155">${n}</text>`;
    }
  }
  return svg(body);
}

function numberLine(max: number) {
  const x1 = 100;
  const x2 = W - 100;
  const y = H / 2;
  const step = (x2 - x1) / max;
  let body = `<line x1="${x1 - 30}" y1="${y}" x2="${x2 + 50}" y2="${y}" stroke="${LINE}" stroke-width="4"/>`;
  body += `<path d="M ${x2 + 70} ${y} l -28 -14 v 28 z" fill="${LINE}"/>`;
  for (let n = 0; n <= max; n++) {
    const x = x1 + n * step;
    const big = n % 10 === 0;
    const mid = n % 5 === 0;
    const len = big ? 40 : mid ? 28 : 16;
    body += `<line x1="${x}" y1="${y - len}" x2="${x}" y2="${y + len}" stroke="${LINE}" stroke-width="${big ? 4 : mid ? 3 : 2}"/>`;
    const label = max <= 20 || big;
    if (label) body += `<text x="${x}" y="${y + 90}" font-family="${FONT}" font-size="${max <= 20 ? 40 : 36}" font-weight="${big ? 'bold' : 'normal'}" text-anchor="middle" fill="#334155">${n}</text>`;
  }
  return svg(body);
}

// Stellenwerttafel in the usual Montessori colours: T green, H red, Z blue, E green.
function placeValueChart() {
  const columns = [
    { label: 'T', title: 'Tausender', color: '#15803d' },
    { label: 'H', title: 'Hunderter', color: '#dc2626' },
    { label: 'Z', title: 'Zehner', color: '#2563eb' },
    { label: 'E', title: 'Einer', color: '#16a34a' },
  ];
  const colW = 360;
  const x0 = (W - colW * columns.length) / 2;
  const top = 90;
  const head = 130;
  const bottom = H - 90;
  let body = '';
  columns.forEach((c, i) => {
    const x = x0 + i * colW;
    body += `<rect x="${x}" y="${top}" width="${colW}" height="${head}" fill="${c.color}"/>`;
    body += `<text x="${x + colW / 2}" y="${top + 78}" font-family="${FONT}" font-size="72" font-weight="bold" text-anchor="middle" fill="white">${c.label}</text>`;
    body += `<text x="${x + colW / 2}" y="${top + 118}" font-family="${FONT}" font-size="26" text-anchor="middle" fill="white">${c.title}</text>`;
  });
  body += `<rect x="${x0}" y="${top}" width="${colW * columns.length}" height="${bottom - top}" fill="none" stroke="${LINE}" stroke-width="4"/>`;
  for (let i = 1; i < columns.length; i++) body += `<line x1="${x0 + i * colW}" y1="${top}" x2="${x0 + i * colW}" y2="${bottom}" stroke="${LINE}" stroke-width="3"/>`;
  for (let y = top + head + 150; y < bottom; y += 150) body += `<line x1="${x0}" y1="${y}" x2="${x0 + colW * columns.length}" y2="${y}" stroke="${GRID}" stroke-width="2"/>`;
  return svg(body);
}

export const BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  { id: 'lin1', name: 'Lineatur 1', group: 'Deutsch', url: lineatur(70, 70, { band: true, outer: true }), fit: 'cover' },
  { id: 'lin2', name: 'Lineatur 2', group: 'Deutsch', url: lineatur(50, 50, { band: true, outer: true }), fit: 'cover' },
  { id: 'lin3', name: 'Lineatur 3', group: 'Deutsch', url: lineatur(36, 40, { band: false, outer: true }), fit: 'cover' },
  { id: 'lin4', name: 'Lineatur 4', group: 'Deutsch', url: lineatur(30, 36, { band: false, outer: false, helperDashed: true }), fit: 'cover' },
  { id: 'karo-klein', name: 'Karo klein', group: 'Mathematik', url: grid(40), fit: 'cover' },
  { id: 'karo-gross', name: 'Karo groß', group: 'Mathematik', url: grid(80), fit: 'cover' },
  { id: 'hundert', name: 'Hundertertafel', group: 'Mathematik', url: hundredChart(true), fit: 'contain' },
  { id: 'hundert-leer', name: 'Hundertertafel leer', group: 'Mathematik', url: hundredChart(false), fit: 'contain' },
  { id: 'zahlenstrahl-20', name: 'Zahlenstrahl bis 20', group: 'Mathematik', url: numberLine(20), fit: 'contain' },
  { id: 'zahlenstrahl-100', name: 'Zahlenstrahl bis 100', group: 'Mathematik', url: numberLine(100), fit: 'contain' },
  { id: 'stellenwert', name: 'Stellenwerttafel', group: 'Mathematik', url: placeValueChart(), fit: 'contain' },
];
