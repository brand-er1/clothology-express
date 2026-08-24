import { ChevronLeft, ChevronRight } from "lucide-react";
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
 * Hero band slideshow: sample photos laid out in a single horizontal row (one per category
 * where possible) that the customer moves through directly — touch swipe and trackpad scroll
 * work natively (scroll-snap), a mouse pointer can click-drag the row like a real carousel, and
 * arrow buttons + dots give an explicit way to advance. A gentle autoplay nudges it forward when
 * idle. Replaces pinning a single static image, which could land on an odd one-off item (e.g. a
 * lone pair of shorts) with nothing else in view.
 */
export const HeroCarousel = ({ slides }: { slides: HeroSlide[] }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isProgrammaticScroll = useRef(false);
  const drag = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    isProgrammaticScroll.current = true;
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    setActiveIndex(clamped);
    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 600);
  }, [slides.length]);

  // Keep the dot indicator in sync when the customer drags/swipes/scrolls the row themselves.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      if (isProgrammaticScroll.current) return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const width = track.clientWidth || 1;
        setActiveIndex(Math.round(track.scrollLeft / width));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Click-and-drag support for mouse pointers — browsers don't turn a plain mouse drag into
  // scrolling on an overflow-auto container the way touch/trackpad gestures do, so without this
  // a desktop mouse user has no way to "grab" the row.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return; // native touch scrolling already handles this
      drag.current = { pointerId: event.pointerId, startX: event.clientX, startScrollLeft: track.scrollLeft, moved: false };
      track.setPointerCapture(event.pointerId);
      track.classList.add("cursor-grabbing");
      // Scroll-snap actively resists a manually-set scrollLeft while dragging (each frame pulls
      // it back toward the nearest snap point), which made the row barely move under a real drag.
      // Suspending snap for the duration of the gesture lets it track the pointer 1:1.
      track.style.scrollSnapType = "none";
    };
    const onPointerMove = (event: PointerEvent) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const delta = event.clientX - state.startX;
      if (Math.abs(delta) > 3) state.moved = true;
      track.scrollLeft = state.startScrollLeft - delta;
    };
    const endDrag = (event: PointerEvent) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      track.classList.remove("cursor-grabbing");
      track.style.scrollSnapType = "";
      const width = track.clientWidth || 1;
      const totalDelta = event.clientX - state.startX;
      const originIndex = Math.round(state.startScrollLeft / width);
      // A real carousel commits to the next/previous slide well before a full-width drag —
      // requiring the pointer to cross half the slide (the old rounded-position approach) made a
      // full-width hero band nearly undraggable. 12% of the slide's width is enough to register
      // as an intentional swipe; anything short of that snaps back to where it started.
      const committed = Math.abs(totalDelta) > width * 0.12;
      const targetIndex = committed ? originIndex + (totalDelta < 0 ? 1 : -1) : originIndex;
      scrollToIndex(targetIndex);
      // Swallow the click that follows a real drag so it doesn't register as a tap on an image.
      if (state.moved) {
        const suppressClick = (clickEvent: MouseEvent) => clickEvent.stopPropagation();
        track.addEventListener("click", suppressClick, { capture: true, once: true });
      }
      drag.current = null;
    };

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    return () => {
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", endDrag);
      track.removeEventListener("pointercancel", endDrag);
    };
  }, [scrollToIndex]);

  // Gentle autoplay — pauses while the customer is actively interacting with the row.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || slides.length <= 1 || prefersReducedMotion()) return;
    let paused = false;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    track.addEventListener("pointerdown", pause);
    track.addEventListener("pointerup", resume);
    track.addEventListener("mouseenter", pause);
    track.addEventListener("mouseleave", resume);

    const timer = window.setInterval(() => {
      if (paused) return;
      const width = track.clientWidth || 1;
      const current = Math.round(track.scrollLeft / width);
      const next = (current + 1) % slides.length;
      isProgrammaticScroll.current = true;
      track.scrollTo({ left: next * width, behavior: "smooth" });
      setActiveIndex(next);
      window.setTimeout(() => { isProgrammaticScroll.current = false; }, 600);
    }, AUTOPLAY_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      track.removeEventListener("pointerdown", pause);
      track.removeEventListener("pointerup", resume);
      track.removeEventListener("mouseenter", pause);
      track.removeEventListener("mouseleave", resume);
    };
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="group relative mx-auto max-w-[1600px]">
      <div
        ref={trackRef}
        className="flex h-[46vh] cursor-grab snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] sm:h-[58vh] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div key={slide.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
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
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="이전 사진"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#211b1c] opacity-0 shadow transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 group-hover:opacity-100 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === slides.length - 1}
            aria-label="다음 사진"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-[#211b1c] opacity-0 shadow transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 group-hover:opacity-100 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-6">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => scrollToIndex(index)}
                aria-label={`${index + 1}번째 사진 보기`}
                className={`pointer-events-auto h-1.5 rounded-full transition-all duration-500 ${
                  index === activeIndex ? "w-6 bg-brand" : "w-1.5 bg-black/20 hover:bg-black/35"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
