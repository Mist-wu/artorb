import type { ArtworkTag, GalleryItem } from './types.ts';

export const SHAPES = ['sphere', 'heart', 'smiley', 'star', 'grid'] as const;
export type Shape = (typeof SHAPES)[number];
/** `about` shows the story overlay; the scene keeps its last real shape. */
export type ViewMode = Shape | 'about';

export const FILTERS = ['all', 'paintings', 'prints'] as const;
export type FilterId = (typeof FILTERS)[number];

/** Display names; the ids above stay in code and state. */
export const LABELS: Record<Shape | FilterId, string> = {
  sphere: '球体',
  heart: '心形',
  smiley: '笑脸',
  star: '星形',
  grid: '网格',
  all: '全部',
  paintings: '绘画',
  prints: '版画',
};

export function tagMatchesFilter(tag: ArtworkTag, filter: FilterId): boolean {
  if (filter === 'paintings') return tag === 'prototype';
  if (filter === 'prints') return tag === 'image';
  return true;
}

/** First card of each artwork that passes `filter`, in data order: the grid and ←/→ use only these. */
export function distinctArtworks<T extends Pick<GalleryItem, 'artworkId' | 'tag'>>(
  items: readonly T[],
  filter: FilterId,
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!tagMatchesFilter(item.tag, filter) || seen.has(item.artworkId)) return false;
    seen.add(item.artworkId);
    return true;
  });
}

/** The entry `step` places from `artworkId` in `list`, wrapping around. */
export function stepArtwork<T extends Pick<GalleryItem, 'artworkId'>>(
  list: readonly T[],
  artworkId: string,
  step: number,
): T | undefined {
  if (!list.length) return undefined;
  const at = list.findIndex((item) => item.artworkId === artworkId);
  return list[(((at + step) % list.length) + list.length) % list.length];
}
