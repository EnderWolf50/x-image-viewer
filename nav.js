// X Image Viewer — click the left / right strip of the viewer to navigate
//
// In X's full-screen viewer, the left and right NAV_ZONE of the image
// column (full height, image or dark backdrop alike — the area around
// X's own arrow buttons) go to the previous / next image. The middle is
// left alone, so a double-click there still toggles Like (X Quick Copy).
// Clicks switch immediately, and rapid clicks flip through several images.

(() => {
  'use strict';

  // Width of each edge strip, as a share of the viewer's image column.
  const NAV_ZONE = 0.2;

  const VIEWER_RE = /^\/[^/]+\/status\/\d+\/(photo|video)\/\d+/;
  const SLIDE = '[data-testid="swipe-to-dismiss"]';

  // Clicks on these keep their own behavior (close / expand buttons,
  // X's arrows, the tweet panel, our toolbar and zoom layer, videos).
  const SKIP = [
    'a',
    'button',
    'input',
    'textarea',
    'select',
    'article',
    'video',
    '[role="button"]',
    '[role="link"]',
    '[role="slider"]',
    '[data-testid="videoPlayer"]',
    '[data-xvp-layer]',
  ].join(',');

  let cursorElement = null;
  let moveFrame = 0;

  // ============================================================
  // Is the pointer in the left / right strip of the image column?
  //
  // Returns { side, button } — button is null on the first / last image
  // (the click is then swallowed so it doesn't close the viewer).
  // ============================================================

  function getZone(target, x, y) {
    if (!VIEWER_RE.test(location.pathname)) return null;
    if (!(target instanceof Element)) return null;

    const dialog = target.closest('[role="dialog"], [aria-modal="true"]');
    if (!dialog || target.closest(SKIP)) return null;

    // The column that shows the current image (image + dark backdrop).
    // Found by position: X lays its own arrow containers over the outer
    // edges, so the element under the pointer isn't always inside it.
    let r = null;
    const slide = [...dialog.querySelectorAll(SLIDE)].find((candidate) => {
      const box = candidate.getBoundingClientRect();
      const inside = box.width && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      if (inside) r = box;
      return inside;
    });

    if (!slide) return null;

    // A single image has no previous / next: keep X's behavior.
    if (!slide.closest('ul')) return null;

    const position = (x - r.left) / r.width;

    const side =
      position < NAV_ZONE ? 'Left' :
      position > 1 - NAV_ZONE ? 'Right' :
      null;

    if (!side) return null;

    const button = dialog
      .querySelector(`[data-testid="Carousel-Nav${side}"]`)
      ?.querySelector('button, [role="button"]');

    const usable = button && !button.disabled && button.getAttribute('aria-disabled') !== 'true';

    return { side, button: usable ? button : null };
  }

  // ============================================================
  // Click (window capture: runs before X Quick Copy and X itself,
  // and keeps strip clicks away from double-click-to-Like)
  // ============================================================

  function isPlainLeftClick(event) {
    return (
      event.isTrusted &&
      event.button === 0 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey
    );
  }

  window.addEventListener(
    'click',
    (event) => {
      if (!isPlainLeftClick(event)) return;

      const zone = getZone(event.target, event.clientX, event.clientY);
      if (!zone) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      zone.button?.click();
    },
    true
  );

  // Rapid clicks in a strip shouldn't select anything or reach
  // double-click handlers.
  for (const type of ['mousedown', 'dblclick']) {
    window.addEventListener(
      type,
      (event) => {
        if (!isPlainLeftClick(event)) return;
        if (type === 'mousedown' && event.detail < 2) return;

        if (getZone(event.target, event.clientX, event.clientY)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
  }

  // ============================================================
  // Cursor hint: ← in the left strip, → in the right strip
  // ============================================================

  document.addEventListener(
    'mousemove',
    (event) => {
      if (moveFrame) return;

      const { target, clientX, clientY } = event;

      moveFrame = requestAnimationFrame(() => {
        moveFrame = 0;

        const zone = getZone(target, clientX, clientY);
        const element = zone?.button ? target : null;

        if (cursorElement && cursorElement !== element) {
          cursorElement.style.cursor = '';
        }

        if (element) {
          element.style.cursor = zone.side === 'Left' ? 'w-resize' : 'e-resize';
        }

        cursorElement = element;
      });
    },
    { passive: true }
  );
})();
