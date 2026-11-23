import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedText } from './components/AnimatedText.tsx';
import { FilterBar } from './components/FilterBar.tsx';
import { GalleryCanvas } from './components/GalleryCanvas.tsx';
import { ShapePager } from './components/ShapePager.tsx';
import { AboutLinks, StoryOverlay } from './components/StoryOverlay.tsx';
import type { GalleryItem } from './data/types.ts';
import { FILTERS, SHAPES, tagMatchesFilter, type FilterId, type Shape, type ViewMode } from './data/views.ts';
import { textColorOn } from './lib/color.ts';
import { ACCENTS, BACKGROUND, FRAME_COLOR } from './scene/constants.ts';
import type { SceneControls } from './scene/gallery-scene.ts';

/** The intro preview runs for at least this long after mount. */
const MIN_INTRO_MS = 4000;
/** Auto-advance the shape after this much inactivity (checked every 8s). */
const IDLE_ADVANCE_MS = 10_000;
const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

const BOTTOM_FADE = `linear-gradient(to top, ${BACKGROUND} 30%, rgba(191,191,191,0.85) 50%, rgba(191,191,191,0.55) 68%, rgba(191,191,191,0.25) 84%, rgba(191,191,191,0))`;

export function App({ items }: { items: GalleryItem[] }) {
  const [started, setStarted] = useState(false);
  const [filter, setFilterState] = useState<FilterId>('all');
  const [shape, setShapeState] = useState<ViewMode>('sphere');
  const [hoverItem, setHoverItem] = useState<GalleryItem | null>(null);
  const [hoverAccent, setHoverAccent] = useState<string | null>(null);
  const [focusItem, setFocusItem] = useState<GalleryItem | null>(null);
  const [focusAccent, setFocusAccent] = useState<string | null>(null);
  const controlsRef = useRef<SceneControls>({ filter: 'all', shape: 'sphere', started: false });

  // Escape closes the story view.
  useEffect(() => {
    if (shape !== 'about') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShape('sphere');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shape]);

  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  const setShape = (next: ViewMode) => {
    setShapeState(next);
    controlsRef.current.shape = next;
  };
  const setFilter = (next: FilterId) => {
    setFilterState(next);
    controlsRef.current.filter = next;
  };

  // Last real shape, restored when the story view closes.
  const lastShape = useRef<Shape>('sphere');
  useEffect(() => {
    if (shape !== 'about') lastShape.current = shape;
  }, [shape]);
  const shapeIndex = Math.max(
    0,
    SHAPES.findIndex((s) => s.id === (shape === 'about' ? lastShape.current : shape)),
  );

  const [direction, setDirection] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const step = (dir: number) => {
    setDirection(dir);
    setShape(SHAPES[(shapeIndex + dir + SHAPES.length) % SHAPES.length].id);
  };

  // Idle visitors get a slow tour through the shapes.
  const lastActivity = useRef(0);
  useEffect(() => {
    lastActivity.current = performance.now();
    const onActivity = () => {
      lastActivity.current = performance.now();
    };
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity);
    return () => {
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity);
    };
  }, []);
  useEffect(() => {
    if (!started || shape === 'about' || menuOpen || focusItem) return;
    const timer = setInterval(() => {
      if (!document.hidden && performance.now() - lastActivity.current > IDLE_ADVANCE_MS) step(1);
    }, 8000);
    return () => clearInterval(timer);
    // `step` closes over shapeIndex, so the effect re-subscribes when it changes.
  }, [started, shape, menuOpen, focusItem, shapeIndex]);

  // ←/→ change shape (the scene uses them to browse while a card is focused).
  useEffect(() => {
    if (shape === 'about' || focusItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shape, focusItem, shapeIndex]);

  const artworkCount = useMemo(
    () => new Set(items.filter((item) => tagMatchesFilter(item.tag, filter)).map((item) => item.img)).size,
    [items, filter],
  );
  const filterDef = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const controlsVisible = started && shape !== 'about';

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  // On phones the open shape list needs the whole bottom row.
  const filtersVisible = controlsVisible && !(menuOpen && isMobile);

  const shownBefore = useRef(false);
  useEffect(() => {
    if (!controlsVisible) return;
    const timer = setTimeout(() => {
      shownBefore.current = true;
    }, 1400);
    return () => clearTimeout(timer);
  }, [controlsVisible]);

  const activeItem = focusItem ?? hoverItem;
  const accent = (focusItem ? focusAccent : hoverAccent) ?? ACCENTS[0];
  const ink = textColorOn(accent);

  const frameLabel = activeItem ? (
    <span
      className="block whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] leading-tight"
      style={{ background: accent, color: ink }}
    >
      {activeItem.date}
      {activeItem.artist ? ` · ${activeItem.artist}` : ''}
    </span>
  ) : (
    <span
      className="block cursor-default whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] leading-tight text-white"
      style={{ background: FRAME_COLOR }}
    >
      {'artorb · '}
      {shape === 'about' ? 'story' : filterDef.label}
      {' · '}
      {artworkCount}
    </span>
  );

  const frameCaption = activeItem ? (
    focusItem && focusItem.url ? (
      <a
        href={focusItem.url}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto block max-w-[340px] truncate whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] leading-tight lowercase hover:brightness-110"
        style={{ background: accent, color: ink }}
      >
        {focusItem.text || focusItem.date}
        {' ↗'}
      </a>
    ) : activeItem.text ? (
      <span
        className="block max-w-[340px] truncate whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] leading-tight lowercase"
        style={{ background: accent, color: ink }}
      >
        {activeItem.text}
      </span>
    ) : null
  ) : null;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: BACKGROUND }}>
      <img
        src="/images/pfp-mark.svg"
        alt="artorb"
        className="pointer-events-none absolute left-[30px] top-[25px] h-[52px] w-auto sm:left-6 sm:top-4"
      />
      <GalleryCanvas
        items={items}
        controlsRef={controlsRef}
        onHoverItem={(item, itemAccent) => {
          setHoverItem(item);
          setHoverAccent(itemAccent);
        }}
        onFocusChange={(item, itemAccent) => {
          setFocusItem(item);
          setFocusAccent(itemAccent);
        }}
        onReady={() => {
          const elapsed = mountedAt.current ? performance.now() - mountedAt.current : 0;
          setTimeout(
            () => {
              controlsRef.current.started = true;
              setStarted(true);
            },
            Math.max(0, MIN_INTRO_MS - elapsed),
          );
        }}
        frameLabel={frameLabel}
        frameCaption={frameCaption}
        frameColor={FRAME_COLOR}
      />
      {shape === 'about' && <StoryOverlay />}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[15] h-[130px] transition-[height] duration-500 ease-out sm:h-44"
        style={{ background: BOTTOM_FADE }}
      />
      {shape === 'about' && <AboutLinks />}
      <div>
        <ShapePager
          menuRef={menuRef}
          visible={controlsVisible}
          shownBefore={shownBefore.current}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          shapeIndex={shapeIndex}
          direction={direction}
          step={step}
          selectShape={setShape}
        />
        <FilterBar
          visible={filtersVisible}
          shownBefore={shownBefore.current}
          filter={filter}
          onSelect={setFilter}
        />
      </div>
      <motion.button
        onClick={() => setShape(shape === 'about' ? lastShape.current : 'about')}
        whileTap={{ scale: 0.94 }}
        initial={false}
        animate={{ opacity: +!!started, y: started ? 0 : -14 }}
        transition={
          started ? { type: 'spring', stiffness: 210, damping: 26, delay: 0.5 } : { duration: 0.25 }
        }
        className="absolute right-[30px] top-[30px] z-20 cursor-pointer sm:right-6 sm:top-4 whitespace-nowrap text-[17px] lowercase leading-none text-black/80 transition-colors duration-200 hover:text-black"
      >
        <AnimatedText text={shape === 'about' ? 'close' : '名画介绍'} />
      </motion.button>
    </div>
  );
}
