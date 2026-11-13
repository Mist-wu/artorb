/**
 * Curate public-domain master paintings from Wikimedia Commons, with license checks.
 * No source images are hotlinked at runtime: optimized local copies are deployed.
 *
 * Reads data/curation.json, caches API responses in data/commons-cache/, downloads
 * 960px images to public/art/ and writes data/artworks.json. Cached responses and
 * existing images are reused. Uses macOS `sips` to read image dimensions.
 *
 *   npm run collect && npm run thumbs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Artwork } from '../src/data/types.ts';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, 'data/commons-cache');
const IMAGES = resolve(ROOT, 'public/art');
const USER_AGENT = 'Artorb/1.0 (public-domain art study)';
/** Artists whose works are woodblock prints rather than paintings. */
const PRINTMAKERS = ['葛饰北斋', '歌川广重'];

mkdirSync(CACHE, { recursive: true });
mkdirSync(IMAGES, { recursive: true });

/** [Wikipedia page title, Chinese title, artist, year] */
type CurationEntry = [page: string, title: string, artist: string, year: number];
const curation = JSON.parse(readFileSync(resolve(ROOT, 'data/curation.json'), 'utf8')) as CurationEntry[];

/** Download `url` to `file`, retrying with the MediaWiki maxlag hint. */
async function download(url: string, file: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = url + (attempt && url.includes('/w/api.php?') ? '&maxlag=5' : '');
    try {
      const res = await fetch(actual, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(80_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      await sleep(1000);
      return;
    } catch {
      await sleep((2 + attempt) * 1000);
    }
  }
  throw new Error('Unable to download ' + url);
}

const api = (host: string, params: Record<string, string | number>) =>
  `https://${host}/w/api.php?` +
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

interface PageRow {
  title: string;
  thumbnail?: { source: string };
  original?: { source: string };
}

// 1. Wikipedia page images, 20 titles per request.
const pages = new Map<string, PageRow>();
for (let start = 0; start < curation.length; start += 20) {
  const batch = curation.slice(start, start + 20);
  const file = resolve(CACHE, `pages-${start}.json`);
  if (!existsSync(file)) {
    await download(
      api('en.wikipedia.org', {
        action: 'query',
        format: 'json',
        redirects: 1,
        titles: batch.map((a) => a[0]).join('|'),
        prop: 'pageimages',
        piprop: 'thumbnail|original',
        pithumbsize: 960,
      }),
      file,
    );
  }
  const data = readJson(file).query;
  const rows = new Map<string, PageRow>(
    Object.values(data.pages as Record<string, PageRow>).map((v) => [v.title, v]),
  );
  const normalized = new Map<string, string>((data.normalized ?? []).map((v: { from: string; to: string }) => [v.from, v.to]));
  const redirected = new Map<string, string>((data.redirects ?? []).map((v: { from: string; to: string }) => [v.from, v.to]));
  for (const [page] of batch) {
    let title = normalized.get(page) ?? page;
    title = redirected.get(title) ?? title;
    const row = rows.get(title);
    if (row) pages.set(page, row);
  }
}

// 2. Commons license metadata, then the image itself.
const arts: Artwork[] = [];
for (const [i, [page, title, artist, year]] of curation.entries()) {
  const row = pages.get(page);
  if (!row?.thumbnail || !row.original) {
    console.log('SKIP missing', page);
    continue;
  }
  const original = row.original.source.split('?')[0];
  if (!original.includes('/wikipedia/commons/')) {
    console.log('SKIP non-commons', page);
    continue;
  }
  const filename = decodeURIComponent(new URL(original).pathname.split('/').pop()!);
  const licenseFile = resolve(CACHE, `license-${i}.json`);
  if (!existsSync(licenseFile)) {
    await download(
      api('commons.wikimedia.org', {
        action: 'query',
        format: 'json',
        titles: 'File:' + filename,
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
      }),
      licenseFile,
    );
  }
  const metadata = readJson(licenseFile).query?.pages ?? {};
  const info = Object.values(metadata as Record<string, { imageinfo?: any[] }>).find((v) => v.imageinfo)
    ?.imageinfo?.[0];
  if (!info) {
    console.log('SKIP metadata', page);
    continue;
  }
  const em = info.extmetadata;
  const license: string = em.LicenseShortName?.value ?? '';
  const copyrighted: string = em.Copyrighted?.value ?? '';
  if (copyrighted !== 'False' || !(license.toLowerCase().includes('public domain') || license.toLowerCase() === 'cc0')) {
    console.log('SKIP license', page, license, copyrighted);
    continue;
  }
  const thumb = row.thumbnail.source.split('?')[0];
  const id = `master-${String(i).padStart(2, '0')}`;
  const file = resolve(IMAGES, `${id}.jpg`);
  if (!existsSync(file)) await download(thumb, file);
  // Real dimensions of the downloaded file (Commons may round the thumbnail size).
  const output = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  const w = Number(/pixelWidth: (\d+)/.exec(output)![1]);
  const h = Number(/pixelHeight: (\d+)/.exec(output)![1]);
  const art: Artwork = {
    id,
    title,
    title_en: row.title,
    artist,
    year,
    img: `/art/${id}.jpg`,
    w,
    h,
    source: info.descriptionurl,
    license,
    original,
    downloaded_from: thumb,
    tag: PRINTMAKERS.includes(artist) ? 'image' : 'prototype',
  };
  arts.push(art);
  // Python's json.dumps(ensure_ascii=False, indent=2) layout, kept for clean diffs.
  writeFileSync(resolve(ROOT, 'data/artworks.json'), JSON.stringify(arts, null, 2));
  console.log('OK', art.id, title, license, statSync(file).size);
}
console.log('TOTAL', arts.length);
