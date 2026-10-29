const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(`${__dirname}/../public/navigation.js`, 'utf8');

function setup(reduced = false) {
  const events = {};
  const classes = new Set();
  const timers = new Map();
  const navigations = [];
  let id = 0;
  class Element {
    constructor(link) { this.link = link; }
    closest() { return this.link; }
  }
  const location = {
    href: 'https://art.mistwu.com/', origin: 'https://art.mistwu.com',
    pathname: '/', search: '', assign: (url) => navigations.push(url),
  };
  const classList = { add: (s) => classes.add(s), remove: (s) => classes.delete(s) };
  runInNewContext(source, {
    Element, URL, location,
    matchMedia: () => ({ matches: reduced }),
    addEventListener: (type, fn) => { events[type] = fn; },
    document: {
      documentElement: { classList },
      addEventListener: (type, fn) => { events[type] = fn; },
    },
    setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; },
    clearTimeout: (key) => timers.delete(key),
  });
  function click(options = {}) {
    const link = {
      href: 'https://art.mistwu.com/credits', target: '',
      hasAttribute: () => false, ...options.link,
    };
    const event = {
      button: 0, target: new Element(link), defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...options.event,
    };
    events.click(event);
    return event;
  }
  return { events, classes, timers, navigations, click };
}

test('internal links fade for 180ms before native navigation', () => {
  const s = setup();
  assert.equal(s.click().defaultPrevented, true);
  assert.ok(s.classes.has('artorb-leaving'));
  const timer = [...s.timers.values()][0];
  assert.equal(timer.delay, 180);
  assert.deepEqual(s.navigations, []);
  timer.fn();
  assert.deepEqual(s.navigations, ['https://art.mistwu.com/credits']);
});

for (const [name, options] of [
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
]) {
  test(`${name} preserves native behavior`, () => {
    const s = setup();
    assert.equal(s.click(options).defaultPrevented, false);
    assert.equal(s.timers.size, 0);
    assert.equal(s.classes.size, 0);
  });
}

test('reduced motion navigates without delay', () => {
  const s = setup(true);
  assert.equal(s.click().defaultPrevented, false);
  assert.equal(s.timers.size, 0);
});

for (const type of ['pageshow', 'pagehide', 'keydown']) {
  test(`${type} clears the veil and pending navigation`, () => {
    const s = setup();
    s.click();
    s.events[type]({ key: 'Escape' });
    assert.equal(s.timers.size, 0);
    assert.equal(s.classes.size, 0);
    assert.equal(s.click().defaultPrevented, true);
    assert.equal(s.timers.size, 1);
  });
}

test('rapid double clicks only schedule one navigation', () => {
  const s = setup();
  s.click();
  s.click();
  assert.equal(s.timers.size, 1);
});
