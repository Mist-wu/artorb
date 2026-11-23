import { expect, test } from 'vitest';
import sceneArtworks from 'virtual:artorb-artworks';
import stories from '../data/stories.json';
import { tagMatchesFilter, FILTERS, LABELS, SHAPES, stepArtwork } from '../src/data/views.ts';
import { contrast, textColorOn } from '../src/lib/color.ts';
import { BACKGROUND } from '../src/scene/constants.ts';
import { artworks, creditRows, creditSummary, deployFiles, escapeHtml } from '../scripts/site-files.ts';

test('the gallery page gets only scene fields; the public list stays complete', () => {
  expect(sceneArtworks.map((art) => art.id)).toEqual(artworks.map((art) => art.id));
  expect(new Set(sceneArtworks.map((art) => art.img)).size).toBe(56);
  for (const art of sceneArtworks) {
    expect(Object.keys(art).sort()).toEqual(['artist', 'h', 'id', 'img', 'source', 'tag', 'title', 'w', 'year']);
  }
  const published = JSON.parse(deployFiles(artworks)['artworks.json']);
  expect(published).toHaveLength(56);
  for (const art of published) {
    for (const key of ['title_en', 'license', 'original', 'downloaded_from', 'source', 'thumb']) {
      expect(art[key], `${art.id}.${key}`).toBeTruthy();
    }
  }
});

test('the Lady of Shalott is Waterhouse’s 1888 painting', () => {
  const art = artworks.find((a) => a.id === 'master-50')!;
  expect(art).toMatchObject({ title: '夏洛特女郎', artist: '约翰·威廉·沃特豪斯', year: 1888, license: 'Public domain' });
  expect(art.source).toContain('John_William_Waterhouse_-_The_Lady_of_Shalott');
});

test('each filter browses its distinct artworks exactly once per loop', () => {
  const counts = FILTERS.map((filter) => {
    const order = sceneArtworks.filter((art) => tagMatchesFilter(art.tag, filter));
    const visited = new Set<string>();
    let at = order[0];
    for (let i = 0; i < order.length; i++) {
      visited.add(at.id);
      at = stepArtwork(order, at, 1);
    }
    expect(at).toBe(order[0]);
    expect(stepArtwork(order, order[0], -1)).toBe(order.at(-1));
    return visited.size;
  });
  expect(counts).toEqual([56, 53, 3]);
});

test('every shape and filter has a Chinese label', () => {
  expect(FILTERS.map((f) => LABELS[f])).toEqual(['全部', '绘画', '版画']);
  for (const shape of SHAPES) expect(LABELS[shape]).toMatch(/^\p{Script=Han}+$/u);
});

test('every story has an accent colour with readable title text', () => {
  expect(stories).toHaveLength(8);
  for (const story of stories) {
    expect(story.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrast(story.color, textColorOn(story.color) === '#000' ? '#000000' : '#ffffff')).toBeGreaterThanOrEqual(4.5);
  }
});

test('text colour picks the higher-contrast ink', () => {
  expect(textColorOn('#ffd400')).toBe('#000');
  expect(textColorOn('#26262b')).toBe('#fff');
  expect(textColorOn('#7c4dff')).toBe('#fff');
  expect(textColorOn('#2979ff')).toBe('#000');
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
});

test('unselected controls at 60% black are readable on the background', () => {
  const grey = Math.round(0.4 * parseInt(BACKGROUND.slice(1, 3), 16));
  const ink = '#' + grey.toString(16).padStart(2, '0').repeat(3);
  expect(contrast(ink, BACKGROUND)).toBeGreaterThanOrEqual(4.5);
});

test('credits escape like Python html.escape', () => {
  expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#x27;&amp;&#x27;&lt;/a&gt;');
  const row = creditRows(artworks.slice(0, 1));
  expect(row).toContain('<small>文森特·梵高 · 1889</small>');
  expect(row).toContain('<img src="/art/thumbs/master-00.jpg"');
  expect(creditSummary(artworks)).toContain('全部 56 幅作品的图片来自 Wikimedia Commons，许可均为 Public domain。');
});
