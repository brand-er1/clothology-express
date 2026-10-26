import { useEffect, useState } from "react";

const NAV_HEIGHT_VAR = "--bottom-nav-h";
const VIEWPORT_INSET_VAR = "--viewport-bottom-inset";
// Browser chrome drawn over the page (Instagram/KakaoTalk in-app toolbars) is well under this;
// anything taller is the on-screen keyboard, which the tab bar should stay behind.
const MAX_CHROME_INSET = 120;

/**
 * Publishes the mobile tab bar's real footprint on <html> so every bottom-pinned element
 * (order/CTA bars, floating widgets, the app shell's bottom padding) is laid out from measured
 * values instead of a hard-coded 56px:
 *
 * - `--viewport-bottom-inset`: how far the visible area ends above the layout viewport's bottom.
 *   Some in-app browsers (Instagram, KakaoTalk on iOS) overlay their toolbar on the web view, so a
 *   `bottom: 0` bar is partially hidden; the tab bar is lifted by this amount.
 * - `--bottom-nav-h`: inset + the bar's rendered height (icons, labels and safe-area padding).
 *   Measures 0 when the bar is `md:hidden`, so tablet/desktop layouts are unaffected.
 *
 * Returns a callback ref for the tab bar element.
 */
export const useBottomNavMetrics = () => {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const update = () => {
      let inset = 0;
      // Pinch-zoom also shrinks the visual viewport; only measure at the default scale.
      if (viewport && Math.abs(viewport.scale - 1) < 0.01) {
        const gap = Math.round(window.innerHeight - (viewport.height + viewport.offsetTop));
        if (gap > 0 && gap <= MAX_CHROME_INSET) inset = gap;
      }
      const height = getComputedStyle(element).display === "none" ? 0 : element.offsetHeight;
      root.style.setProperty(VIEWPORT_INSET_VAR, `${height ? inset : 0}px`);
      root.style.setProperty(NAV_HEIGHT_VAR, `${height ? height + inset : 0}px`);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    viewport?.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      viewport?.removeEventListener("resize", update);
      root.style.removeProperty(VIEWPORT_INSET_VAR);
      root.style.removeProperty(NAV_HEIGHT_VAR);
    };
  }, [element]);

  return setElement;
};
