import { expect, test } from 'vitest';
import { artworks, CARD_COUNT, galleryItems, stories } from '../src/data/gallery.ts';
import { FILTERS, tagMatchesFilter } from '../src/data/views.ts';
import { textColorOn } from '../src/lib/color.ts';
import { creditRows, escapeHtml } from '../scripts/site-files.ts';

test('cards cycle through every artwork', () => {
  expect(artworks).toHaveLength(56);
  expect(galleryItems).toHaveLength(CARD_COUNT);
  expect(galleryItems[0]).toEqual({
    id: 'master-00:0',
    date: '1889',
    text: '《星月夜》 · 文森特·梵高 · 1889',
    url: 'https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    img: '/art/thumbs/master-00.jpg',
    imgFull: '/art/master-00.jpg',
    recap: true,
    w: 960,
    h: 760,
    artist: '文森特·梵高',
    tag: 'prototype',
  });
  expect(galleryItems[56].id).toBe('master-00:56');
  expect(galleryItems.filter((item) => item.recap).map((item) => item.id.split(':')[1])).toEqual(
    ['0', '1', '2', '3', '4', '5', '6', '7'],
  );
});

test('frame label counts distinct artworks per filter', () => {
  const counts = FILTERS.map(
    (f) => new Set(galleryItems.filter((item) => tagMatchesFilter(item.tag, f.id)).map((item) => item.img)).size,
  );
  expect(counts).toEqual([56, 53, 3]);
});

test('every story has an accent colour', () => {
  expect(stories).toHaveLength(8);
  for (const story of stories) expect(story.color).toMatch(/^#[0-9a-f]{6}$/);
});

test('text colour contrasts with the accent', () => {
  expect(textColorOn('#ffd400')).toBe('#000');
  expect(textColorOn('#26262b')).toBe('#fff');
});

test('credits escape like Python html.escape', () => {
  expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#x27;&amp;&#x27;&lt;/a&gt;');
  expect(creditRows(artworks.slice(0, 1))).toContain('<small>文森特·梵高 · 1889</small>');
});
