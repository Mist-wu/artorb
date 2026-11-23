import { renderToString } from 'react-dom/server';
import artworks from 'virtual:artorb-artworks';
import { App } from './App.tsx';
import { buildGalleryItems } from './data/gallery.ts';

/** Static HTML of the first frame, injected into dist/index.html at build time. */
export function render(): string {
  return renderToString(<App items={buildGalleryItems(artworks)} />);
}
