import { createRoot, hydrateRoot } from 'react-dom/client';
import artworks from 'virtual:artorb-artworks';
import { App } from './App.tsx';
import { buildGalleryItems } from './data/gallery.ts';
import { installPageTransitions } from './navigation.ts';

installPageTransitions();

const root = document.getElementById('root')!;
const app = <App items={buildGalleryItems(artworks)} />;
// Production HTML is prerendered (see scripts/build.ts); the dev server renders on the client.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
