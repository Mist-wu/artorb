import type { Shape } from '../data/views.ts';

export const BACKGROUND = '#bfbfbf';
/** Default frame / chip colour of the overlay. */
export const FRAME_COLOR = '#26262b';
/** Fallback accents, picked by card index when a thumbnail has no clear hue. */
export const ACCENTS = ['#00c853', '#2979ff', '#ff2fae', '#ffc400', '#e8442e'];

/** Per-shape drift amplitude (`noise`) and card size multiplier (`card`). */
export const SHAPE_TUNING: Record<Shape, { noise: number; card: number }> = {
  sphere: { noise: 1, card: 1 },
  heart: { noise: 0.2, card: 0.7 },
  smiley: { noise: 0.12, card: 0.58 },
  star: { noise: 0.12, card: 0.6 },
  grid: { noise: 0.02, card: 1 },
};

/** Vertical field of view of the camera, in degrees. */
export const CAMERA_FOV = 40;
/** Long edge of a card in world units before scaling. */
export const CARD_SIZE = 1.8;
/** Radius of the default sphere layout. */
export const SPHERE_RADIUS = 4.6;
/** At most this many thumbnails are requested at once. */
export const MAX_CONCURRENT_LOADS = 6;
/** The intro starts once this share of thumbnails has settled (or after the timeout). */
export const READY_SHARE = 0.65;
export const READY_TIMEOUT_MS = 6000;
