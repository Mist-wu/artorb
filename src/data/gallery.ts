import type { Artwork, SceneArtwork } from './types.ts';

export function thumbPath(art: Pick<Artwork, 'img'>): string {
  return '/art/thumbs/' + art.img.slice(art.img.lastIndexOf('/') + 1);
}

/** Drop the provenance fields the scene never reads; they stay in `/artworks.json`. */
export function sceneArtwork({ id, title, artist, year, img, w, h, source, tag }: Artwork): SceneArtwork {
  return { id, title, artist, year, img, w, h, source, tag };
}
