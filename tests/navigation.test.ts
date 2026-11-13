import { describe, expect, test } from 'vitest';
import { installPageTransitions, type NavigationEnv } from '../src/navigation.ts';

type Listener = (event: any) => void;

function setup(reduced = false) {
  const events: Record<string, Listener> = {};
  const classes = new Set<string>();
  const timers = new Map<number, { fn: () => void; delay: number }>();
  const navigations: string[] = [];
  let id = 0;
  class FakeElement {
    link: unknown;
    constructor(link: unknown) {
      this.link = link;
    }
    closest() {
      return this.link;
    }
  }
  const env: NavigationEnv = {
    root: { classList: { add: (s: string) => void classes.add(s), remove: (s: string) => void classes.delete(s) } },
    document: { addEventListener: ((type: string, fn: Listener) => (events[type] = fn)) as any },
    location: {
      href: 'https://art.mistwu.com/',
      origin: 'https://art.mistwu.com',
      pathname: '/',
      search: '',
      assign: (url: string | URL) => void navigations.push(String(url)),
    },
    matchMedia: () => ({ matches: reduced }),
    addEventListener: (type, fn) => (events[type] = fn),
    setTimeout: (fn, delay) => {
      timers.set(++id, { fn, delay });
      return id;
    },
    clearTimeout: (key) => void timers.delete(key as number),
    Element: FakeElement,
  };
  installPageTransitions(env);

  function click(options: { link?: object; event?: object } = {}) {
    const link = { href: 'https://art.mistwu.com/credits', target: '', hasAttribute: () => false, ...options.link };
    const event = {
      button: 0,
      target: new FakeElement(link),
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...options.event,
    };
    events.click(event);
    return event;
  }
  return { events, classes, timers, navigations, click };
}

test('internal links fade for 180ms before native navigation', () => {
  const s = setup();
  expect(s.click().defaultPrevented).toBe(true);
  expect(s.classes.has('artorb-leaving')).toBe(true);
  const timer = [...s.timers.values()][0];
  expect(timer.delay).toBe(180);
  expect(s.navigations).toEqual([]);
  timer.fn();
  expect(s.navigations).toEqual(['https://art.mistwu.com/credits']);
});

describe('native behavior is preserved', () => {
  test.each([
    ['new tab', { link: { target: '_blank' } }],
    ['external', { link: { href: 'https://commons.wikimedia.org/' } }],
    ['download', { link: { hasAttribute: () => true } }],
    ['hash', { link: { href: 'https://art.mistwu.com/#intro' } }],
    ['mail', { link: { href: 'mailto:test@example.com' } }],
    ['ctrl click', { event: { ctrlKey: true } }],
    ['cmd click', { event: { metaKey: true } }],
    ['shift click', { event: { shiftKey: true } }],
    ['alt click', { event: { altKey: true } }],
    ['middle click', { event: { button: 1 } }],
  ])('%s', (_name, options) => {
    const s = setup();
    expect(s.click(options).defaultPrevented).toBe(false);
    expect(s.timers.size).toBe(0);
    expect(s.classes.size).toBe(0);
  });
});

test('reduced motion navigates without delay', () => {
  const s = setup(true);
  expect(s.click().defaultPrevented).toBe(false);
  expect(s.timers.size).toBe(0);
});

test.each(['pageshow', 'pagehide', 'keydown'])('%s clears the veil and pending navigation', (type) => {
  const s = setup();
  s.click();
  s.events[type]({ key: 'Escape' });
  expect(s.timers.size).toBe(0);
  expect(s.classes.size).toBe(0);
  expect(s.click().defaultPrevented).toBe(true);
  expect(s.timers.size).toBe(1);
});

test('rapid double clicks only schedule one navigation', () => {
  const s = setup();
  s.click();
  s.click();
  expect(s.timers.size).toBe(1);
});
