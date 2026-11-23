import { ACCENTS } from './constants.ts';

/**
 * Pick an accent colour for a card from its thumbnail: the saturation-weighted
 * mean hue of a 20×20 sample, rendered at fixed lightness. Falls back to the
 * card's palette colour when the image is too grey or cannot be read.
 */
export function accentFromImage(image: CanvasImageSource, seed: number): string {
  const fallback = ACCENTS[Math.abs(seed) % ACCENTS.length];
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 20;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;
    ctx.drawImage(image, 0, 0, 20, 20);
    const data = ctx.getImageData(0, 0, 20, 20).data;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let p = 0; p < data.length; p += 4) {
      const r = data[p] / 255;
      const g = data[p + 1] / 255;
      const b = data[p + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const light = (max + min) / 2;
      const chroma = 1 - Math.abs(2 * light - 1);
      const weight = (chroma === 0 ? 0 : (max - min) / chroma) * (1 - 1.3 * Math.abs(light - 0.5));
      if (weight < 0.35 || max === min) continue;
      let sector = 0;
      sector =
        max === r
          ? ((g - b) / (max - min)) % 6
          : max === g
            ? (b - r) / (max - min) + 2
            : (r - g) / (max - min) + 4;
      const hue = (((60 * sector + 360) % 360) * Math.PI) / 180;
      sumX += Math.cos(hue) * weight;
      sumY += Math.sin(hue) * weight;
      count++;
    }
    if (count < 4) return fallback;
    const hue = ((180 * Math.atan2(sumY, sumX)) / Math.PI + 360) % 360;
    return hslToHex(hue);
  } catch {
    return fallback;
  }
}

/** HSL → hex at the fixed accent lightness (0.52) and saturation. */
function hslToHex(hue: number): string {
  const a = 0.82 * Math.min(0.52, 0.48);
  const channel = (k0: number) => {
    const k = (k0 + hue / 30) % 12;
    return Math.round(255 * (0.52 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
