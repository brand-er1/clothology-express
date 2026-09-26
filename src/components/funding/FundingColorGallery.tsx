import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildColorSlides, colorHexOf, slideIndexForColor, type FundingColor } from "@/lib/funding-colors";

type Props = {
  colors: FundingColor[];
  fallbackImage: string | null;
  productName: string;
  /** 현재 선택된 컬러명(구매 옵션과 공유) */
  selectedColor: string;
  onSelectColor: (colorName: string) => void;
  /** 이미지 위에 겹쳐 그릴 요소(워터마크, 라벨 등) */
  overlay?: ReactNode;
  className?: string;
};

/**
 * 펀딩 상세 상단 상품 이미지: 컬러별 슬라이드(모바일 스와이프 / PC 좌우 화살표 / 인디케이터)
 * + 아래 컬러 선택 버튼. 슬라이드 ↔ 컬러 선택은 양방향으로 동기화된다.
 */
export const FundingColorGallery = ({ colors, fallbackImage, productName, selectedColor, onSelectColor, overlay, className }: Props) => {
  const slides = useMemo(() => buildColorSlides(colors, fallbackImage), [colors, fallbackImage]);
  const [emblaRef, embla] = useEmblaCarousel({ loop: false, align: "start" });
  const [index, setIndex] = useState(0);
  // 사용자가 슬라이드를 넘겨 컬러가 바뀐 경우, 그 컬러 변경으로 다시 첫 슬라이드로 점프하지 않도록 기억한다.
  const colorFromSlide = useRef<string | null>(null);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      const next = embla.selectedScrollSnap();
      setIndex(next);
      const slide = slides[next];
      if (slide?.colorName && slide.colorName !== selectedColor) {
        colorFromSlide.current = slide.colorName;
        onSelectColor(slide.colorName);
      }
    };
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, slides, selectedColor, onSelectColor]);

  useEffect(() => {
    embla?.reInit();
  }, [embla, slides.length]);

  // 컬러 선택(버튼/구매 옵션) → 해당 컬러 첫 슬라이드로 이동
  useEffect(() => {
    if (!embla || !selectedColor) return;
    if (colorFromSlide.current === selectedColor) {
      colorFromSlide.current = null;
      return;
    }
    const current = slides[embla.selectedScrollSnap()];
    if (current && current.colorName.toLowerCase() === selectedColor.toLowerCase()) return;
    const target = slideIndexForColor(slides, selectedColor);
    if (target >= 0) embla.scrollTo(target);
  }, [embla, selectedColor, slides]);

  const scrollPrev = useCallback(() => embla?.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla?.scrollNext(), [embla]);
  const current = slides[index];

  return (
    <div className={className}>
      <section className="relative overflow-hidden bg-[#e7e4df]" data-tutorial="funding-detail-image" aria-roledescription="carousel" aria-label={`${productName} 상품 이미지`}>
        <div ref={emblaRef} className="overflow-hidden" onKeyDown={(event) => {
          if (event.key === "ArrowLeft") scrollPrev();
          if (event.key === "ArrowRight") scrollNext();
        }} tabIndex={0}>
          <div className="flex touch-pan-y">
            {slides.map((slide, slideIndex) => (
              <div key={slide.key} className="relative aspect-[4/5] min-w-0 shrink-0 grow-0 basis-full sm:aspect-square lg:aspect-[4/5]" aria-roledescription="slide" aria-label={`${slideIndex + 1} / ${slides.length}`}>
                <img
                  src={slide.url}
                  alt={`${productName}${slide.colorName ? ` ${slide.colorName}` : ""}${slide.view === "back" ? " 뒷면" : slide.view === "front" ? " 앞면" : ""}`}
                  className="h-full w-full select-none object-contain p-5 sm:p-10 lg:p-12"
                  draggable={false}
                  loading={slideIndex === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
        </div>
        {overlay}
        {current?.colorName && (
          <span className="pointer-events-none absolute bottom-4 left-4 bg-[#f3f1ed]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-700 backdrop-blur-sm sm:bottom-6 sm:left-6">
            {current.colorName}{current.view === "back" ? " · BACK" : current.view === "front" ? " · FRONT" : ""}
          </span>
        )}
        {slides.length > 1 && (
          <>
            <button type="button" onClick={scrollPrev} disabled={index === 0} aria-label="이전 이미지"
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-800 shadow-sm transition hover:bg-white disabled:opacity-30 md:flex">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={scrollNext} disabled={index === slides.length - 1} aria-label="다음 이미지"
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-800 shadow-sm transition hover:bg-white disabled:opacity-30 md:flex">
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 sm:bottom-6 sm:right-6" role="tablist" aria-label="이미지 위치">
              {slides.map((slide, slideIndex) => (
                <button key={slide.key} type="button" role="tab" aria-selected={slideIndex === index} aria-label={`${slideIndex + 1}번째 이미지`}
                  onClick={() => embla?.scrollTo(slideIndex)}
                  className={cn("h-1.5 rounded-full transition-all", slideIndex === index ? "w-5 bg-stone-900" : "w-1.5 bg-stone-900/30")} />
              ))}
              <span className="ml-1.5 text-[11px] font-bold tabular-nums text-stone-700">{index + 1} / {slides.length}</span>
            </div>
          </>
        )}
      </section>

      {colors.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="컬러 선택">
          {colors.map((color) => {
            const active = color.name.toLowerCase() === selectedColor.toLowerCase();
            return (
              <button key={color.id} type="button" role="radio" aria-checked={active} onClick={() => onSelectColor(color.name)}
                className={cn("inline-flex min-h-10 items-center gap-2 border px-3 text-xs font-bold tracking-[0.06em] transition",
                  active ? "border-brand bg-brand/5 text-brand" : "border-black/15 text-stone-600 hover:bg-black/5")}>
                <span className="h-4 w-4 rounded-full border border-black/15" style={{ backgroundColor: colorHexOf(color) }} />
                {color.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
