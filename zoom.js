// X Image Viewer — in-place zoom with a toolbar
//
// In X's full-screen image viewer a toolbar sits at the bottom of the
// image:  [ ← ]  [ ⊖ | 100% | ⊕ ]  [ 框選 | 複製 | 下載 ]  [ 還原 ]  [ → ]
// The image zooms right where it is; X's layout (tweet panel, action bar,
// close button, arrows) stays as it was.
//
// Mouse / keys (while zoomed):
//   Wheel ............ zoom at the cursor (also starts zooming)
//   Drag ............. pan
//   Shift + drag ..... select a region -> copied as PNG (or turn on 框選)
//   Ctrl/⌘ + C ....... copy the whole image
//   Double-click ..... toggle 100% / 200%
//   0 / + / - ........ 100% / zoom in / zoom out (25% steps: 100, 125, 150…)
//
// The percentage is relative to the size X shows the image at (= 100%),
// so every image starts at 100%. Back at 100% in the original position,
// the zoom ends by itself and X's normal behavior returns.
//   Click the left / right strip of the image column, ← / →, ‹ / › ... previous / next image
//   Esc, or click beside the image ... back to X's normal view
// Changing image always returns to 100%.

(() => {
  'use strict';

  const VIEWER_RE = /^\/([^/]+)\/status\/(\d+)\/photo\/(\d+)/;
  const MEDIA_RE = /pbs\.twimg\.com\/media\//;
  const SLIDE = '[data-testid="swipe-to-dismiss"]';
  const UI_ATTR = 'data-xvp-layer'; // other scripts ignore events inside
  const MAX_SCALE = 16;             // 1600% of the original pixels
  const MIN_FIT_RATIO = 0.25;       // can zoom out to 1/4 of "fit"
  const PERCENT_STEP = 25;         // + / − move in 25% steps
  const NAV_ZONE = 0.2;             // left / right strip of the image column (same as nav.js)
  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", sans-serif';

  let state = null;                 // zoom state, null when not zoomed
  let selectMode = false;           // 框選 toggle
  const bitmaps = new Map();        // original URL -> Promise<ImageBitmap>

  // ============================================================
  // X's viewer
  // ============================================================

  // X draws each image as a background-image <div> plus a hidden <img>,
  // inside one [data-testid="swipe-to-dismiss"] container per image.
  function mediaElementsIn(slide) {
    return [...slide.querySelectorAll('div, img')].filter(
      (el) =>
        !el.closest(`[${UI_ATTR}]`) &&
        MEDIA_RE.test(el.tagName === 'IMG' ? el.src : el.style.backgroundImage)
    );
  }

  function mediaURLOf(el) {
    if (el.tagName === 'IMG') return el.src;
    const match = el.style.backgroundImage.match(/url\("?([^")]+)"?\)/);
    return match ? match[1] : null;
  }

  function originalURL(url) {
    const u = new URL(url, location.href);
    u.searchParams.set('name', 'orig');
    return u.toString();
  }

  // The container of the image currently shown (one or many images).
  function currentSlide() {
    const match = location.pathname.match(VIEWER_RE);
    if (!match) return null;

    const swipes = [...document.querySelectorAll(`[role="dialog"] ${SLIDE}`)];
    const list = swipes[0]?.closest('ul');

    const slide = list
      ? list.children[Number(match[3]) - 1]?.querySelector(SLIDE)
      : swipes[0];

    if (!slide || slide.querySelector('video')) return null;
    return mediaElementsIn(slide).length ? slide : null;
  }

  function hitFromSlide(slide) {
    const el = mediaElementsIn(slide).find((e) => e.tagName === 'DIV') || mediaElementsIn(slide)[0];
    return { slide, url: mediaURLOf(el), rect: el.getBoundingClientRect() };
  }

  function viewerImageAt(target, x, y) {
    if (!VIEWER_RE.test(location.pathname)) return null;
    if (!(target instanceof Element) || target.closest(`[${UI_ATTR}]`)) return null;
    if (!target.closest('[role="dialog"]') || target.closest('article')) return null;

    const slide = target.closest(SLIDE);
    if (!slide || slide.querySelector('video')) return null;

    for (const el of mediaElementsIn(slide)) {
      const r = el.getBoundingClientRect();

      if (r.width && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const url = mediaURLOf(el);
        if (url) return { slide, url, rect: r };
      }
    }

    return null;
  }

  // ============================================================
  // Toolbar
  // ============================================================

  const ui = document.createElement('div');
  ui.setAttribute(UI_ATTR, '');
  Object.assign(ui.style, {
    position: 'absolute',
    left: '50%',
    bottom: '14px',
    transform: 'translateX(-50%)',
    zIndex: '2',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'none',
  });

  const toast = document.createElement('div');
  Object.assign(toast.style, {
    padding: '6px 12px',
    borderRadius: '8px',
    color: '#fff',
    font: `600 13px/1.4 ${FONT}`,
    whiteSpace: 'nowrap',
    opacity: '0',
    transition: 'opacity 120ms ease',
  });

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '4px',
    borderRadius: '999px',
    background: 'rgba(15,20,25,.82)',
    boxShadow: '0 2px 12px rgba(0,0,0,.4)',
    pointerEvents: 'auto',
    userSelect: 'none',
  });

  const buttons = {};

  const ICONS = {
    left: 'M15 4.5 7.5 12l7.5 7.5',
    right: 'M9 4.5 16.5 12 9 19.5',
    minus: 'M5.5 12h13',
    plus: 'M5.5 12h13M12 5.5v13',
  };

  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.display = 'block';
    svg.style.margin = '0 auto';

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', ICONS[name]);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.75');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(path);
    return svg;
  }

  function addButton(action, label, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.act = action;
    if (typeof label === 'string') button.textContent = label;
    else button.appendChild(label);
    button.title = title;

    Object.assign(button.style, {
      minWidth: '34px',
      height: '30px',
      padding: '0 10px',
      border: 'none',
      borderRadius: '999px',
      background: 'transparent',
      color: '#e7e9ea',
      font: `600 13px/30px ${FONT}`,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    });

    button.addEventListener('mouseenter', () => {
      if (!button.dataset.on && !button.disabled) button.style.background = 'rgba(255,255,255,.12)';
    });
    button.addEventListener('mouseleave', () => {
      if (!button.dataset.on) button.style.background = 'transparent';
    });

    if (typeof label !== 'string') button.style.minWidth = '40px';

    buttons[action] = button;
    bar.appendChild(button);
  }

  function addSeparator() {
    const line = document.createElement('div');
    Object.assign(line.style, {
      width: '1px',
      height: '18px',
      margin: '0 4px',
      background: 'rgba(255,255,255,.2)',
    });
    bar.appendChild(line);
  }

  addButton('prev', icon('left'), '上一張（←）');
  addSeparator();
  addButton('out', icon('minus'), '縮小 25%（-）');
  addButton('fit', '100%', '回到 100%（0）');
  addButton('in', icon('plus'), '放大 25%（+）');
  addSeparator();
  addButton('select', '框選', '框選一塊區域複製（也可以按住 Shift 拖曳）');
  addButton('copy', '複製', '複製整張原圖（Ctrl+C）');
  addButton('download', '下載', '下載原圖');
  addSeparator();
  addButton('reset', '還原', '還原成 X 原本的顯示（Esc）');
  addSeparator();
  addButton('next', icon('right'), '下一張（→）');

  ui.append(toast, bar);

  // Keep X (swipe, clicks) and other scripts away from the toolbar.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'touchstart']) {
    bar.addEventListener(type, (e) => e.stopPropagation());
  }

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-act]');
    if (button) runAction(button.dataset.act);
  });

  function carouselButton(side) {
    const button = document
      .querySelector(`[role="dialog"] [data-testid="Carousel-Nav${side}"]`)
      ?.querySelector('button, [role="button"]');

    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
    return button;
  }

  // Change image through X's own carousel (works zoomed or not).
  function navigate(side) {
    const button = carouselButton(side);
    if (!button) return false;

    close();
    button.click();
    return true;
  }

  function setEnabled(button, enabled) {
    button.disabled = !enabled;
    button.style.opacity = enabled ? '1' : '.4';
    button.style.cursor = enabled ? 'pointer' : 'default';
  }

  function updateBar() {
    const zoomed = Boolean(state?.w);

    buttons.fit.textContent = zoomed ? `${Math.round((state.scale / state.base) * 100)}%` : '100%';
    buttons.fit.title = zoomed
      ? `回到 100%（0）· 原圖 ${state.w}×${state.h}，目前為實際像素的 ${Math.round(state.scale * 100)}%`
      : '回到 100%（0）';

    setOn(buttons.select, selectMode);

    setEnabled(buttons.reset, Boolean(state) && (selectMode || !isAtBase()));
    setEnabled(buttons.prev, Boolean(carouselButton('Left')));
    setEnabled(buttons.next, Boolean(carouselButton('Right')));
  }

  function setOn(button, on) {
    if (on) button.dataset.on = '1';
    else delete button.dataset.on;

    button.style.background = on ? '#1d9bf0' : 'transparent';
    button.style.color = on ? '#fff' : '#e7e9ea';
  }

  // Keep the toolbar on the image currently shown.
  function mountToolbar() {
    const slide = currentSlide();

    if (!slide) {
      if (ui.isConnected) ui.remove();
      return;
    }

    if (ui.parentElement !== slide) {
      if (getComputedStyle(slide).position === 'static') slide.style.position = 'relative';
      slide.appendChild(ui);
    }

    updateBar();
  }

  setInterval(mountToolbar, 300);

  async function runAction(action) {
    if (action === 'prev') return navigate('Left');
    if (action === 'next') return navigate('Right');
    if (action === 'copy') return copyWhole();
    if (action === 'download') return download();
    if (action === 'reset') {
      selectMode = false;
      close();
      return;
    }

    if (action === 'select') {
      selectMode = !selectMode;
      if (state) state.layer.style.cursor = selectMode ? 'crosshair' : 'grab';
      updateBar();

      if (!selectMode) {
        endIfAtBase();
        return;
      }
    }

    // Already at 100%: nothing to do.
    if (action === 'fit' && !state) return;

    // Everything else zooms: start zooming first if needed.
    if (!(await ensureOpen())) return;

    if (action === 'out') stepZoom(-1);
    else if (action === 'in') stepZoom(+1);
    else if (action === 'fit') fit();

    endIfAtBase();
  }

  async function ensureOpen() {
    if (!state) {
      const slide = currentSlide();
      if (!slide) return false;
      open(hitFromSlide(slide), null);
    }

    await state.ready;
    return Boolean(state?.w);
  }

  // ============================================================
  // Start zooming: wheel over the image in X's viewer
  // ============================================================

  window.addEventListener(
    'wheel',
    (event) => {
      if (state || event.ctrlKey) return;

      const hit = viewerImageAt(event.target, event.clientX, event.clientY);
      if (!hit) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      open(hit, event);
    },
    { capture: true, passive: false }
  );

  // ============================================================
  // Zoom layer, placed inside X's own image container
  // ============================================================

  function makeImage() {
    const img = document.createElement('img');
    img.draggable = false;
    img.alt = '';
    Object.assign(img.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      maxWidth: 'none',
      maxHeight: 'none',
      transformOrigin: '0 0',
      willChange: 'transform',
      pointerEvents: 'none',
    });
    return img;
  }

  function open(hit, wheelEvent) {
    const host = hit.slide;

    const layer = document.createElement('div');
    layer.setAttribute(UI_ATTR, '');
    Object.assign(layer.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '1',
      overflow: 'hidden',
      cursor: selectMode ? 'crosshair' : 'grab',
      userSelect: 'none',
      touchAction: 'none',
      visibility: 'hidden', // shown together with hiding X's image, see load()
    });

    const img = makeImage();

    const selection = document.createElement('div');
    Object.assign(selection.style, {
      position: 'absolute',
      display: 'none',
      border: '1px dashed #1d9bf0',
      background: 'rgba(29,155,240,.15)',
      pointerEvents: 'none',
    });

    layer.append(img, selection);

    const hostPosition = host.style.position;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    host.appendChild(layer);

    let resolveReady;

    state = {
      host, hostPosition, hidden: [], layer, img, selection,
      path: location.pathname, watch: 0,
      w: 0, h: 0, scale: 1, tx: 0, ty: 0,
      base: 1, baseTx: 0, baseTy: 0, // X's own size / position = 100%
      origURL: originalURL(hit.url), drag: null,
      ready: new Promise((r) => { resolveReady = r; }),
    };

    // Image changed or the viewer closed -> back to normal.
    state.watch = setInterval(() => {
      if (state && (location.pathname !== state.path || !state.layer.isConnected)) close();
    }, 250);

    layer.addEventListener('wheel', onWheel, { passive: false });
    layer.addEventListener('pointerdown', onPointerDown);
    layer.addEventListener('pointermove', onPointerMove);
    layer.addEventListener('pointerup', onPointerUp);
    layer.addEventListener('pointercancel', onPointerUp);
    layer.addEventListener('dblclick', onDoubleClick);

    // Keep X's swipe / click handlers out of what happens on the layer.
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchmove']) {
      layer.addEventListener(type, (e) => e.stopPropagation());
    }

    load(hit, wheelEvent, resolveReady);
  }

  function close() {
    const s = state;
    if (!s) return;

    state = null;
    clearInterval(s.watch);
    s.layer.remove();
    s.host.style.position = s.hostPosition;

    for (const [node, visibility] of s.hidden) node.style.visibility = visibility;

    updateBar();
  }

  // Start exactly where X shows the image (no jump), then swap in the
  // original resolution at the same on-screen size.
  async function load(hit, wheelEvent, resolveReady) {
    const s = state;

    s.img.src = hit.url;

    try {
      await s.img.decode();
    } catch {
      // Keep going; the original may still load.
    }

    if (state !== s) return resolveReady();

    // Could not load even X's version: leave X's image as it is.
    if (!s.img.naturalWidth) {
      close();
      return resolveReady();
    }

    const box = s.layer.getBoundingClientRect();

    s.w = s.img.naturalWidth;
    s.h = s.img.naturalHeight;

    if (hit.rect.width) {
      s.base = hit.rect.width / s.w;
      s.baseTx = hit.rect.left - box.left;
      s.baseTy = hit.rect.top - box.top;
    } else {
      s.base = Math.min(s.layer.clientWidth / s.w, s.layer.clientHeight / s.h);
      s.baseTx = (s.layer.clientWidth - s.w * s.base) / 2;
      s.baseTy = (s.layer.clientHeight - s.h * s.base) / 2;
    }

    fit();

    // Ours is decoded and sits exactly on X's: swap them in one frame,
    // so there is never a moment with no image (no flicker).
    s.hidden = mediaElementsIn(s.host).map((node) => [node, node.style.visibility]);
    for (const [node] of s.hidden) node.style.visibility = 'hidden';
    s.layer.style.visibility = '';

    if (wheelEvent) {
      const p = local(wheelEvent);
      zoomAt(p.x, p.y, s.scale * wheelFactor(wheelEvent));
    }

    resolveReady();

    // Original resolution: decode a second <img>, place it, then replace
    // the first one (changing src in place can blank for a frame).
    const original = makeImage();
    original.src = s.origURL;

    try {
      await original.decode();
    } catch {
      return; // stay on the displayed version
    }

    if (state !== s) return;

    const ratio = s.w / original.naturalWidth;
    const previous = s.img;

    s.w = original.naturalWidth;
    s.h = original.naturalHeight;
    s.scale *= ratio;
    s.base *= ratio;
    s.img = original;

    previous.after(original);
    apply();
    previous.remove();
  }

  // ============================================================
  // Transform (coordinates are relative to the layer)
  // ============================================================

  function local(event) {
    const box = state.layer.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  // "Fit" = exactly the size and position X showed the image at.
  function fitScale() {
    return state.base;
  }

  function fit() {
    const s = state;
    s.scale = s.base;
    s.tx = s.baseTx;
    s.ty = s.baseTy;
    apply();
  }

  // Same size and position X shows the image at.
  function isAtBase() {
    const s = state;
    return (
      Math.abs(s.scale / s.base - 1) < 0.005 &&
      Math.abs(s.tx - s.baseTx) < 1 &&
      Math.abs(s.ty - s.baseTy) < 1
    );
  }

  // Back at 100% in place (and not selecting): end the zoom so X's own
  // behavior (edge navigation, double-click Like) works again.
  function endIfAtBase() {
    if (state?.w && !state.drag && !selectMode && isAtBase()) close();
  }

  function apply() {
    const s = state;

    s.img.style.width = `${s.w}px`;
    s.img.style.height = `${s.h}px`;
    s.img.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`;
    s.img.style.imageRendering = s.scale >= 3 ? 'pixelated' : 'auto';

    updateBar();
  }

  function zoomAt(x, y, target) {
    const s = state;
    const min = Math.min(fitScale() * MIN_FIT_RATIO, s.scale);
    const next = Math.min(MAX_SCALE, Math.max(min, target));

    // Passing 100% (either way) stops exactly at X's own size and position.
    const above = (v) => v > s.base * 1.005;
    const below = (v) => v < s.base * 0.995;

    if ((above(s.scale) && !above(next)) || (below(s.scale) && !below(next))) {
      fit();
      return;
    }

    s.tx = x - ((x - s.tx) * next) / s.scale;
    s.ty = y - ((y - s.ty) * next) / s.scale;
    s.scale = next;

    apply();
  }

  function zoomAtCenter(target) {
    zoomAt(state.layer.clientWidth / 2, state.layer.clientHeight / 2, target);
  }

  // + / −: next 25% mark (137% -> 150% or 125%), never below 25%.
  function stepZoom(direction) {
    const percent = (state.scale / state.base) * 100;
    const index = percent / PERCENT_STEP;

    const nextIndex = direction > 0
      ? Math.floor(index + 1e-6) + 1
      : Math.ceil(index - 1e-6) - 1;

    const nextPercent = Math.max(PERCENT_STEP, nextIndex * PERCENT_STEP);
    zoomAtCenter(state.base * (nextPercent / 100));
  }

  function wheelFactor(event) {
    const perUnit = event.deltaMode === 1 ? 0.05 : 0.0015; // lines vs pixels
    return Math.exp(-event.deltaY * perUnit);
  }

  function toImage(p) {
    const s = state;
    return { x: (p.x - s.tx) / s.scale, y: (p.y - s.ty) / s.scale };
  }

  function isOnImage(p) {
    const q = toImage(p);
    return q.x >= 0 && q.y >= 0 && q.x <= state.w && q.y <= state.h;
  }

  // Left / right strip of the image column (the zoom layer covers it
  // exactly). Null for a single image, which has no previous / next.
  function edgeAt(p) {
    const s = state;
    if (!s.host.closest('ul')) return null;

    const position = p.x / s.layer.clientWidth;
    return position < NAV_ZONE ? 'Left' : position > 1 - NAV_ZONE ? 'Right' : null;
  }

  // ============================================================
  // Mouse on the zoom layer
  // ============================================================

  function onWheel(event) {
    event.preventDefault();
    event.stopPropagation();

    const p = local(event);
    zoomAt(p.x, p.y, state.scale * wheelFactor(event));
    endIfAtBase();
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;

    event.preventDefault();

    try {
      state.layer.setPointerCapture(event.pointerId);
    } catch {
      // Not critical: dragging still works while the pointer stays on the layer.
    }

    state.drag = {
      mode: event.shiftKey || selectMode ? 'select' : 'pan',
      start: local(event),
      tx: state.tx,
      ty: state.ty,
      moved: false,
    };

    if (state.drag.mode === 'pan') state.layer.style.cursor = 'grabbing';
  }

  function restingCursor(event) {
    if (event.shiftKey || selectMode) return 'crosshair';

    const side = state && edgeAt(local(event));
    if (side && carouselButton(side)) return side === 'Left' ? 'w-resize' : 'e-resize';
    return 'grab';
  }

  function onPointerMove(event) {
    const s = state;
    if (!s) return;

    const d = s.drag;

    if (!d) {
      s.layer.style.cursor = restingCursor(event);
      return;
    }

    const p = local(event);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;

    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;

    if (d.mode === 'pan') {
      s.tx = d.tx + dx;
      s.ty = d.ty + dy;
      apply();
      return;
    }

    Object.assign(s.selection.style, {
      display: 'block',
      left: `${Math.min(d.start.x, p.x)}px`,
      top: `${Math.min(d.start.y, p.y)}px`,
      width: `${Math.abs(dx)}px`,
      height: `${Math.abs(dy)}px`,
    });
  }

  function onPointerUp(event) {
    const s = state;
    const d = s?.drag;
    if (!d) return;

    s.drag = null;
    s.layer.style.cursor = restingCursor(event);
    s.selection.style.display = 'none';

    const p = local(event);

    if (d.mode === 'select' && d.moved) {
      const a = toImage(d.start);
      const b = toImage(p);
      copyImage(s.origURL, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, shownW: s.w, shownH: s.h });
      return;
    }

    if (!d.moved && event.type === 'pointerup') {
      // Plain click in the left / right strip: change image
      // (first / last image: nothing happens).
      const side = d.mode === 'pan' ? edgeAt(p) : null;
      if (side) {
        navigate(side);
        return;
      }

      // Plain click beside the image: back to X's normal view.
      if (!isOnImage(p)) {
        close();
        return;
      }
    }

    endIfAtBase();
  }

  function onDoubleClick(event) {
    event.preventDefault();

    const p = local(event);
    if (!isOnImage(p) || edgeAt(p)) return;

    if (Math.abs(state.scale / state.base - 1) < 0.01) {
      zoomAt(p.x, p.y, state.base * 2);
    } else {
      fit();
      endIfAtBase();
    }
  }

  // ============================================================
  // Keyboard (only while zoomed)
  // ============================================================

  window.addEventListener(
    'keydown',
    (event) => {
      if (!state) return;

      const mod = IS_MAC ? event.metaKey : event.ctrlKey;
      let handled = true;

      if (event.key === 'Escape') {
        close();
      } else if (mod && event.code === 'KeyC') {
        copyWhole();
      } else if (mod || event.altKey) {
        handled = false;
      } else if (event.key === 'ArrowLeft') {
        navigate('Left');
      } else if (event.key === 'ArrowRight') {
        navigate('Right');
      } else if (event.key === '0') {
        fit();
        endIfAtBase();
      } else if (event.key === '+' || event.key === '=') {
        stepZoom(+1);
        endIfAtBase();
      } else if (event.key === '-') {
        stepZoom(-1);
        endIfAtBase();
      } else {
        handled = false;
      }

      if (handled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'keyup',
    (event) => {
      if (state && event.key === 'Shift' && !state.drag) state.layer.style.cursor = restingCursor(event);
    },
    true
  );

  // ============================================================
  // Copy / download
  // ============================================================

  function currentOriginalURL() {
    if (state) return state.origURL;

    const slide = currentSlide();
    return slide ? originalURL(hitFromSlide(slide).url) : null;
  }

  function getBitmap(url) {
    if (!bitmaps.has(url)) {
      if (bitmaps.size >= 3) bitmaps.delete(bitmaps.keys().next().value);

      const promise = fetch(url, { credentials: 'omit' })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.blob();
        })
        .then((blob) => createImageBitmap(blob));

      promise.catch(() => bitmaps.delete(url));
      bitmaps.set(url, promise);
    }

    return bitmaps.get(url);
  }

  function copyWhole() {
    const url = currentOriginalURL();
    if (url) copyImage(url, null);
  }

  // region: { x1, y1, x2, y2, shownW, shownH } in the shown image's pixels,
  // or null for the whole image.
  function copyImage(url, region) {
    let size = '';

    const pngPromise = getBitmap(url).then((bitmap) => {
      let left = 0;
      let top = 0;
      let right = bitmap.width;
      let bottom = bitmap.height;

      if (region) {
        const kx = bitmap.width / region.shownW;
        const ky = bitmap.height / region.shownH;

        left = Math.max(0, Math.round(Math.min(region.x1, region.x2) * kx));
        top = Math.max(0, Math.round(Math.min(region.y1, region.y2) * ky));
        right = Math.min(bitmap.width, Math.round(Math.max(region.x1, region.x2) * kx));
        bottom = Math.min(bitmap.height, Math.round(Math.max(region.y1, region.y2) * ky));
      }

      const w = right - left;
      const h = bottom - top;
      if (w < 1 || h < 1) throw new Error('empty');

      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext('2d').drawImage(bitmap, left, top, w, h, 0, 0, w, h);

      size = `${w}×${h}`;
      return canvas.convertToBlob({ type: 'image/png' });
    });

    // Start the write inside the user gesture; the data arrives later.
    showToast('複製中…');

    navigator.clipboard
      .write([new ClipboardItem({ 'image/png': pngPromise })])
      .then(
        () => showToast(`已複製 ${size}`.trim()),
        (error) => {
          console.error('[X Image Viewer]', error);
          showToast(error?.message === 'empty' ? '選取範圍在圖片外' : '複製失敗', true);
        }
      );
  }

  async function download() {
    const url = currentOriginalURL();
    const match = location.pathname.match(VIEWER_RE);
    if (!url || !match) return;

    const u = new URL(url);
    const ext = u.searchParams.get('format') || u.pathname.match(/\.(\w+)$/)?.[1] || 'jpg';
    const filename = `${match[1]}_${match[2]}_${match[3]}.${ext}`;

    showToast('下載中…');

    try {
      const response = await fetch(url, { credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const objectURL = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectURL;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectURL), 10000);

      showToast(`已下載 ${filename}`);
    } catch (error) {
      console.error('[X Image Viewer]', error);
      showToast('下載失敗', true);
    }
  }

  let toastTimer = 0;

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.style.background = isError ? 'rgba(220,38,38,.95)' : 'rgba(29,155,240,.95)';
    toast.style.opacity = '1';

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 1600);
  }
})();
