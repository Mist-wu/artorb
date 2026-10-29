/* Progressive enhancement: native links still work without JavaScript. */
(() => {
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let timer;
  let leaving = false;

  const reset = () => {
    clearTimeout(timer);
    leaving = false;
    root.classList.remove('artorb-leaving');
  };
  addEventListener('pageshow', reset);
  addEventListener('pagehide', reset);
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') reset();
  });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('download') ||
        (link.target && link.target !== '_self')) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) ||
        (url.pathname === location.pathname && url.search === location.search)) return;
    if (reducedMotion.matches) return;

    event.preventDefault();
    if (leaving) return;
    leaving = true;
    root.classList.add('artorb-leaving');
    timer = setTimeout(() => location.assign(url.href), 180);
  });
})();
