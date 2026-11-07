// Client for the Bildergalerie JSON-API v1 (see API.md of the gallery). The board fetches
// everything server-side; pupils' browsers never contact the gallery. No HTML is parsed.
// Rules: only the configured origin, no redirects, 6 s timeout, size limits, only
// /media/thumbnails/... and /media/display/... for images, optional bearer token from a file.
const fs = require('node:fs');

const TIMEOUT_MS = 6000;
const JSON_LIMIT = 2 * 1024 * 1024;
const IMAGE_LIMIT = 16 * 1024 * 1024;
const MAX_PER_PAGE = 60;
const IMAGE_TYPES = ['image/webp', 'image/png', 'image/jpeg', 'image/gif'];
const MEDIA_PATH = /^\/media\/(thumbnails|display)\/[A-Za-z0-9ÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß._-]{0,200}\.(webp|png|jpe?g|gif)$/;

function origin() {
  const raw = (process.env.GALLERY_ORIGIN || '').trim();
  if (!raw) return null;
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search) {
    throw new Error('Invalid GALLERY_ORIGIN');
  }
  return url.origin;
}

function enabled() {
  try { return Boolean(origin()); } catch { return false; }
}

let cachedToken;
function token() {
  // Read once per process; the platform mounts the file read-only and recreates the container on change.
  if (cachedToken === undefined) {
    const file = (process.env.GALLERY_TOKEN_FILE || '').trim();
    cachedToken = file ? fs.readFileSync(file, 'utf8').trim() : '';
  }
  return cachedToken;
}

function isMediaPath(path) {
  return typeof path === 'string' && MEDIA_PATH.test(path) && !path.includes('..');
}

async function bounded(response, limit) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > limit) throw new Error('Gallery response too large');
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Gallery response too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of chunks) { result.set(part, offset); offset += part.byteLength; }
  return result;
}

async function request(path, params, limit, fetchImpl = fetch) {
  const base = origin();
  if (!base) throw new Error('Gallery unavailable');
  const url = new URL(path, base);
  if (url.origin !== base) throw new Error('Foreign gallery URL');
  if (params) url.search = params.toString();
  const headers = { 'User-Agent': 'Grundschultafel/1.0', Accept: path.startsWith('/api/') ? 'application/json' : 'image/*' };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetchImpl(url.toString(), { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    const error = new Error(`Gallery answered ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { response, body: await bounded(response, limit) };
}

async function requestJson(path, params, fetchImpl = fetch) {
  const { response, body } = await request(path, params, JSON_LIMIT, fetchImpl);
  if ((response.headers.get('content-type') || '').split(';')[0].trim() !== 'application/json') {
    throw new Error('Gallery did not answer with JSON');
  }
  return JSON.parse(new TextDecoder().decode(body));
}

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const dimension = value => (Number.isInteger(value) && value > 0 && value < 100000 ? value : null);
const proxied = path => `/api/gallery/image?path=${encodeURIComponent(path)}`;

function mapItem(raw) {
  if (!raw || !Number.isInteger(raw.id) || !isMediaPath(raw.thumbnail_url) || !isMediaPath(raw.display_url)) return null;
  return {
    id: raw.id,
    description: text(raw.description, 500),
    tags: Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 50)).slice(0, 20) : [],
    style: typeof raw.style === 'string' ? raw.style.slice(0, 80) : null,
    width: dimension(raw.width),
    height: dimension(raw.height),
    license: text(raw.license, 300),
    thumbnailUrl: proxied(raw.thumbnail_url),
    displayUrl: proxied(raw.display_url),
  };
}

/** @param {{q?: string, tags?: string[], page?: number, perPage?: number}} options */
async function search(options = {}, fetchImpl = fetch) {
  const { q = '', tags = [], page = 1, perPage = 36 } = options;
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim().slice(0, 100));
  const cleanTags = tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().slice(0, 50)).slice(0, 10);
  if (cleanTags.length) params.set('tags', cleanTags.join(','));
  const safePage = Math.max(1, Math.min(100000, Math.floor(Number(page)) || 1));
  const safePerPage = Math.max(1, Math.min(MAX_PER_PAGE, Math.floor(Number(perPage)) || 36));
  params.set('page', String(safePage));
  params.set('per_page', String(safePerPage));
  const data = await requestJson('/api/v1/images', params, fetchImpl);
  if (!data || !Array.isArray(data.items)) throw new Error('Unexpected gallery answer');
  const items = data.items.slice(0, MAX_PER_PAGE).map(mapItem).filter(Boolean);
  const total = Number.isInteger(data.total) && data.total >= 0 ? data.total : items.length;
  const totalPages = Number.isInteger(data.total_pages) && data.total_pages >= 0 ? data.total_pages : 1;
  return { items, total, page: safePage, pageSize: safePerPage, totalPages: Math.max(1, totalPages) };
}

async function tags(prefix = '', fetchImpl = fetch) {
  const params = new URLSearchParams();
  if (prefix.trim()) params.set('q', prefix.trim().slice(0, 50));
  const data = await requestJson('/api/v1/tags', params, fetchImpl);
  if (!data || !Array.isArray(data.tags)) throw new Error('Unexpected gallery answer');
  return data.tags
    .filter(t => t && typeof t.name === 'string' && Number.isInteger(t.count))
    .slice(0, 50)
    .map(t => ({ name: t.name.slice(0, 50), count: t.count }));
}

async function image(path, fetchImpl = fetch) {
  if (!isMediaPath(path)) { const error = new Error('Invalid gallery media path'); error.status = 400; throw error; }
  const { response, body } = await request(path, null, IMAGE_LIMIT, fetchImpl);
  const type = (response.headers.get('content-type') || '').split(';')[0].trim();
  if (!IMAGE_TYPES.includes(type)) { const error = new Error('Unsupported image type'); error.status = 415; throw error; }
  return { type, body };
}

function resetForTests() { cachedToken = undefined; }

module.exports = { enabled, search, tags, image, isMediaPath, resetForTests, MAX_PER_PAGE, IMAGE_LIMIT, JSON_LIMIT };
