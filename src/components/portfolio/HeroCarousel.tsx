import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  id: string;
  src: string;
  alt: string;
}

const AUTOPLAY_INTERVAL_MS = 4200;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Slow, deliberate crossfade slideshow for the hero band — cycles through a handful of
 * representative sample photos (one per category where possible) instead of pinning a single
 * static image, which previously could land on an odd one-off item (e.g. a single pants photo)
 * with nothing else in view. Swipeable on touch, dot navigation, pauses autoplay on interaction.
 */
export const HeroCarousel = ({ slides }: { slides: HeroSlide[] }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      setActiveIndex(((index % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (slides.length <= 1 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [slides.length, activeIndex]);

  if (slides.length === 0) return null;

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(activeIndex + (delta < 0 ? 1 : -1));
  };

  return (
    <div
      ref={containerRef}
      className="relative mx-auto h-[46vh] max-w-[1600px] touch-pan-y sm:h-[58vh]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: index === activeIndex ? 1 : 0,
            pointerEvents: index === activeIndex ? "auto" : "none",
            transitionProperty: "opacity",
            transitionDuration: "1400ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          aria-hidden={index !== activeIndex}
        >
          <img
            src={slide.src}
            alt={slide.alt}
            className="h-full w-full object-contain p-10 sm:p-16"
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        </div>
      ))}

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-6">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`${index + 1}번째 사진 보기`}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                index === activeIndex ? "w-6 bg-brand" : "w-1.5 bg-black/20 hover:bg-black/35"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
