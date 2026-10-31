import { useRef, useState } from "react";
import type { NormalizedRegion } from "@/services/productShots";
import { cn } from "@/lib/utils";

type Props = {
  imageUrl: string;
  value: NormalizedRegion | null;
  onChange: (region: NormalizedRegion | null) => void;
  className?: string;
};

const MIN_SIZE = 0.03;
const TAP_SIZE = 0.2;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * 원본 이미지에서 확대할 부분을 고른다. 드래그하면 그 사각형, 한 번 누르면 그 지점 중심의 정사각형(이미지 폭의 20%).
 * 좌표는 이미지 기준 0~1 비율이라 화면 크기와 무관하게 서버가 같은 부분을 잘라낸다.
 */
export const RegionSelector = ({ imageUrl, value, onChange, className }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [aspect, setAspect] = useState(1);

  const pointFrom = (event: React.PointerEvent) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  };

  const finish = () => {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const width = Math.abs(drag.x1 - drag.x0);
    const height = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (width < MIN_SIZE || height < MIN_SIZE) {
      // 탭/클릭: 그 지점 중심의 정사각형(이미지 비율 보정)
      const w = TAP_SIZE;
      const h = Math.min(1, TAP_SIZE * aspect);
      onChange({
        x: clamp(Math.min(1 - w, drag.x0 - w / 2)),
        y: clamp(Math.min(1 - h, drag.y0 - h / 2)),
        width: w,
        height: h,
      });
      return;
    }
    onChange({ x, y, width, height });
  };

  const shown = drag
    ? { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) }
    : value;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={frameRef}
        className="relative mx-auto w-full max-w-[560px] cursor-crosshair touch-none select-none overflow-hidden rounded-md border border-stone-200 bg-[#f2efeb]"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointFrom(event);
          setDrag({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
        }}
        onPointerMove={(event) => {
          if (!drag) return;
          const point = pointFrom(event);
          setDrag((current) => (current ? { ...current, x1: point.x, y1: point.y } : current));
        }}
        onPointerUp={finish}
        onPointerCancel={() => setDrag(null)}
        role="application"
        aria-label="확대할 영역을 드래그하거나 눌러서 선택"
      >
        <img
          src={imageUrl}
          alt="원본 디자인"
          className="block h-auto w-full"
          draggable={false}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalHeight) setAspect(image.naturalWidth / image.naturalHeight);
          }}
        />
        {shown && (
          <div
            className="pointer-events-none absolute border-2 border-brand shadow-[0_0_0_9999px_rgba(0,0,0,0.38)]"
            style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.width * 100}%`, height: `${shown.height * 100}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-[12px] text-stone-500">
        <span>{value ? "선택한 영역을 확대 컷으로 만듭니다." : "확대하고 싶은 부분을 드래그하거나 눌러주세요. 예: 가슴 로고"}</span>
        {value && (
          <button type="button" className="shrink-0 font-semibold text-brand underline-offset-2 hover:underline" onClick={() => onChange(null)}>
            선택 해제
          </button>
        )}
      </div>
    </div>
  );
};
