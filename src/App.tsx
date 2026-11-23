import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { FilterBar } from './components/FilterBar.tsx';
import { ShapePager } from './components/ShapePager.tsx';
import { StoryOverlay } from './components/StoryOverlay.tsx';
import type { SceneArtwork } from './data/types.ts';
import { SHAPES, type FilterId, type Shape, type ViewMode } from './data/views.ts';
import { BACKGROUND } from './scene/constants.ts';
import { createGalleryScene, type SceneControls } from './scene/gallery-scene.ts';

/** Auto-advance the shape after this much inactivity (checked every 8s). */
const IDLE_ADVANCE_MS = 10_000;
const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

const BOTTOM_FADE = `linear-gradient(to top, ${BACKGROUND} 30%, rgba(191,191,191,0.85) 50%, rgba(191,191,191,0.55) 68%, rgba(191,191,191,0.25) 84%, rgba(191,191,191,0))`;

export function App({ items }: { items: SceneArtwork[] }) {
  const [started, setStarted] = useState(false);
  const [filter, setFilterState] = useState<FilterId>('all');
  const [shape, setShapeState] = useState<ViewMode>('sphere');
  const [hoverItem, setHoverItem] = useState<SceneArtwork | null>(null);
  const [focusItem, setFocusItem] = useState<SceneArtwork | null>(null);
  const controlsRef = useRef<SceneControls>({ filter: 'all', shape: 'sphere', started: false });

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => createGalleryScene(containerRef.current!, items, controlsRef, {
    onHoverItem: setHoverItem,
    onFocusChange: setFocusItem,
    onReady() {
      controlsRef.current.started = true;
      setStarted(true);
    },
  }), [items]);

  // Escape closes the story view.
  useEffect(() => {
    if (shape !== 'about') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShape(lastShape.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shape]);

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
  const shapeIndex = SHAPES.indexOf(shape === 'about' ? lastShape.current : shape);

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
    setShape(SHAPES[(shapeIndex + dir + SHAPES.length) % SHAPES.length]);
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
    if (!started || shape === 'about' || focusItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, shape, focusItem, shapeIndex]);

  const controlsVisible = started && shape !== 'about';

  const activeItem = focusItem ?? hoverItem;
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: BACKGROUND }}>
      <img
        src="/images/pfp-mark.svg"
        alt="artorb"
        className="pointer-events-none absolute left-[30px] top-[25px] h-[52px] w-auto sm:left-6 sm:top-4"
      />
      <div ref={containerRef} className="fixed inset-0 touch-none select-none" />
      {shape === 'about' && <StoryOverlay />}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[15] h-[130px] transition-[height] duration-500 ease-out sm:h-44"
        style={{ background: BOTTOM_FADE }}
      />
      {controlsVisible && activeItem && (
        <div className="pointer-events-none absolute inset-x-5 bottom-16 z-[16] text-center leading-tight text-[#242427]">
          <div className="text-[20px] font-semibold">
            {focusItem ? (
              <a href={focusItem.source} target="_blank" rel="noopener noreferrer" className="pointer-events-auto hover:underline">
                {focusItem.title} ↗
              </a>
            ) : activeItem.title}
          </div>
          <div className="mt-1 text-[14px]">{activeItem.artist} · {activeItem.year}</div>
        </div>
      )}
      <ShapePager
        menuRef={menuRef}
        visible={controlsVisible}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        shapeIndex={shapeIndex}
        direction={direction}
        step={step}
        selectShape={setShape}
      />
      <FilterBar
        visible={controlsVisible}
        menuOpen={menuOpen}
        filter={filter}
        onSelect={setFilter}
      />
      <motion.button
        onClick={() => setShape(shape === 'about' ? lastShape.current : 'about')}
        disabled={!started}
        whileTap={{ scale: 0.94 }}
        initial={false}
        animate={{ opacity: +!!started, y: started ? 0 : -14 }}
        transition={
          started ? { type: 'spring', stiffness: 210, damping: 26, delay: 0.5 } : { duration: 0.25 }
        }
        className="absolute right-[30px] top-[30px] z-20 cursor-pointer sm:right-6 sm:top-4 whitespace-nowrap text-[17px] lowercase leading-none text-black/80 transition-colors duration-200 hover:text-black"
      >
        {shape === 'about' ? '关闭' : '名画介绍'}
      </motion.button>
    </div>
  );
}
