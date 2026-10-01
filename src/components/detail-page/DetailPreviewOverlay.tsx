import { useEffect, useRef, useState } from "react";
import { ExternalLink, Monitor, Smartphone, X } from "lucide-react";
import { DetailPageRenderer } from "@/components/detail-page/DetailPageRenderer";
import type { FundingColor } from "@/lib/funding-colors";
import type { DetailFundingStats, DetailPageDocument, DetailPageSource } from "@/types/detailPage";
import { cn } from "@/lib/utils";

type Device = "desktop" | "mobile";
type Mode = "funding" | "page";

const DESKTOP_WIDTH = 1280;
const MOBILE_WIDTH = 390;

type Props = {
  open: boolean;
  onClose: () => void;
  document: DetailPageDocument;
  source: DetailPageSource;
  stats: DetailFundingStats;
  colors: FundingColor[];
  fundingId: string | null;
};

/**
 * 구매자 화면 미리보기. 편집 UI 없이 보여준다.
 * - 펀딩에 연결된 경우: 실제 펀딩 상세 화면(/fundings/:id?preview=draft)을 그대로 띄워 지금 편집본으로 렌더링한다.
 *   iframe 이라 모바일(390px)에서는 실제 모바일 레이아웃(미디어 쿼리)까지 동일하다.
 * - 연결 전: 상세페이지 본문만 같은 렌더러로 보여준다(컨테이너 쿼리라 폭에 맞춰 PC/모바일 레이아웃이 바뀐다).
 */
export const DetailPreviewOverlay = ({ open, onClose, document, source, stats, colors, fundingId }: Props) => {
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<Mode>(fundingId ? "funding" : "page");
  const [frameKey, setFrameKey] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!open) return;
    setFrameKey((key) => key + 1); // 열 때마다 최신 저장본으로 다시 그린다
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !body.current) return;
    const node = body.current;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);

  if (!open) return null;

  const frameWidth = device === "desktop" ? DESKTOP_WIDTH : MOBILE_WIDTH;
  const available = Math.max(0, size.width - (device === "mobile" ? 32 : 0));
  const scale = available > 0 ? Math.min(1, available / frameWidth) : 1;
  const frameHeight = Math.max(320, (size.height - (device === "mobile" ? 32 : 0)) / scale);
  const fundingUrl = fundingId ? `/fundings/${fundingId}?preview=draft` : null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#24201f]" role="dialog" aria-modal="true" aria-label="상세페이지 미리보기">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2.5 text-white sm:px-5">
        <p className="mr-auto text-sm font-bold">
          미리보기 <span className="ml-1 hidden text-xs font-normal text-white/50 sm:inline">구매자에게 보이는 화면 · 편집 도구는 표시되지 않습니다</span>
        </p>
        {fundingId && (
          <div className="flex border border-white/20 text-xs font-semibold" role="group" aria-label="미리보기 범위">
            {(
              [
                ["funding", "펀딩 화면 전체"],
                ["page", "상세페이지만"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn("h-9 px-3", mode === value ? "bg-white text-stone-900" : "text-white/70")}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex border border-white/20 text-xs font-semibold" role="group" aria-label="기기">
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={cn("flex h-9 items-center gap-1.5 px-3", device === "desktop" ? "bg-white text-stone-900" : "text-white/70")}>
            <Monitor className="h-4 w-4" /> Desktop
          </button>
          <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} className={cn("flex h-9 items-center gap-1.5 px-3", device === "mobile" ? "bg-white text-stone-900" : "text-white/70")}>
            <Smartphone className="h-4 w-4" /> Mobile
          </button>
        </div>
        {fundingUrl && (
          <a href={fundingUrl} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-1 px-2 text-xs text-white/70 hover:text-white sm:inline-flex">
            <ExternalLink className="h-4 w-4" /> 새 탭
          </a>
        )}
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center text-white/80 hover:text-white" aria-label="미리보기 닫기">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div ref={body} className={cn("relative min-h-0 flex-1", mode === "page" ? "overflow-y-auto" : "overflow-hidden")}>
        {mode === "funding" && fundingUrl ? (
          <div className={cn("flex h-full justify-center", device === "mobile" && "py-4")}>
            <div style={{ width: frameWidth * scale, height: frameHeight * scale }} className={cn("overflow-hidden bg-white", device === "mobile" && "rounded-[28px] ring-8 ring-black")}>
              <iframe
                key={frameKey}
                title="펀딩 상세 미리보기"
                src={fundingUrl}
                data-testid="preview-frame"
                style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})`, transformOrigin: "0 0" }}
                className="border-0"
              />
            </div>
          </div>
        ) : (
          <div className={cn("mx-auto bg-white", device === "mobile" ? "my-4 max-w-[390px] overflow-hidden rounded-[28px] ring-8 ring-black" : "max-w-[1280px]")} data-testid="preview-page">
            <DetailPageRenderer document={document} source={source} stats={stats} colors={colors} />
          </div>
        )}
      </div>
    </div>
  );
};
