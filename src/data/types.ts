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

/** One card floating in the 3D scene. Several cards can show the same artwork. */
export interface GalleryItem {
  id: string;
  /** Year as shown on the frame label. */
  date: string;
  /** Caption: 《title》 · artist · year. */
  text: string;
  /** Commons description page, opened from the focused caption. */
  url: string;
  /** 420px thumbnail used as the scene texture. */
  img: string;
  /** 960px image loaded when the card is focused. */
  imgFull: string;
  /** Highlighted cards: drawn larger, loaded first, may open the intro. */
  recap: boolean;
  w: number;
  h: number;
  artist: string;
  tag: ArtworkTag;
}

/** A segment of story text; the stories currently only use plain text runs. */
export interface StoryRun {
  t?: string;
  href?: string;
  br?: boolean;
}

export interface Story {
  label: string;
  years: string;
  city: string;
  color: string;
  runs: StoryRun[];
}
