import { renderToString } from 'react-dom/server';
import { App } from './App.tsx';
import { galleryItems } from './data/gallery.ts';

/** Static HTML of the first frame, injected into dist/index.html at build time. */
export function render(): string {
  return renderToString(<App items={galleryItems} />);
}
