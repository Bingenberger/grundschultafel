export type GalleryAssetKind = 'display' | 'thumbnails';

export interface GallerySearchItem {
  id: number;
  filename: string;
  description: string | null;
  tags: string[];
  thumbnailUrl: string;
  displayUrl: string;
}

const GALLERY_ORIGIN = 'https://pix.foerster.rocks';

function htmlDecode(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(value: string) {
  return htmlDecode(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function buildSearchUrl(query: string, page: number) {
  const url = new URL('/', GALLERY_ORIGIN);
  if (query) {
    url.searchParams.set('search', query);
  }
  if (page > 1) {
    url.searchParams.set('page', String(page));
  }
  return url.toString();
}

function extractTotalPages(html: string, currentPage: number) {
  const matches = [...html.matchAll(/href="\/\?page=(\d+)[^"]*"/g)].map((match) => Number(match[1]));
  return Math.max(currentPage, 1, ...matches);
}

function parseGalleryItems(html: string): GallerySearchItem[] {
  const items: GallerySearchItem[] = [];

  // Split HTML into per-modal blocks (class now includes "detail-modal")
  const modalRegex = /<div class="modal fade[^"]*" id="imgModal(\d+)"([\s\S]*?)(?=<div class="modal fade[^"]*" id="imgModal|\s*<\/body|$)/g;

  for (const match of html.matchAll(modalRegex)) {
    const id = Number(match[1]);
    const block = match[2];

    const imgMatch = block.match(/src="([^"]*\/static\/display\/[^"]+)"/);
    if (!imgMatch) continue;

    const displayPath = htmlDecode(imgMatch[1]);
    const filename = displayPath.split('/').pop() || `image-${id}.webp`;
    const thumbnailPath = displayPath.replace('/static/display/', '/static/thumbnails/');

    // Description is in first <em> inside detail-meta-pane
    const descMatch = block.match(/<div class="detail-meta-pane"[\s\S]*?<em>([\s\S]*?)<\/em>/);
    const description = descMatch ? stripTags(descMatch[1]) : null;

    // Tags: only <a> elements with bg-secondary badge class (excludes <span> style/AI badges)
    const tags = [...block.matchAll(/class="badge[^"]*bg-secondary[^"]*"[^>]*>([^<]+)<\/a>/g)]
      .map(m => stripTags(m[1]))
      .filter(Boolean);

    items.push({
      id,
      filename,
      description,
      tags,
      thumbnailUrl: `/api/gallery/image?src=${encodeURIComponent(new URL(thumbnailPath, GALLERY_ORIGIN).toString())}`,
      displayUrl: `/api/gallery/image?src=${encodeURIComponent(new URL(displayPath, GALLERY_ORIGIN).toString())}`,
    });
  }

  return items;
}

export async function searchGallery(query: string, page: number) {
  const res = await fetch(buildSearchUrl(query.trim(), page), {
    headers: {
      'User-Agent': 'TafelPopafel/1.0'
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Galerie-Suche fehlgeschlagen: ${res.status}`);
  }

  const html = await res.text();
  const items = parseGalleryItems(html);
  const totalPages = extractTotalPages(html, page);

  return {
    items,
    total: items.length,
    page,
    pageSize: items.length,
    totalPages,
  };
}
