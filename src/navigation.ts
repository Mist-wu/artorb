/**
 * Quiet page transitions: same-origin link clicks fade a grey veil in for
 * 180ms before navigating natively. Progressive enhancement only — links keep
 * working without JavaScript, and new-tab, modified, download, external and
 * same-page clicks are left to the browser.
 */

export const LEAVING_CLASS = 'artorb-leaving';
export const LEAVE_DELAY_MS = 180;

/** The globals the transitions touch; injectable for tests. */
export interface NavigationEnv {
  root: { classList: Pick<DOMTokenList, 'add' | 'remove'> };
  document: Pick<Document, 'addEventListener'>;
  location: Pick<Location, 'href' | 'origin' | 'pathname' | 'search' | 'assign'>;
  matchMedia(query: string): Pick<MediaQueryList, 'matches'>;
  addEventListener(type: string, listener: (event: any) => void): void;
  setTimeout(fn: () => void, delay: number): unknown;
  clearTimeout(id: unknown): void;
  Element: abstract new (...args: any[]) => { closest(selector: string): unknown };
}

interface LinkLike {
  href: string;
  target: string;
  hasAttribute(name: string): boolean;
}

function browserEnv(): NavigationEnv {
  return {
    root: document.documentElement,
    document,
    location,
    matchMedia: (q) => window.matchMedia(q),
    addEventListener: (type, fn) => window.addEventListener(type, fn),
    setTimeout: (fn, delay) => window.setTimeout(fn, delay),
    clearTimeout: (id) => window.clearTimeout(id as number),
    Element,
  };
}

export function installPageTransitions(env: NavigationEnv = browserEnv()): void {
  const { root, location } = env;
  const reducedMotion = env.matchMedia('(prefers-reduced-motion: reduce)');
  let timer: unknown;
  let leaving = false;

  const reset = () => {
    env.clearTimeout(timer);
    leaving = false;
    root.classList.remove(LEAVING_CLASS);
  };
  env.addEventListener('pageshow', reset);
  env.addEventListener('pagehide', reset);
  env.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') reset();
  });

  env.document.addEventListener('click', (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link =
      event.target instanceof env.Element
        ? (event.target.closest('a[href]') as LinkLike | null)
        : null;
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;

    const url = new URL(link.href, location.href);
    if (
      url.origin !== location.origin ||
      !/^https?:$/.test(url.protocol) ||
      (url.pathname === location.pathname && url.search === location.search)
    )
      return;
    if (reducedMotion.matches) return;

    event.preventDefault();
    if (leaving) return;
    leaving = true;
    root.classList.add(LEAVING_CLASS);
    timer = env.setTimeout(() => location.assign(url.href), LEAVE_DELAY_MS);
  });
}
