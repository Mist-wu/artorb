import type { Connect, Plugin } from 'vite';
import { sceneArtwork } from '../src/data/gallery.ts';
import { artworks, creditRows, creditSummary, deployFiles, fillSiteTokens } from './site-files.ts';

/** Scene-only artwork list for the gallery page and its prerender. */
const SCENE_MODULE = 'virtual:artorb-artworks';
const RESOLVED_SCENE_MODULE = '\0' + SCENE_MODULE;

/** Serve `/credits` like Cloudflare Pages does (extensionless `.html`). */
const prettyUrls: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url === '/credits' || req.url?.startsWith('/credits?')) {
    req.url = req.url.replace('/credits', '/credits.html');
  }
  next();
};

/** Fills the HTML templates, provides the scene artwork module and emits robots.txt, sitemap.xml, _headers and artworks.json. */
export function artorbSite(): Plugin {
  return {
    name: 'artorb-site',
    resolveId(id) {
      return id === SCENE_MODULE ? RESOLVED_SCENE_MODULE : undefined;
    },
    load(id) {
      return id === RESOLVED_SCENE_MODULE ? `export default ${JSON.stringify(artworks.map(sceneArtwork))};` : undefined;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return fillSiteTokens(html)
          .replace('<!--credits-summary-->', creditSummary(artworks))
          .replace('<!--credits-rows-->', creditRows(artworks));
      },
    },
    configureServer(server) {
      server.middlewares.use(prettyUrls);
    },
    configurePreviewServer(server) {
      server.middlewares.use(prettyUrls);
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(deployFiles(artworks))) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}
