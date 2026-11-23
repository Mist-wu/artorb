/**
 * Production build: bundle both pages with Vite, then prerender the gallery's
 * first frame into dist/index.html so it paints before the JavaScript loads
 * (the client hydrates it).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outFile = resolve(root, 'dist/index.html');
const OUTLET = '<!--app-html-->';

await build({ root });

// Provenance fields ship only in /artworks.json, never in the page scripts.
const assets = resolve(root, 'dist/assets');
for (const file of await readdir(assets)) {
  if (file.endsWith('.js') && (await readFile(resolve(assets, file), 'utf8')).includes('downloaded_from')) {
    throw new Error(`dist/assets/${file} contains the full artwork list`);
  }
}

const server = await createServer({
  root,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
});
try {
  const { render } = (await server.ssrLoadModule('/src/entry-server.tsx')) as {
    render: () => string;
  };
  const html = await readFile(outFile, 'utf8');
  if (!html.includes(OUTLET)) throw new Error(`${OUTLET} missing from dist/index.html`);
  // React hoists image preloads into the markup; index.html already has them in <head>.
  const markup = render().replace(/<link rel="preload"[^>]*>/g, '');
  await writeFile(outFile, html.replace(OUTLET, markup));
  console.log('prerendered dist/index.html');
} finally {
  await server.close();
}
