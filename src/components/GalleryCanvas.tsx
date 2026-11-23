import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { GalleryItem } from '../data/types.ts';
import {
  createGalleryScene,
  type ChipKey,
  type SceneCallbacks,
  type SceneControls,
} from '../scene/gallery-scene.ts';

interface GalleryCanvasProps extends SceneCallbacks {
  items: GalleryItem[];
  controlsRef: { current: SceneControls };
  /** Label pinned to the top-left of the overlay box. */
  frameLabel: ReactNode;
  /** Caption pinned to the bottom-right of the overlay box. */
  frameCaption: ReactNode;
  frameColor: string;
}

const CHIPS: ChipKey[] = ['rotate', 'noise', 'zoom', 'shape', 'depth'];
const CHIP_CLASS =
  'cloud-value-chip pointer-events-none absolute left-0 top-0 will-change-transform whitespace-nowrap px-1.5 py-0.5 font-mono text-[10px] leading-tight text-white';

/**
 * Full-screen WebGL card cloud plus the 2D overlay (box, label, caption and
 * value chips) that the render loop positions every frame.
 */
export function GalleryCanvas({
  items,
  controlsRef,
  onHoverItem,
  onFocusChange,
  onReady,
  frameLabel,
  frameCaption,
  frameColor,
}: GalleryCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Partial<Record<ChipKey, HTMLSpanElement | null>>>({});
  const callbacksRef = useRef<SceneCallbacks>({ onHoverItem, onFocusChange, onReady });
  callbacksRef.current = { onHoverItem, onFocusChange, onReady };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    return createGalleryScene({
      container,
      items,
      controls: controlsRef,
      callbacks: callbacksRef,
      overlay: {
        root: overlayRef,
        bbox: bboxRef,
        label: labelRef,
        caption: captionRef,
        chips: chipRefs,
      },
    });
    // The scene is rebuilt only when the card list changes; controls and
    // callbacks are read through refs on every frame.
  }, [items]);

  return (
    <div
      ref={containerRef}
      style={{ '--cvframe': frameColor } as CSSProperties}
      className="fixed inset-0 touch-none select-none overflow-hidden"
    >
      <div
        ref={overlayRef}
        style={{ opacity: 0 }}
        className="cloud-overlay pointer-events-none absolute inset-0"
      >
        <div ref={bboxRef} className="cloud-bbox absolute left-0 top-0 will-change-transform" />
        <div
          ref={labelRef}
          className="pointer-events-auto absolute left-0 top-0 will-change-transform"
        >
          {frameLabel}
        </div>
        <div ref={captionRef} className="absolute left-0 top-0 will-change-transform">
          {frameCaption}
        </div>
        {CHIPS.map((key) => (
          <span
            key={key}
            ref={(el) => {
              chipRefs.current[key] = el;
            }}
            className={CHIP_CLASS}
          />
        ))}
      </div>
    </div>
  );
}
