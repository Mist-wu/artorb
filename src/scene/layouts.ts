import type { Vector3 } from 'three';
import type { Shape } from '../data/views.ts';
import { SPHERE_RADIUS } from './constants.ts';
import { fract, hashNoise } from './noise.ts';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PHI_FRACTION = 0.61803398875;
const PLASTIC_FRACTION = 0.7548776662;

/** Fibonacci sphere point for card `ordinal` of `count`. */
export function spherePoint(ordinal: number, count: number, out: Vector3): void {
  const y = 1 - 2 * (count <= 1 ? 0 : ordinal / (count - 1));
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = ordinal * GOLDEN_ANGLE;
  out.set(
    Math.cos(theta) * radius * SPHERE_RADIUS,
    SPHERE_RADIUS * y * 0.92,
    Math.sin(theta) * radius * SPHERE_RADIUS,
  );
}

function heartPoint(ordinal: number, out: Vector3): void {
  const t = fract(PHI_FRACTION * ordinal) * Math.PI * 2;
  const s = Math.sin(t);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  const fill = Math.pow(fract(PLASTIC_FRACTION * ordinal), 0.35);
  out.set(
    16 * s * s * s * fill * 0.3,
    (-2.6 + (y - -2.6) * fill + 2.6) * 0.3,
    1.2 * hashNoise(5 * ordinal + 4),
  );
}

/** Face outline (44%), two eyes (11%), then the smile. */
function smileyPoint(ordinal: number, count: number, out: Vector3): void {
  const u = count <= 1 ? 0 : ordinal / count;
  const a = fract(PHI_FRACTION * ordinal + 0.13);
  const b = fract(PLASTIC_FRACTION * ordinal + 0.37);
  if (u < 0.44) {
    const t = (u / 0.44) * Math.PI * 2;
    out.set(4.3 * Math.sin(t), 4.3 * Math.cos(t), 0.9 * hashNoise(5 * ordinal + 4));
  } else if (u < 0.55) {
    const t = a * Math.PI * 2;
    const r = Math.sqrt(b);
    out.set(
      1.5 * (u < 0.495 ? -1 : 1) + 0.5 * Math.cos(t) * r,
      1.35 + 0.95 * Math.sin(t) * r,
      0.7 * hashNoise(5 * ordinal + 4),
    );
  } else {
    const t = (Math.PI / 180) * (205 + ((u - 0.55) / 0.45) * 130);
    const r = 2.55 + 0.35 * hashNoise(11 * ordinal + 3);
    out.set(Math.cos(t) * r, Math.sin(t) * r + 0.35, 0.7 * hashNoise(5 * ordinal + 4));
  }
}

/** Five-pointed star: points interpolated along its ten edges, pulled toward the centre. */
function starPoint(ordinal: number, out: Vector3): void {
  const edgePos = 10 * fract(PHI_FRACTION * ordinal);
  const edge = Math.floor(edgePos);
  const along = edgePos - edge;
  const a0 = (edge / 10) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((edge + 1) / 10) * Math.PI * 2 - Math.PI / 2;
  const r0 = edge % 2 == 0 ? 4.9 : 2;
  const r1 = edge % 2 == 0 ? 2 : 4.9;
  const x = Math.cos(a0) * r0 + (Math.cos(a1) * r1 - Math.cos(a0) * r0) * along;
  const y = -(Math.sin(a0) * r0 + (Math.sin(a1) * r1 - Math.sin(a0) * r0) * along);
  const fill = Math.pow(fract(PLASTIC_FRACTION * ordinal), 0.4);
  out.set(x * fill, y * fill + 0.2, 0.9 * hashNoise(5 * ordinal + 4));
}

/** Target position of a card in one of the non-grid shapes. */
export function shapePoint(
  shape: Exclude<Shape, 'grid'>,
  ordinal: number,
  count: number,
  out: Vector3,
): void {
  if (shape === 'heart') heartPoint(ordinal, out);
  else if (shape === 'smiley') smileyPoint(ordinal, count, out);
  else if (shape === 'star') starPoint(ordinal, out);
  else spherePoint(ordinal, count, out);
}
