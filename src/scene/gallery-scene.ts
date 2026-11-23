import {
  Clock,
  Color,
  Group,
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
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import type { GalleryItem } from '../data/types.ts';
import { tagMatchesFilter, type FilterId, type Shape, type ViewMode } from '../data/views.ts';
import { accentFromImage } from './accent.ts';
import {
  ACCENTS,
  CAMERA_FOV,
  CARD_SIZE,
  MAX_CONCURRENT_LOADS,
  READY_SHARE,
  READY_TIMEOUT_MS,
  SHAPE_TUNING,
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

export interface SceneCallbacks {
  onHoverItem(item: GalleryItem | null, accent: string | null): void;
  onFocusChange(item: GalleryItem | null, accent: string | null): void;
  onReady(): void;
}

export type ChipKey = 'rotate' | 'noise' | 'zoom' | 'shape' | 'depth';

/** DOM elements of the 2D overlay that tracks the cloud / hovered / focused card. */
export interface OverlayRefs {
  root: { current: HTMLDivElement | null };
  bbox: { current: HTMLDivElement | null };
  label: { current: HTMLDivElement | null };
  caption: { current: HTMLDivElement | null };
  chips: { current: Partial<Record<ChipKey, HTMLSpanElement | null>> };
}

export interface GallerySceneOptions {
  container: HTMLDivElement;
  items: GalleryItem[];
  controls: { current: SceneControls };
  callbacks: { current: SceneCallbacks };
  overlay: OverlayRefs;
}

interface Card {
  group: Group;
  imgMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  frameMesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  mat: MeshBasicMaterial;
  item: GalleryItem;
  baseColor: Color;
  thumbTex: Texture | null;
  /** Thumbnail settled (loaded or failed). */
  texLoaded: boolean;
  accent: string;
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
  /** Passes the current filter. */
  on: boolean;
  baseW: number;
  baseH: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const HALF_FOV = MathUtils.degToRad(CAMERA_FOV / 2);
/** Distance in front of the camera at which the focused / intro card is shown. */
const FOCUS_DEPTH = 6;

/**
 * Build the WebGL gallery inside `container` and start its render loop.
 * Returns a function that stops the loop and releases every GPU resource.
 */
export function createGalleryScene({
  container,
  items,
  controls,
  callbacks,
  overlay,
}: GallerySceneOptions): () => void {
  const scene = new Scene();
  const camera = new PerspectiveCamera(
    CAMERA_FOV,
    container.clientHeight > 0 && container.clientWidth > 0
      ? container.clientWidth / container.clientHeight
      : 1,
    0.1,
    120,
  );
  camera.position.z = 15;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
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
    const baseColor = new Color('#aeaeb2');
    const mat = new MeshBasicMaterial({
      color: baseColor.clone(),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0,
    });
    const imgMesh = new Mesh(geometry, mat);
    imgMesh.scale.set(baseW, baseH, 1);
    imgMesh.userData.cardIndex = index;
    const frameMesh = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: '#ffffff',
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0,
      }),
    );
    frameMesh.scale.set(baseW + 0.014, baseH + 0.014, 1);
    frameMesh.position.z = -0.006;
    const group = new Group();
    group.add(frameMesh);
    group.add(imgMesh);
    scene.add(group);
    cards.push({
      group,
      imgMesh,
      frameMesh,
      mat,
      item,
      baseColor,
      thumbTex: null,
      texLoaded: false,
      accent: ACCENTS[index % ACCENTS.length],
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
      on: true,
      baseW,
      baseH,
    });
    pickables.push(imgMesh);
  });

  // ── Thumbnail loading (recap cards first, a few at a time) ───────────────
  const loader = new TextureLoader();
  loader.setCrossOrigin('anonymous');
  const loadQueue = [...cards].sort((a, b) => Number(b.item.recap) - Number(a.item.recap));
  let queueCursor = 0;
  let inFlight = 0;
  let disposed = false;
  let settledCount = 0;
  let readyFired = false;
  const readyThreshold = Math.ceil(READY_SHARE * cards.length);
  const thumbTextures: Texture[] = [];
  const fullTextures = new Map<string, Texture>();

  function fireReady() {
    readyFired = true;
    callbacks.current.onReady();
  }
  function markSettled() {
    settledCount++;
    if (!readyFired && settledCount >= readyThreshold) fireReady();
  }
  const readyTimer = setTimeout(() => {
    if (!readyFired) fireReady();
  }, READY_TIMEOUT_MS);

  function pumpQueue() {
    while (inFlight < MAX_CONCURRENT_LOADS && queueCursor < loadQueue.length && !disposed) {
      const card = loadQueue[queueCursor++];
      inFlight++;
      loader.load(
        card.item.img,
        (tex) => {
          inFlight--;
          if (disposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = SRGBColorSpace;
          thumbTextures.push(tex);
          card.thumbTex = tex;
          if (tex.image) card.accent = accentFromImage(tex.image as CanvasImageSource, card.seed);
          card.mat.map = tex;
          card.baseColor = new Color('#ffffff');
          card.mat.needsUpdate = true;
          card.texLoaded = true;
          markSettled();
          pumpQueue();
        },
        undefined,
        () => {
          inFlight--;
          card.texLoaded = true;
          markSettled();
          pumpQueue();
        },
      );
    }
  }
  pumpQueue();

  // ── Filtering & layout state ─────────────────────────────────────────────
  let activeCount = cards.length;

  /** Recompute which cards pass `filter`; `scatter` drops newly shown cards near the centre. */
  function applyFilter(filter: FilterId, scatter = false) {
    let ordinal = 0;
    for (const card of cards) {
      const on = tagMatchesFilter(card.item.tag, filter);
      if (scatter && on && !card.on) {
        card.group.position.set(1.5 * hashNoise(3 * card.seed), 1.5 * hashNoise(5 * card.seed), -2);
      }
      card.on = on;
      if (card.on) card.ordinal = ordinal++;
    }
    activeCount = Math.max(1, ordinal);
  }

  const gridOrder = shuffle(cards.map((_, i) => i));
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
  /** Last real shape; kept while the story overlay is open. */
  let layoutShape: Shape = 'sphere';
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
    const h = container.clientHeight;
    const px = Math.min(
      0.56 * h,
      520,
      Math.min(0.8 * container.clientWidth, 620) * (card.baseH / card.baseW),
    );
    return (12 * Math.tan(HALF_FOV) * (px / h)) / card.baseH;
  }

  let aboutBlend = 0;
  let lastHoverPickAt = 0;
  let shapeBlend = 0;
  let noiseLevel = 1;
  let cardLevel = 1;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;

  /** Camera distance that keeps the sphere inside narrow viewports. */
  function fitDistance() {
    return !Number.isFinite(camera.aspect) || camera.aspect <= 0
      ? 15
      : Math.max(15, 3.9 / (Math.tan(HALF_FOV) * camera.aspect));
  }
  let targetZ = fitDistance();
  camera.position.z = targetZ;

  const pointerNdc = new Vector2(2, 2);
  let hasPointer = false;
  let lastPointerAt = performance.now();
  let nextAutoHoverAt = 0;
  let autoHover = false;
  let hovered: Card | null = null;
  let focused: Card | null = null;
  let lastHoverId: string | null = null;
  let filter = controls.current.filter;

  applyFilter(filter);
  {
    const p = new Vector3();
    for (const card of cards) {
      spherePoint(card.ordinal, activeCount, p);
      card.group.position.copy(p);
      card.group.scale.setScalar(1e-4);
    }
  }

  const raycaster = new Raycaster();

  function setHovered(card: Card | null) {
    if (card === hovered) return;
    hovered = card;
    const id = hovered ? hovered.item.id : null;
    if (id !== lastHoverId) {
      lastHoverId = id;
      callbacks.current.onHoverItem(hovered ? hovered.item : null, hovered ? hovered.accent : null);
    }
  }

  /** Swap in the 960px texture of a focused card, loading it once. */
  function showFullImage(card: Card) {
    const cached = fullTextures.get(card.item.id);
    if (cached) {
      card.mat.map = cached;
      card.mat.needsUpdate = true;
      return;
    }
    loader.load(card.item.imgFull, (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }
      tex.colorSpace = SRGBColorSpace;
      fullTextures.set(card.item.id, tex);
      card.mat.map = tex;
      card.mat.needsUpdate = true;
    });
  }

  function setFocused(card: Card | null) {
    if (focused === card) return;
    focused = card;
    if (focused) showFullImage(focused);
    callbacks.current.onFocusChange(focused ? focused.item : null, focused ? focused.accent : null);
  }

  const tmpNdc = new Vector2();

  /** First visible card under a screen point. */
  function cardAt(clientX: number, clientY: number): Card | null {
    const rect = container.getBoundingClientRect();
    tmpNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(tmpNdc, camera);
    for (const hit of raycaster.intersectObjects(pickables, false)) {
      const card = cards[hit.object.userData.cardIndex];
      if (card.on && card.visScale > 0.5) return card;
    }
    return null;
  }

  // ── Input ────────────────────────────────────────────────────────────────
  function onPointerDown(e: PointerEvent) {
    if (e.target !== renderer.domElement) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    downX = e.clientX;
    downY = e.clientY;
    try {
      container?.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
  }

  function onPointerMove(e: PointerEvent) {
    const rect = container.getBoundingClientRect();
    hasPointer = true;
    lastPointerAt = performance.now();
    pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      (-(e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (!dragging) return;
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

  function onPointerUp(e: PointerEvent) {
    if (e.target !== renderer.domElement && !dragging) return;
    dragging = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 5) return;
    if (focused) {
      setFocused(null);
      return;
    }
    const card = cardAt(e.clientX, e.clientY);
    if (card) setFocused(card);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') setFocused(null);
    if (focused && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const ordinal = (((focused.ordinal + step) % activeCount) + activeCount) % activeCount;
      const next = cards.find((c) => c.on && c.ordinal === ordinal);
      if (next) setFocused(next);
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
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? container.clientHeight : 1;
    const limit = 0.08;
    tiltVelocity = MathUtils.clamp(tiltVelocity - 0.00016 * e.deltaY * unit, -limit, limit);
    spinVelocity = MathUtils.clamp(spinVelocity - 0.00016 * e.deltaX * unit, -limit, limit);
  }

  function onResize() {
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    targetZ = fitDistance();
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // ── Render loop ──────────────────────────────────────────────────────────
  const target = new Vector3();
  const desired = new Vector3();
  const projected = new Vector3();
  let rafId = 0;
  let frameCount = 0;
  const box: Box & { init: boolean } = { x: 0, y: 0, w: 0, h: 0, init: false };
  const lastBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  const tweenFrom: Box = { x: 0, y: 0, w: 0, h: 0 };
  let tweenStart = -1e9;
  /** Card the overlay box was last snapped to (null = whole cloud). */
  let boxTarget: Card | null | undefined;
  const clock = new Clock();

  function frame() {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    const now = performance.now();
    const ctl = controls.current;

    if (ctl.filter !== filter) {
      filter = ctl.filter;
      applyFilter(filter, true);
      if (focused && !focused.on) setFocused(null);
    }
    if (ctl.shape !== 'about') layoutShape = ctl.shape;
    if (ctl.shape === 'about' && focused) setFocused(null);
    aboutBlend += (Number(ctl.shape === 'about') - aboutBlend) * 0.11;

    const halfH = Math.tan(HALF_FOV) * camera.position.z;
    const portraitLift = camera.aspect < 0.8 ? -(0.07 * halfH) : 0;

    // Grid: masonry columns, shortest column first.
    if (layoutShape === 'grid') {
      const width = halfH * camera.aspect * 1.84;
      const columns = Math.max(2, Math.round(width / 1.7));
      const colW = width / columns;
      const cardW = 0.92 * colW;
      const gap = 0.08 * colW;
      const heights: number[] = Array(columns).fill(0);
      for (const index of gridOrder) {
        const card = cards[index];
        if (!card.on) continue;
        const scale = cardW / card.baseW;
        const h = card.baseH * scale;
        let col = 0;
        for (let c = 1; c < columns; c++) if (heights[c] < heights[col]) col = c;
        card.gridScale = scale;
        card.gridX = (col - (columns - 1) / 2) * colW;
        card.gridY = heights[col] + h / 2;
        heights[col] += h + gap;
      }
      gridHeight = Math.max(...heights);
      gridTop = 0.8 * halfH;
      if (!dragging) {
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
        if (card.texLoaded && card.thumbTex) {
          previewIndex = i;
          previewCard = card;
          break;
        }
      }
    }

    // Intro: a recap card holds the centre, then flies to the front-most slot.
    if (ctl.started && !startedAt) {
      startedAt = now;
      const candidates = cards.filter((c) => c.item.recap && c.on && c.texLoaded && c.thumbTex);
      if (candidates.length) previewCard = candidates[Math.floor(Math.random() * candidates.length)];
      if (previewCard) {
        heroCard = previewCard;
        heroUntil = now + 1600;
        heroCard.introDelay = 0;
        if (heroCard.on) {
          let front: Card | null = null;
          let best = -Infinity;
          for (const card of cards) {
            if (!card.on) continue;
            spherePoint(card.ordinal, activeCount, desired);
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
        heroCard.group.position.set(0, 0, camera.position.z - FOCUS_DEPTH);
        heroCard.group.scale.setScalar(heroCard.hoverScale);
        heroCard.mat.opacity = 1;
      }
    }

    const aboutLift = aboutBlend * (layoutShape === 'grid' ? gridHeight + 2.5 * halfH : 3.2 * halfH);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const view = { w: container.clientWidth, h: container.clientHeight };

    for (const card of cards) {
      const ordinal = card.ordinal;
      if (!ctl.started) {
        if (card === previewCard) {
          card.group.position.set(0, 0, camera.position.z - FOCUS_DEPTH);
          card.group.scale.setScalar(heroScale(card));
          card.mat.opacity = 1;
          card.imgMesh.renderOrder = 1e5;
        } else {
          card.group.scale.setScalar(1e-4);
          card.mat.opacity = 0;
        }
        card.frameMesh.material.opacity = 0;
        continue;
      }

      const due = ctl.started && now - startedAt >= card.introDelay;
      const visible = card.on && due && card.texLoaded ? 1 : 0;
      if (visible > 0 && !card.introduced) {
        card.introduced = true;
        card.visScale = 1;
        card.group.position.multiplyScalar(0.9);
      }
      if (card.introduced) card.introBlend += (1 - card.introBlend) * 0.055;
      card.visScale += (visible - card.visScale) * 0.12;

      if (card.on) {
        if (layoutShape === 'grid') {
          target.set(card.gridX, gridTop - card.gridY + gridScroll, 0.06 * hashNoise(5 * ordinal + 4));
        } else {
          shapePoint(layoutShape, ordinal, activeCount, target);
        }
        desired.copy(target);
        desired.x += hashNoise(3 * ordinal + 1) * noise * 6;
        desired.y += hashNoise(3 * ordinal + 2) * noise * 6;
        desired.applyQuaternion(viewQuat);
        desired.y += aboutLift + portraitLift;
        if (card === focused) {
          desired.set(0, 0.25, camera.position.z - FOCUS_DEPTH);
        } else if (card === hovered && !autoHover && layoutShape === 'grid') {
          // Keep the enlarged grid card inside the viewport.
          const s = Math.min(2.2 * card.gridScale, 3.4 / card.baseH, 4.6 / card.baseW);
          const halfW = (card.baseW * s) / 2 + 0.15;
          const halfHt = (card.baseH * s) / 2 + 0.15;
          const halfViewW = halfH * camera.aspect;
          desired.x = MathUtils.clamp(desired.x, -halfViewW + halfW, halfViewW - halfW);
          desired.y = MathUtils.clamp(desired.y, -halfH + halfHt, halfH - halfHt);
        }
        const heroFlying = card === heroCard && now < heroUntil;
        card.group.position.lerp(desired, card === focused ? 0.12 : heroFlying ? 0.045 : 0.14);
      }

      let scale = layoutShape === 'grid' ? card.gridScale : cardLevel * (card.item.recap ? 1.35 : 1);
      if (card === focused) {
        const fullH = 12 * Math.tan(HALF_FOV);
        const fullW = fullH * camera.aspect;
        scale = Math.min((0.62 * fullH) / card.baseH, (0.82 * fullW) / card.baseW);
      } else if (card === hovered && !autoHover && layoutShape === 'grid') {
        scale = Math.min(2.2 * card.gridScale, 3.4 / card.baseH, 4.6 / card.baseW);
      }
      card.hoverScale += (scale - card.hoverScale) * (card === heroCard && now < heroUntil ? 0.045 : 0.12);
      card.group.scale.setScalar(Math.max(1e-4, card.hoverScale * card.visScale));
      card.mat.color.copy(card.baseColor);
      card.mat.opacity = card.introBlend;
      card.frameMesh.material.opacity = card.introBlend;

      // Painter's order: depth test is off, so sort by smoothed camera distance.
      const dist = card.group.position.distanceTo(camera.position);
      card.sortDist += (dist - card.sortDist) * 0.12;
      let order = (100 - card.sortDist) * 10;
      if (card.item.recap) order += 12;
      if (card === focused || (card === hovered && !autoHover)) order += 1e4;
      card.frameMesh.renderOrder = order;
      card.imgMesh.renderOrder = order + 0.5;

      if (card.on && card !== focused && card.visScale > 0.5) {
        projected.copy(card.group.position).project(camera);
        if (projected.z < 1) {
          const sx = (0.5 * projected.x + 0.5) * view.w;
          const sy = (-(0.5 * projected.y) + 0.5) * view.h;
          if (sx < minX) minX = sx;
          if (sx > maxX) maxX = sx;
          if (sy < minY) minY = sy;
          if (sy > maxY) maxY = sy;
        }
      }
    }

    // Hover: idle visitors get a random card highlighted every few seconds.
    const idle = ctl.started && ctl.shape !== 'about' && now - lastPointerAt > 2500 && !dragging && !focused;
    autoHover = idle;
    if (ctl.shape === 'about' && hovered && hovered !== focused) setHovered(null);
    if (idle) {
      if (now > nextAutoHoverAt) {
        nextAutoHoverAt = now + 2200 + 1400 * Math.random();
        attempts: for (let attempt = 0; attempt < 10; attempt++) {
          tmpNdc.set(1.3 * Math.random() - 0.65, 1.3 * Math.random() - 0.65);
          raycaster.setFromCamera(tmpNdc, camera);
          for (const hit of raycaster.intersectObjects(pickables, false)) {
            const card = cards[hit.object.userData.cardIndex];
            if (card.on && card.visScale > 0.5) {
              setHovered(card);
              break attempts;
            }
            break;
          }
        }
      }
    } else if (hasPointer && ctl.shape !== 'about' && !focused && now - lastHoverPickAt > 45) {
      lastHoverPickAt = now;
      raycaster.setFromCamera(pointerNdc, camera);
      let hit: Card | null = null;
      for (const h of raycaster.intersectObjects(pickables, false)) {
        const card = cards[h.object.userData.cardIndex];
        if (card.on && card.visScale > 0.5) {
          hit = card;
          break;
        }
      }
      setHovered(hit);
    }

    container.style.cursor = dragging ? 'grabbing' : hovered ? 'pointer' : 'grab';
    frameCount++;

    // ── Overlay box: around the focused/hovered card, else around the cloud ──
    const bboxEl = overlay.bbox.current;
    const boxCard = focused ?? hovered;
    let tx: number;
    let ty: number;
    let tw: number;
    let th: number;
    if (boxCard) {
      const hw = (boxCard.baseW / 2) * boxCard.group.scale.x;
      const hh = (boxCard.baseH / 2) * boxCard.group.scale.y;
      const pos = boxCard.group.position;
      projected.set(pos.x - hw, pos.y + hh, pos.z).project(camera);
      const left = (0.5 * projected.x + 0.5) * view.w;
      const top = (-(0.5 * projected.y) + 0.5) * view.h;
      projected.set(pos.x + hw, pos.y - hh, pos.z).project(camera);
      const right = (0.5 * projected.x + 0.5) * view.w;
      const bottom = (-(0.5 * projected.y) + 0.5) * view.h;
      tx = left - 10;
      ty = top - 10;
      tw = right - left + 20;
      th = bottom - top + 20;
    } else if (isFinite(minX)) {
      tx = Math.max(34, minX - 46);
      ty = Math.max(96, minY - 46);
      tw = Math.min(view.w - 34, maxX + 46) - tx;
      th = Math.min(view.h - 34, maxY + 46) - ty;
    } else {
      tx = box.x;
      ty = box.y;
      tw = box.w;
      th = box.h;
    }
    if (box.init) {
      if (boxCard !== boxTarget) {
        boxTarget = boxCard;
        Object.assign(tweenFrom, box);
        tweenStart = now;
      }
      if (boxCard) {
        // Snap to a card with a 160ms ease-out cubic.
        const p = Math.min(1, (now - tweenStart) / 160);
        const k = 1 - (1 - p) * (1 - p) * (1 - p);
        box.x = tweenFrom.x + (tx - tweenFrom.x) * k;
        box.y = tweenFrom.y + (ty - tweenFrom.y) * k;
        box.w = tweenFrom.w + (tw - tweenFrom.w) * k;
        box.h = tweenFrom.h + (th - tweenFrom.h) * k;
      } else {
        box.x += (tx - box.x) * 0.22;
        box.y += (ty - box.y) * 0.22;
        box.w += (tw - box.w) * 0.22;
        box.h += (th - box.h) * 0.22;
      }
    } else {
      Object.assign(box, { x: tx, y: ty, w: tw, h: th, init: true });
      boxTarget = boxCard;
    }

    const overlayEl = overlay.root.current;
    if (overlayEl && bboxEl) {
      const mode = focused ? 'focus' : hovered ? 'card' : 'cloud';
      const moved =
        Math.abs(box.x - lastBox.x) +
        Math.abs(box.y - lastBox.y) +
        Math.abs(box.w - lastBox.w) +
        Math.abs(box.h - lastBox.h);
      Object.assign(lastBox, box);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      // While moving, round to 1/100px; at rest, snap to device pixels for crisp lines.
      const snap = (v: number) => (moved > 2 ? Math.round(100 * v) / 100 : Math.round(v * dpr) / dpr);
      const x = snap(box.x);
      const y = snap(box.y);
      const w = snap(Math.max(0, box.w));
      const h = snap(Math.max(0, box.h));
      const place = (el: HTMLElement | null, px: number, py: number) => {
        if (el) el.style.transform = `translate3d(${snap(px)}px, ${snap(py)}px, 0)`;
      };
      const labelEl = overlay.label.current;
      if (labelEl) {
        const labelH = labelEl.getBoundingClientRect().height;
        if (mode === 'cloud') place(labelEl, x + 96, y - labelH / 2);
        else place(labelEl, x, y + 1 - labelH);
      }
      const captionEl = overlay.caption.current;
      if (captionEl) place(captionEl, x + w - captionEl.getBoundingClientRect().width, y + h - 1);
      const placeChip = (key: ChipKey, px: number, py: number, anchorX: number) => {
        const el = overlay.chips.current[key];
        if (!el) return;
        const r = el.getBoundingClientRect();
        place(el, px - r.width * anchorX, py - r.height / 2);
      };
      placeChip('rotate', x, y, 1 / 3);
      placeChip('noise', x + w, y, 2 / 3);
      placeChip('zoom', x, y + h, 1 / 3);
      placeChip('shape', x + w / 2, y + h, 0.5);
      placeChip('depth', x + w, y + h, 2 / 3);
      overlayEl.style.opacity =
        ctl.started && ((ctl.shape !== 'about' && ctl.shape !== 'grid') || boxCard) ? '1' : '0';
      overlayEl.dataset.mode = mode;
      bboxEl.style.borderColor = boxCard ? boxCard.accent : '';
      bboxEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      bboxEl.style.width = `${w}px`;
      bboxEl.style.height = `${h}px`;
      if (frameCount % 5 == 0) {
        // Yaw of the orb's front axis, for the rotate chip.
        const { x: qx, y: qy, z: qz, w: qw } = orientation;
        const yaw = Math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qx * qx + qy * qy));
        const degrees = (((yaw * MathUtils.RAD2DEG) % 360) + 360) % 360;
        const setText = (key: ChipKey, text: string) => {
          const el = overlay.chips.current[key];
          if (el && el.textContent !== text) el.textContent = text;
        };
        setText('rotate', `rotate~ ${degrees.toFixed(1)}`);
        setText('noise', `noise~ ${noise.toFixed(2)}`);
        setText('zoom', `zoom~ ${camera.position.z.toFixed(1)}`);
        setText('shape', `shape~ ${ctl.shape} ${activeCount}`);
        setText('depth', 'depth~ 0.035');
      }
    }

    renderer.render(scene, camera);
  }
  frame();

  return () => {
    disposed = true;
    clearTimeout(readyTimer);
    cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKeyDown);
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('wheel', onWheel);
    thumbTextures.forEach((t) => t.dispose());
    fullTextures.forEach((t) => t.dispose());
    cards.forEach((card) => {
      card.mat.dispose();
      card.frameMesh.material.dispose();
    });
    geometry.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}
