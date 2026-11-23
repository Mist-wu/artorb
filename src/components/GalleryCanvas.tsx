import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import type { GalleryItem } from '../data/types.ts';
import { FRAME_COLOR } from '../scene/constants.ts';
import { createGalleryScene, type SceneCallbacks, type SceneControls } from '../scene/gallery-scene.ts';

interface GalleryCanvasProps extends SceneCallbacks {
  items: GalleryItem[];
  controlsRef: { current: SceneControls };
  /** Label pinned to the top-left of the overlay box. */
  frameLabel: ReactNode;
  /** Caption pinned to the bottom-right of the overlay box. */
  frameCaption: ReactNode;
}

/**
 * Full-screen WebGL card cloud plus the 2D overlay box that the render loop
 * positions every frame; its label and caption ride on the box's border.
 */
export function GalleryCanvas({
  items,
  controlsRef,
  onHoverItem,
  onFocusChange,
  onReady,
  frameLabel,
  frameCaption,
}: GalleryCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<HTMLDivElement>(null);
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
      overlay: { root: overlayRef, bbox: bboxRef },
    });
    // The scene is rebuilt only when the card list changes; controls and
    // callbacks are read through refs on every frame.
  }, [items]);

  return (
    <div
      ref={containerRef}
      style={{ '--cvframe': FRAME_COLOR } as CSSProperties}
      className="fixed inset-0 touch-none select-none overflow-hidden"
    >
      <div
        ref={overlayRef}
        style={{ opacity: 0 }}
        className="cloud-overlay pointer-events-none absolute inset-0"
      >
        <div ref={bboxRef} className="cloud-bbox absolute left-0 top-0 will-change-transform">
          <div className="cloud-label pointer-events-auto absolute w-max">{frameLabel}</div>
          <div className="cloud-caption absolute w-max">{frameCaption}</div>
        </div>
      </div>
    </div>
  );
}
