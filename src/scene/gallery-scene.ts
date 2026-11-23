import {
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import type { SceneArtwork } from '../data/types.ts';
import {
  stepArtwork,
  tagMatchesFilter,
  type FilterId,
  type Shape,
  type ViewMode,
} from '../data/views.ts';
import { thumbPath } from '../data/gallery.ts';
import {
  CAMERA_FOV,
  CARD_SIZE,
  MAX_CONCURRENT_LOADS,
  READY_SHARE,
  READY_TIMEOUT_MS,
  SHAPE_TUNING,
  SPHERE_RADIUS,
} from './constants.ts';
import { shapePoint, spherePoint } from './layouts.ts';
import { hashNoise, shuffle } from './noise.ts';

/** State the React UI writes and the render loop reads every frame. */
export interface SceneControls {
  filter: FilterId;
  shape: ViewMode;
  /** Set once the intro has finished; the cloud then fans out. */
  started: boolean;
}

interface SceneCallbacks {
  onHoverItem(item: SceneArtwork | null): void;
  onFocusChange(item: SceneArtwork | null): void;
  onReady(): void;
}

interface Card {
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  mat: MeshBasicMaterial;
  item: SceneArtwork;
  fullRequested: boolean;
  /** Thumbnail settled (loaded or failed). */
  texLoaded: boolean;
  recap: boolean;
  seed: number;
  hoverScale: number;
  visScale: number;
  gridX: number;
  gridY: number;
  gridScale: number;
  introDelay: number;
  introduced: boolean;
  introBlend: number;
  sortDist: number;
  /** Position among the cards that pass the current filter. */
  ordinal: number;
  shown: boolean;
  baseW: number;
  baseH: number;
}

const HALF_FOV = MathUtils.degToRad(CAMERA_FOV / 2);
/** Distance in front of the camera at which the focused / intro card is shown. */
const FOCUS_DEPTH = 6;

/**
 * Build the WebGL gallery inside `container` and start its render loop.
 * Returns a function that stops the loop and releases every GPU resource.
 */
export function createGalleryScene(
  container: HTMLDivElement,
  items: SceneArtwork[],
  controls: { current: SceneControls },
  callbacks: SceneCallbacks,
): () => void {
  const scene = new Scene();
  /** Container size, refreshed by the ResizeObserver. */
  let viewW = container.clientWidth;
  let viewH = container.clientHeight;
  const camera = new PerspectiveCamera(CAMERA_FOV, viewH > 0 && viewW > 0 ? viewW / viewH : 1, 0.1, 120);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewW, viewH);
  renderer.outputColorSpace = SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // ── Cards ────────────────────────────────────────────────────────────────
  const geometry = new PlaneGeometry(1, 1);
  const cards: Card[] = [];
  const pickables: Mesh[] = [];
  items.forEach((item, index) => {
    const aspect = item.w / Math.max(1, item.h);
    const baseW = aspect >= 1 ? CARD_SIZE : CARD_SIZE * aspect;
    const baseH = aspect >= 1 ? CARD_SIZE / aspect : CARD_SIZE;
    const mat = new MeshBasicMaterial({
      color: '#aeaeb2',
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    const mesh = new Mesh(geometry, mat);
    mesh.userData.cardIndex = index;
    scene.add(mesh);
    const card: Card = {
      mesh,
      mat,
      item,
      fullRequested: false,
      texLoaded: false,
      recap: index < 8,
      seed: index,
      hoverScale: 1,
      visScale: 0,
      gridX: 0,
      gridY: 0,
      gridScale: 0.5,
      introDelay: (hashNoise(11 * index + 3) + 0.5) * 1300,
      introduced: false,
      introBlend: 0,
      sortDist: 15,
      ordinal: index,
      shown: true,
      baseW,
      baseH,
    };
    cards.push(card);
    pickables.push(mesh);
  });

  const loader = new TextureLoader();
  loader.setCrossOrigin('anonymous');
  let disposed = false;

  /** Load an sRGB texture; nothing is reported once the scene is gone. */
  function loadTexture(url: string, settle: (texture: Texture | null) => void) {
    loader.load(
      url,
      (tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.colorSpace = SRGBColorSpace;
        settle(tex);
      },
      undefined,
      () => {
        if (!disposed) settle(null);
      },
    );
  }

  // ── Thumbnails: each distinct image once, recap cards first, a few at a time ──
  let queueCursor = 0;
  let inFlight = 0;
  let settledCount = 0;
  let readyFired = false;
  const readyThreshold = Math.ceil(READY_SHARE * cards.length);

  function fireReady() {
    if (readyFired || disposed) return;
    readyFired = true;
    callbacks.onReady();
  }
  const readyTimer = setTimeout(fireReady, READY_TIMEOUT_MS);

  function pumpQueue() {
    while (inFlight < MAX_CONCURRENT_LOADS && queueCursor < cards.length && !disposed) {
      const card = cards[queueCursor++];
      inFlight++;
      loadTexture(thumbPath(card.item), (tex) => {
        inFlight--;
        if (tex && card.mat.map) tex.dispose(); // Keyboard browsing can load the full image first.
        else if (tex) {
          card.mat.map = tex;
          card.mat.color.set('#ffffff');
          card.mat.needsUpdate = true;
        }
        card.texLoaded = true;
        if (++settledCount >= readyThreshold) fireReady();
        pumpQueue();
      });
    }
  }
  pumpQueue();

  // ── Filtering & layout state ─────────────────────────────────────────────
  /** Distinct artworks passing the filter, in the order ←/→ browse them. */
  let browseOrder: Card[] = [];
  let filter: FilterId = controls.current.filter;
  /** Last real shape; kept while the story overlay is open. */
  let layoutShape: Shape = 'sphere';

  function applyFilter(scatter = false) {
    browseOrder = [];
    for (const card of cards) {
      const shown = tagMatchesFilter(card.item.tag, filter);
      if (scatter && shown && !card.shown) {
        card.mesh.position.set(1.5 * hashNoise(3 * card.seed), 1.5 * hashNoise(5 * card.seed), -2);
      }
      card.shown = shown;
      if (shown) {
        card.ordinal = browseOrder.length;
        browseOrder.push(card);
      }
    }
  }

  const gridOrder = shuffle([...cards]);
  let gridTop = 4;
  let gridHeight = 10;
  let gridScroll = 0;
  let gridVelocity = 0;
  // Trackball orientation: horizontal drags spin about the screen's Y axis,
  // vertical drags about its X axis, so the orb turns freely through 360°.
  const AXIS_X = new Vector3(1, 0, 0);
  const AXIS_Y = new Vector3(0, 1, 0);
  const IDENTITY = new Quaternion();
  const orientation = new Quaternion().setFromAxisAngle(AXIS_Y, 0.6);
  const viewQuat = new Quaternion();
  const stepQuat = new Quaternion();
  let spinVelocity = 0;
  let tiltVelocity = 0;
  let startedAt = 0;
  let heroCard: Card | null = null;
  let heroUntil = 0;
  // Before the intro, one loaded thumbnail after another flashes in the centre.
  const previewPool = shuffle([...cards]);
  let previewIndex = -1;
  let previewCard: Card | null = null;
  let nextPreviewAt = 0;

  /** Scale at which a card fills the intro/focus slot in front of the camera. */
  function heroScale(card: Card) {
    const px = Math.min(0.56 * viewH, 520, Math.min(0.8 * viewW, 620) * (card.baseH / card.baseW));
    return (12 * Math.tan(HALF_FOV) * (px / viewH)) / card.baseH;
  }

  /** Enlarged size of a hovered grid card, never smaller than its grid size. */
  function gridHoverScale(card: Card) {
    return Math.max(card.gridScale, Math.min(2.2 * card.gridScale, 3.4 / card.baseH, 4.6 / card.baseW));
  }

  let aboutBlend = 0;
  let lastHoverPickAt = 0;
  let shapeBlend = 0;
  let noiseLevel = 1;
  let cardLevel = 1;
  /** Pointer that started the current drag; only its release can click. */
  let dragPointer: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;

  /** Camera distance that keeps the sphere inside narrow viewports. */
  function fitDistance() {
    const halfAngle = Math.atan(Math.tan(HALF_FOV) * Math.min(1, camera.aspect));
    return (SPHERE_RADIUS + CARD_SIZE) / Math.sin(halfAngle);
  }
  let targetZ = fitDistance();
  camera.position.z = targetZ;

  const pointerNdc = new Vector2(2, 2);
  let hasPointer = false;
  let hovered: Card | null = null;
  let focused: Card | null = null;
  /** 0 → 1 while a card is focused; every other card fades back. */
  let focusBlend = 0;
  /** Last focused card, kept at full opacity while the cloud fades back in. */
  let spotlit: Card | null = null;

  applyFilter();
  {
    const p = new Vector3();
    for (const card of cards) {
      spherePoint(card.ordinal, browseOrder.length, p);
      card.mesh.position.copy(p);
      card.mesh.scale.setScalar(1e-4);
    }
  }

  const raycaster = new Raycaster();

  function setHovered(card: Card | null) {
    if (card === hovered) return;
    hovered = card;
    callbacks.onHoverItem(card?.item ?? null);
  }

  /** Swap in the 960px texture of a focused card; each image is loaded once. */
  function showFullImage(card: Card) {
    if (card.fullRequested) return;
    card.fullRequested = true;
    loadTexture(card.item.img, (tex) => {
      if (!tex) return;
      card.mat.map?.dispose();
      card.mat.color.set('#ffffff');
      card.mat.map = tex;
      card.mat.needsUpdate = true;
    });
  }

  function setFocused(card: Card | null) {
    if (focused === card) return;
    focused = card;
    if (focused) {
      setHovered(null);
      spotlit = focused;
      showFullImage(focused);
    }
    callbacks.onFocusChange(focused?.item ?? null);
  }

  const tmpNdc = new Vector2();

  /** First visible card under a normalized screen point. */
  function cardAt(point: Vector2): Card | null {
    raycaster.setFromCamera(point, camera);
    let front: Card | null = null;
    for (const hit of raycaster.intersectObjects(pickables, false)) {
      const card = cards[hit.object.userData.cardIndex];
      if (card.shown && card.visScale > 0.5 && (!front || card.mesh.renderOrder > front.mesh.renderOrder)) front = card;
    }
    return front;
  }

  // ── Input ────────────────────────────────────────────────────────────────
  function onPointerDown(e: PointerEvent) {
    if (e.target !== renderer.domElement || dragPointer !== null) return;
    dragPointer = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    downX = e.clientX;
    downY = e.clientY;
    try {
      container.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
  }

  function onPointerMove(e: PointerEvent) {
    const rect = container.getBoundingClientRect();
    hasPointer = e.pointerType !== 'touch';
    pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (e.pointerId !== dragPointer) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (controls.current.shape === 'grid') {
      const step = -dy * ((2 * Math.tan(HALF_FOV) * camera.position.z) / rect.height);
      gridScroll += step;
      gridVelocity = step;
    } else {
      spinVelocity = 0.004 * dx;
      tiltVelocity = 0.004 * dy;
    }
  }

  /** End the drag if `pointerId` started it; repeated or foreign calls do nothing. */
  function endDrag(pointerId: number): boolean {
    if (pointerId !== dragPointer) return false;
    dragPointer = null;
    return true;
  }

  function onPointerUp(e: PointerEvent) {
    if (!endDrag(e.pointerId)) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 5) return;
    if (focused) {
      setFocused(null);
      return;
    }
    const rect = container.getBoundingClientRect();
    tmpNdc.set(2 * (e.clientX - rect.left) / rect.width - 1, 1 - 2 * (e.clientY - rect.top) / rect.height);
    const card = cardAt(tmpNdc);
    if (card) setFocused(card);
  }

  /** `pointercancel` and an unexpected `lostpointercapture` only stop the drag. */
  function onPointerCancel(e: PointerEvent) {
    endDrag(e.pointerId);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') setFocused(null);
    if (focused && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      setFocused(stepArtwork(browseOrder, focused, e.key === 'ArrowRight' ? 1 : -1));
    }
  }

  function onWheel(e: WheelEvent) {
    const shape = controls.current.shape;
    if (shape === 'about') return;
    e.preventDefault();
    if (shape === 'grid') {
      gridScroll += 0.014 * e.deltaY;
      return;
    }
    if (focused) return;
    // Wheel turns the orb like a drag: vertical scroll tilts, horizontal scroll
    // (trackpads, or Shift+wheel) spins. Line-mode deltas (Firefox) become pixels.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewH : 1;
    const limit = 0.08;
    tiltVelocity = MathUtils.clamp(tiltVelocity - 0.00016 * e.deltaY * unit, -limit, limit);
    spinVelocity = MathUtils.clamp(spinVelocity - 0.00016 * e.deltaX * unit, -limit, limit);
  }

  function onResize() {
    if (container.clientWidth <= 0 || container.clientHeight <= 0) return;
    viewW = container.clientWidth;
    viewH = container.clientHeight;
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    renderer.setSize(viewW, viewH);
    targetZ = fitDistance();
  }

  function onPointerLeave() {
    hasPointer = false;
    setHovered(null);
  }

  container.addEventListener('pointerleave', onPointerLeave);
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerCancel);
  container.addEventListener('lostpointercapture', onPointerCancel);
  container.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // ── Render loop ──────────────────────────────────────────────────────────
  const target = new Vector3();
  const desired = new Vector3();
  let rafId = 0;
  const timer = new Timer();

  function frame(timestamp?: number) {
    rafId = requestAnimationFrame(frame);
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.05);
    const elapsed = timer.getElapsed();
    const now = performance.now();
    const ctl = controls.current;

    if (ctl.shape !== 'about') layoutShape = ctl.shape;
    if (ctl.filter !== filter) {
      filter = ctl.filter;
      applyFilter(true);
      if (focused && !focused.shown) setFocused(null);
      if (hovered && !hovered.shown) setHovered(null);
    }
    if (ctl.shape === 'about' && focused) setFocused(null);
    aboutBlend += (Number(ctl.shape === 'about') - aboutBlend) * 0.11;
    focusBlend += (Number(!!focused) - focusBlend) * 0.12;

    const halfH = Math.tan(HALF_FOV) * camera.position.z;
    const portraitLift = camera.aspect < 0.8 ? -(0.07 * halfH) : 0;

    // Grid: masonry columns, shortest column first. A few results get fewer,
    // centred columns, with cards capped by the visible height.
    if (layoutShape === 'grid') {
      const width = halfH * camera.aspect * 1.84;
      const columns = Math.max(1, Math.min(Math.max(2, Math.round(width / 1.7)), browseOrder.length));
      const colW = Math.min(width / columns, 0.8 * halfH);
      const cardW = 0.92 * colW;
      const gap = 0.08 * colW;
      const heights: number[] = Array(columns).fill(0);
      for (const card of gridOrder) {
        if (!card.shown) continue;
        const scale = Math.min(cardW / card.baseW, (1.1 * halfH) / card.baseH);
        const h = card.baseH * scale;
        let col = 0;
        for (let c = 1; c < columns; c++) if (heights[c] < heights[col]) col = c;
        card.gridScale = scale;
        card.gridX = (col - (columns - 1) / 2) * colW;
        card.gridY = heights[col] + h / 2;
        heights[col] += h + gap;
      }
      gridHeight = Math.max(...heights);
      gridTop = Math.min(0.8 * halfH, gridHeight / 2);
      if (dragPointer === null) {
        gridScroll += gridVelocity;
        gridVelocity *= 0.94;
      }
      gridScroll = MathUtils.clamp(gridScroll, 0, Math.max(0, gridHeight - 1.55 * halfH));
    }

    const tuning = SHAPE_TUNING[layoutShape];
    noiseLevel += (tuning.noise - noiseLevel) * 0.05;
    cardLevel += (tuning.card - cardLevel) * 0.06;
    const noise = (0.09 + 0.075 * (1 + Math.sin(0.045 * elapsed + 2))) * noiseLevel;
    const flatShape = Number(
      layoutShape === 'heart' || layoutShape === 'smiley' || layoutShape === 'star' || layoutShape === 'grid',
    );
    shapeBlend += (flatShape - shapeBlend) * 0.06;
    const spin = 0.07 * dt * (1 - shapeBlend) + spinVelocity;
    orientation.premultiply(stepQuat.setFromAxisAngle(AXIS_Y, spin));
    orientation.premultiply(stepQuat.setFromAxisAngle(AXIS_X, tiltVelocity));
    // Flat shapes ease back to face the camera.
    if (shapeBlend > 0.01) orientation.slerp(IDENTITY, 0.09 * shapeBlend);
    orientation.normalize();
    spinVelocity *= 0.94;
    tiltVelocity *= 0.94;
    const sway =
      layoutShape === 'heart' || layoutShape === 'smiley' || layoutShape === 'star'
        ? 0.15 * Math.sin(0.35 * elapsed) * shapeBlend
        : 0;
    viewQuat.setFromAxisAngle(AXIS_Y, sway).multiply(orientation);

    if (!Number.isFinite(camera.position.z)) camera.position.z = fitDistance();
    camera.position.z += (targetZ - camera.position.z) * 0.08;

    // Pre-intro slideshow: cycle through loaded thumbnails every 150ms.
    if (!ctl.started && now >= nextPreviewAt && previewPool.length) {
      nextPreviewAt = now + 150;
      for (let step = 1; step <= previewPool.length; step++) {
        const i = (previewIndex + step) % previewPool.length;
        const card = previewPool[i];
        if (card.mat.map) {
          previewIndex = i;
          previewCard = card;
          break;
        }
      }
    }

    // Intro: a recap card holds the centre, then flies to the front-most slot.
    if (ctl.started && !startedAt) {
      startedAt = now;
      const candidates = cards.filter((c) => c.recap && c.shown && c.mat.map);
      if (candidates.length) previewCard = candidates[Math.floor(Math.random() * candidates.length)];
      if (previewCard) {
        heroCard = previewCard;
        heroUntil = now + 1600;
        heroCard.introDelay = 0;
        if (heroCard.shown) {
          let front: Card | null = null;
          let best = -Infinity;
          for (const card of cards) {
            if (!card.shown) continue;
            spherePoint(card.ordinal, browseOrder.length, desired);
            desired.applyQuaternion(orientation);
            const score = desired.z - (Math.abs(desired.x) + Math.abs(desired.y)) * 1.5;
            if (score > best) {
              best = score;
              front = card;
            }
          }
          if (front && front !== heroCard) {
            const ordinal = front.ordinal;
            front.ordinal = heroCard.ordinal;
            heroCard.ordinal = ordinal;
          }
        }
        heroCard.introduced = true;
        heroCard.introBlend = 1;
        heroCard.visScale = 1;
        heroCard.hoverScale = heroScale(heroCard);
        heroCard.mesh.position.set(0, 0, camera.position.z - FOCUS_DEPTH);
      }
    }

    const aboutLift = aboutBlend * (layoutShape === 'grid' ? gridHeight + 2.5 * halfH : 3.2 * halfH);
    for (const card of cards) {
      const ordinal = card.ordinal;
      if (!ctl.started) {
        if (card === previewCard) {
          card.mesh.position.set(0, 0, camera.position.z - FOCUS_DEPTH);
          const scale = heroScale(card);
          card.mesh.scale.set(card.baseW * scale, card.baseH * scale, 1);
          card.mat.opacity = 1;
          card.mesh.renderOrder = 1e5;
        } else {
          card.mesh.scale.setScalar(1e-4);
          card.mat.opacity = 0;
        }
        continue;
      }

      const due = now - startedAt >= card.introDelay;
      const visible = card.shown && due && card.texLoaded ? 1 : 0;
      if (visible > 0 && !card.introduced) {
        card.introduced = true;
        card.visScale = 1;
        card.mesh.position.multiplyScalar(0.9);
      }
      if (card.introduced) card.introBlend += (1 - card.introBlend) * 0.055;
      card.visScale += (visible - card.visScale) * 0.12;

      if (card.shown) {
        if (layoutShape === 'grid') {
          target.set(card.gridX, gridTop - card.gridY + gridScroll, 0.06 * hashNoise(5 * ordinal + 4));
        } else {
          shapePoint(layoutShape, ordinal, browseOrder.length, target);
        }
        desired.copy(target);
        desired.x += hashNoise(3 * ordinal + 1) * noise * 6;
        desired.y += hashNoise(3 * ordinal + 2) * noise * 6;
        desired.applyQuaternion(viewQuat);
        desired.y += aboutLift + portraitLift;
        if (card === focused) {
          desired.set(0, 0.25, camera.position.z - FOCUS_DEPTH);
        } else if (card === hovered && layoutShape === 'grid') {
          // Keep the enlarged grid card inside the viewport.
          const s = gridHoverScale(card);
          const halfW = (card.baseW * s) / 2 + 0.15;
          const halfHt = (card.baseH * s) / 2 + 0.15;
          const halfViewW = halfH * camera.aspect;
          desired.x = MathUtils.clamp(desired.x, -halfViewW + halfW, halfViewW - halfW);
          desired.y = MathUtils.clamp(desired.y, -halfH + halfHt, halfH - halfHt);
        }
        const heroFlying = card === heroCard && now < heroUntil;
        card.mesh.position.lerp(desired, card === focused ? 0.12 : heroFlying ? 0.045 : 0.14);
      }

      let scale = layoutShape === 'grid' ? card.gridScale : cardLevel * (card.recap ? 1.35 : 1);
      if (card === focused) {
        const fullH = 12 * Math.tan(HALF_FOV);
        const fullW = fullH * camera.aspect;
        scale = Math.min((0.62 * fullH) / card.baseH, (0.82 * fullW) / card.baseW);
      } else if (card === hovered && layoutShape === 'grid') {
        scale = gridHoverScale(card);
      }
      card.hoverScale += (scale - card.hoverScale) * (card === heroCard && now < heroUntil ? 0.045 : 0.12);
      const size = Math.max(1e-4, card.hoverScale * card.visScale);
      card.mesh.scale.set(card.baseW * size, card.baseH * size, 1);
      card.mat.opacity = card.introBlend * (card === spotlit ? 1 : 1 - 0.94 * focusBlend);

      // Painter's order: depth test is off, so sort by smoothed camera distance.
      const dist = card.mesh.position.distanceTo(camera.position);
      card.sortDist += (dist - card.sortDist) * 0.12;
      let order = (100 - card.sortDist) * 10;
      if (card.recap) order += 12;
      if (card === focused || card === hovered) order += 1e4;
      card.mesh.renderOrder = order;
    }

    if (ctl.shape === 'about') setHovered(null);
    else if (hasPointer && !focused && now - lastHoverPickAt > 45) {
      lastHoverPickAt = now;
      setHovered(cardAt(pointerNdc));
    }
    container.style.cursor = dragPointer !== null ? 'grabbing' : hovered ? 'pointer' : 'grab';

    renderer.render(scene, camera);
  }
  frame();

  return () => {
    disposed = true;
    clearTimeout(readyTimer);
    cancelAnimationFrame(rafId);
    timer.dispose();
    resizeObserver.disconnect();
    window.removeEventListener('keydown', onKeyDown);
    container.removeEventListener('pointerleave', onPointerLeave);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerCancel);
    container.removeEventListener('lostpointercapture', onPointerCancel);
    container.removeEventListener('wheel', onWheel);
    cards.forEach((card) => {
      card.mat.map?.dispose();
      card.mat.dispose();
    });
    geometry.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}
