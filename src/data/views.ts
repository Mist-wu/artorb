import type { ArtworkTag } from './types.ts';

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

/** Browse the filtered list in either direction, wrapping at its ends. */
export function stepArtwork<T>(list: readonly T[], current: T, direction: number): T {
  return list[(list.indexOf(current) + direction + list.length) % list.length];
}
