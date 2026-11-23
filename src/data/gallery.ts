import storiesJson from '../../data/stories.json' with { type: 'json' };
import type { Artwork, GalleryItem, SceneArtwork, Story } from './types.ts';

export const stories = storiesJson as Story[];

/** Cards in the scene. The 56 artworks repeat to fill the cloud. */
export const CARD_COUNT = 307;
/** The first 8 cards (eight different artworks) are highlighted "recap" cards. */
export const RECAP_COUNT = 8;

export function thumbPath(art: Pick<Artwork, 'img'>): string {
  return '/art/thumbs/' + art.img.slice(art.img.lastIndexOf('/') + 1);
}

/** Drop the provenance fields the scene never reads; they stay in `/artworks.json`. */
export function sceneArtwork({ id, title, artist, year, img, w, h, source, tag }: Artwork): SceneArtwork {
  return { id, title, artist, year, img, w, h, source, tag };
}

export function buildGalleryItems(arts: SceneArtwork[]): GalleryItem[] {
  return Array.from({ length: CARD_COUNT }, (_, i) => {
    const art = arts[i % arts.length];
    return {
      id: `${art.id}:${i}`,
      artworkId: art.id,
      date: String(art.year),
      title: art.title,
      url: art.source,
      img: thumbPath(art),
      imgFull: art.img,
      recap: i < RECAP_COUNT,
      w: art.w,
      h: art.h,
      artist: art.artist,
      tag: art.tag,
    };
  });
}
