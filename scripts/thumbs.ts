/**
 * Generate 420px thumbnails (public/art/thumbs/) for every artwork. Small
 * textures keep the 307 WebGL cards affordable on phones. Existing thumbnails
 * are kept. Uses macOS `sips`.
 *
 *   npm run thumbs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { artworks, thumbPath } from '../src/data/gallery.ts';

const PUBLIC = resolve(import.meta.dirname, '../public');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

mkdirSync(resolve(PUBLIC, 'art/thumbs'), { recursive: true });
let created = 0;
for (const art of artworks) {
  const original = resolve(PUBLIC, art.img.slice(1));
  if (!existsSync(original)) throw new Error(`Missing ${art.img}; run npm run collect first`);
  if (readFileSync(original).subarray(0, 8).equals(PNG_MAGIC)) {
    // A Commons PNG may use a .jpg local name; normalize before Pages assigns its MIME type.
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', original, '--out', original], {
      stdio: 'ignore',
    });
  }
  const target = resolve(PUBLIC, thumbPath(art).slice(1));
  if (!existsSync(target)) {
    execFileSync('sips', ['-Z', '420', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', original, '--out', target], {
      stdio: 'ignore',
    });
    created++;
  }
}
console.log(`${artworks.length} artworks, ${created} new thumbnails.`);
