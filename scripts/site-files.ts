/**
 * Build-time content derived from data/artworks.json and src/site.ts:
 * credits table rows and the Cloudflare Pages deployment files.
 */
import { thumbPath } from '../src/data/gallery.ts';
import type { Artwork } from '../src/data/types.ts';
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '../src/site.ts';

/** Same escaping as Python's html.escape(s, quote=True). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Fill `%SITE_*%` placeholders in an HTML template. */
export function fillSiteTokens(html: string): string {
  return html
    .replaceAll('%SITE_URL%', SITE_URL)
    .replaceAll('%SITE_TITLE%', escapeHtml(SITE_TITLE))
    .replaceAll('%SITE_DESCRIPTION%', escapeHtml(SITE_DESCRIPTION));
}

/** One table row per artwork: image, Commons page, artist · year, original file. */
export function creditRows(arts: Artwork[]): string {
  return arts
    .map(
      (a) =>
        `<tr><td><img src="${a.img}" alt="${escapeHtml(a.title)}" loading="lazy"></td>` +
        `<td><a href="${escapeHtml(a.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>` +
        `<br><small>${escapeHtml(a.artist)} · ${a.year}</small></td>` +
        `<td><a href="${escapeHtml(a.original)}">原图 ↗</a></td></tr>`,
    )
    .join('');
}

/** Files emitted next to the pages in dist/. */
export function deployFiles(arts: Artwork[]): Record<string, string> {
  const withThumbs = arts.map((a) => ({ ...a, thumb: thumbPath(a) }));
  return {
    'artworks.json': JSON.stringify(withThumbs, null, 2),
    _headers: `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
/
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/art/*
  Cache-Control: public, max-age=604800
`,
    'robots.txt': `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    'sitemap.xml':
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      `<url><loc>${SITE_URL}/</loc></url><url><loc>${SITE_URL}/credits</loc></url></urlset>`,
  };
}
