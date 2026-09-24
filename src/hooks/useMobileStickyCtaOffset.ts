import { useEffect, useState } from "react";

const CSS_VAR = "--mobile-cta-h";

/**
 * Publishes the height of a page's mobile sticky CTA bar as `--mobile-cta-h` on <html>,
 * so floating widgets (mascot, community chip, visit notice) can sit above it instead of
 * covering the order button. The bar is `md:hidden`, so on desktop it measures 0.
 *
 * Returns a callback ref to attach to the bar (it may mount after a loading state).
 */
export const useMobileStickyCtaOffset = () => {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;
    const root = document.documentElement;

    const update = () => root.style.setProperty(CSS_VAR, `${element.offsetHeight}px`);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty(CSS_VAR);
    };
  }, [element]);

  return setElement;
};
