/** Black or white text, whichever reads better on a `#rrggbb` background. */
export function textColorOn(hex: string): '#000' | '#fff' {
  const v = parseInt(hex.slice(1), 16);
  const luma = 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (255 & v);
  return luma > 150 ? '#000' : '#fff';
}
