import { useEffect, useRef } from "react";

/**
 * A restrained, slow parallax: the element drifts a few percent slower/faster than scroll,
 * applied only to a handful of large hero/showcase images per the design brief ("정도만
 * 사용한다") — never to text or UI. `strength` is the max translate in px at the viewport
 * edges; keep it small (20–48) so the effect reads as subtle depth, not a gimmick.
 */
export const useParallax = <T extends HTMLElement>(strength = 32) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const distance = (elementCenter - viewportCenter) / window.innerHeight;
      const offset = Math.max(-1, Math.min(1, distance)) * strength;
      node.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [strength]);

  return ref;
};
