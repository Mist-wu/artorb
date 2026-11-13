/** Deterministic pseudo-random value in [-0.5, 0.5) for a seed. */
export function hashNoise(seed: number): number {
  const v = 43758.5453 * Math.sin(127.1 * seed + 311.7);
  return v - Math.floor(v) - 0.5;
}

/** Fractional part, always in [0, 1). */
export function fract(x: number): number {
  return x - Math.floor(x);
}

/** In-place Fisher–Yates shuffle using Math.random. */
export function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
