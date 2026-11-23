/** One public-domain painting, as recorded in `data/artworks.json`. */
export interface Artwork {
  id: string;
  title: string;
  title_en: string;
  artist: string;
  year: number;
  /** Local 960px image, e.g. `/art/master-00.jpg`. */
  img: string;
  w: number;
  h: number;
  /** Commons file description page. */
  source: string;
  license: string;
  /** Full-resolution original on upload.wikimedia.org. */
  original: string;
  downloaded_from: string;
  /** `prototype` = painting, `image` = woodblock print. */
  tag: ArtworkTag;
}

export type ArtworkTag = 'prototype' | 'image';

/** The fields of an artwork the gallery page ships (`virtual:artorb-artworks`). */
export type SceneArtwork = Pick<Artwork, 'id' | 'title' | 'artist' | 'year' | 'img' | 'w' | 'h' | 'source' | 'tag'>;
