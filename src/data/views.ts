import type { ArtworkTag } from './types.ts';

export type Shape = 'sphere' | 'heart' | 'smiley' | 'star' | 'grid';
/** `about` shows the story overlay; the scene keeps its last real shape. */
export type ViewMode = Shape | 'about';

export const SHAPES: { id: Shape; label: string }[] = [
  { id: 'sphere', label: 'sphere' },
  { id: 'heart', label: 'heart' },
  { id: 'smiley', label: 'smiley' },
  { id: 'star', label: 'star' },
  { id: 'grid', label: 'grid' },
];

export type FilterId = 'all' | 'paintings' | 'prints';

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'all' },
  { id: 'paintings', label: 'paintings' },
  { id: 'prints', label: 'prints' },
];

export function tagMatchesFilter(tag: ArtworkTag, filter: FilterId): boolean {
  if (filter === 'paintings') return tag === 'prototype';
  if (filter === 'prints') return tag === 'image';
  return true;
}
