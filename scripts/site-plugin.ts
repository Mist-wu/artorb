import type { Connect, Plugin } from 'vite';
import { artworks } from '../src/data/gallery.ts';
import { creditRows, deployFiles, fillSiteTokens } from './site-files.ts';

/** Serve `/credits` like Cloudflare Pages does (extensionless `.html`). */
const prettyUrls: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url === '/credits' || req.url?.startsWith('/credits?')) {
    req.url = req.url.replace('/credits', '/credits.html');
  }
  next();
};

/** Fills the HTML templates and emits robots.txt, sitemap.xml, _headers and artworks.json. */
export function artorbSite(): Plugin {
  return {
    name: 'artorb-site',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return fillSiteTokens(html).replace('<!--credits-rows-->', creditRows(artworks));
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
