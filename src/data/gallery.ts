import artworksJson from '../../data/artworks.json' with { type: 'json' };
import storiesJson from '../../data/stories.json' with { type: 'json' };
import type { Artwork, GalleryItem, Story } from './types.ts';

export const artworks = artworksJson as Artwork[];
export const stories = storiesJson as Story[];

/** Cards in the scene. The 56 artworks repeat to fill the cloud. */
export const CARD_COUNT = 307;
/** The first 8 cards (eight different artworks) are highlighted "recap" cards. */
export const RECAP_COUNT = 8;

export function thumbPath(art: Pick<Artwork, 'img'>): string {
  return '/art/thumbs/' + art.img.slice(art.img.lastIndexOf('/') + 1);
}

export function buildGalleryItems(arts: Artwork[], count = CARD_COUNT): GalleryItem[] {
  return Array.from({ length: count }, (_, i) => {
    const art = arts[i % arts.length];
    return {
      id: `${art.id}:${i}`,
      date: String(art.year),
      text: `《${art.title}》 · ${art.artist} · ${art.year}`,
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

export const galleryItems = buildGalleryItems(artworks);
