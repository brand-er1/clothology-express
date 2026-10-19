import { useEffect, useState } from "react";

const CSS_VAR = "--mobile-cta-h";

/**
 * Publishes the height of a page's sticky CTA bar as `--mobile-cta-h` on <html>,
 * so floating widgets (mascot, community chip, visit notice) can sit above it instead of
 * covering the order button. Only a bar that is actually pinned (fixed/sticky) counts: a bar
 * that is `md:hidden` or turns `static` at a breakpoint measures 0 there, while one that stays
 * pinned on tablet/desktop (e.g. the AI 상세페이지 'AI로 제작하기' bar) keeps lifting the widgets.
 *
 * Returns a callback ref to attach to the bar (it may mount after a loading state).
 */
export const useMobileStickyCtaOffset = () => {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;
    const root = document.documentElement;

    const update = () => {
      const pinned = ["fixed", "sticky"].includes(getComputedStyle(element).position);
      root.style.setProperty(CSS_VAR, `${pinned ? element.offsetHeight : 0}px`);
    };
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
