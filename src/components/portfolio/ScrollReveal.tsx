import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fires once when the element enters the viewport, then disconnects — slow, deliberate
 * fade/rise entrances (never re-triggered on scroll-back) matching the "느리고 고급스러운"
 * animation brief: no bounce, no re-play, no scroll-jank.
 *
 * A content reveal must never have a failure mode where the content stays invisible — a missed
 * IntersectionObserver callback (fast/programmatic scrolls can skip a transient intersecting
 * state between two observer callback frames) would otherwise permanently hide a portfolio
 * image. A short fallback timer guarantees `inView` becomes true regardless, so the very worst
 * case is a skipped entrance animation, never a blank tile. */
const useInView = (threshold = 0.01) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const reveal = () => {
      setInView(true);
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) reveal();
      },
      { threshold },
    );
    observer.observe(node);

    // Safety net: force a reveal shortly after the element is first observed even if no
    // intersection callback ever reports it as visible.
    const fallbackTimer = window.setTimeout(reveal, 1800);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, [threshold]);

  return { ref, inView };
};

interface RevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  variant?: "up" | "fade";
  style?: CSSProperties;
}

/** Fade-up / fade-in text & block reveal. Duration is intentionally long (900–1100ms) with a
 * decelerating ease so it reads as premium/editorial, not snappy. */
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export const Reveal = ({ children, className = "", delayMs = 0, variant = "up", style }: RevealProps) => {
  const { ref, inView } = useInView();
  const hidden = variant === "up" ? "translate-y-8 opacity-0" : "opacity-0";
  return (
    <div
      ref={ref}
      className={`${inView ? "translate-y-0 opacity-100" : hidden} ${className}`}
      style={{
        transitionProperty: "opacity, transform",
        transitionDuration: "1000ms",
        transitionTimingFunction: EASE,
        transitionDelay: `${delayMs}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Image-specific reveal: a soft clip-path wipe plus a slight scale/opacity settle — the
 * "Image Reveal" effect from the brief. Kept to images only, never applied to UI chrome. */
export const RevealImage = ({ children, className = "", delayMs = 0 }: RevealProps) => {
  const { ref, inView } = useInView(0.08);
  return (
    <div
      ref={ref}
      className={`overflow-hidden ${className}`}
      style={{
        clipPath: inView ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
        transition: `clip-path 1200ms ${EASE}`,
        transitionDelay: `${delayMs}ms`,
      }}
    >
      <div
        className="h-full w-full"
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "scale(1)" : "scale(1.08)",
          transitionProperty: "opacity, transform",
          transitionDuration: "1300ms",
          transitionTimingFunction: EASE,
          transitionDelay: `${delayMs}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
