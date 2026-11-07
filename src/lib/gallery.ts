// Server-side access to the Bildergalerie JSON-API v1 (implementation in gallery-client.cjs,
// which the runtime contract tests exercise directly). Disabled (503) unless GALLERY_ORIGIN is set.
import * as client from './gallery-client.cjs';

export interface GalleryItem {
  id: number;
  description: string;
  tags: string[];
  style: string | null;
  width: number | null;
  height: number | null;
  license: string;
  thumbnailUrl: string;
  displayUrl: string;
}

export interface GalleryPage {
  items: GalleryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const galleryEnabled = (): boolean => client.enabled();

export function searchGallery(options: { q?: string; tags?: string[]; page?: number; perPage?: number }): Promise<GalleryPage> {
  return client.search(options);
}

export function galleryTags(prefix: string): Promise<{ name: string; count: number }[]> {
  return client.tags(prefix);
}

export function galleryImage(path: string): Promise<{ type: string; body: Uint8Array }> {
  return client.image(path);
}

export const statusOf = (error: unknown): number | undefined =>
  typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined;
