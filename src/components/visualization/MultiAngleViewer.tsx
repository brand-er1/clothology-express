import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Rotate3D, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useMultiAngleFrames } from "@/hooks/useMultiAngleFrames";
import { RotationViewer } from "@/components/visualization/RotationViewer";
import type { MultiAngleFrame, MultiAngleMode } from "@/services/multiAngle";

interface MultiAngleViewerProps {
  sourceImageUrl: string;
  mode: MultiAngleMode;
  className?: string;
  triggerLabel?: string;
}

const angleLabel = (frame: MultiAngleFrame) => frame.label || `${frame.angle}°`;

export const MultiAngleViewer = ({
  sourceImageUrl,
  mode,
  className = "",
  triggerLabel = "360° 다각면 보기",
}: MultiAngleViewerProps) => {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const { frames, loading, error, ensure } = useMultiAngleFrames(sourceImageUrl, mode);

  useEffect(() => {
    setIndex(0);
  }, [sourceImageUrl, mode]);

  useEffect(() => {
    if (!frames.length) return;
    const frontIndex = frames.findIndex((frame) => frame.angle === 0);
    setIndex(frontIndex >= 0 ? frontIndex : 0);
  }, [frames]);

  useEffect(() => {
    if (error) {
      toast({
        title: "360° 미리보기를 만들지 못했어요",
        description: error,
        variant: "destructive",
      });
    }
  }, [error]);

  const current = frames[index] || null;
  const viewerAlt = mode === "fitting" ? "가상피팅 다각면 AI 미리보기" : "의류 다각면 AI 미리보기";

  const step = (direction: number) => {
    if (!frames.length) return;
    setIndex((value) => (value + direction + frames.length) % frames.length);
  };

  const handleOpen = () => {
    setOpen(true);
    ensure();
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={loading}
        className={`rounded-full border-white/70 bg-white/90 font-bold shadow-md backdrop-blur hover:bg-white ${className}`}
      >
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rotate3D className="mr-1.5 h-4 w-4" />}
        {loading ? "다각면 생성 중" : triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-[#eee9e1] p-0 sm:h-[92vh] sm:w-[min(94vw,900px)] sm:max-w-[900px] sm:rounded-[2rem]">
          <DialogTitle className="sr-only">{viewerAlt}</DialogTitle>
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-stone-200/80 bg-white/70 px-5 py-4 backdrop-blur">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-stone-950">
                  <Rotate3D className="h-4 w-4 text-brand" />
                  AI 360° MULTI-VIEW
                </div>
                <p className="mt-1 text-[11px] leading-4 text-stone-500">
                  좌우로 드래그하거나 버튼을 눌러 각도를 확인하세요. 휠/핀치로 확대할 수 있어요.
                </p>
              </div>
              {current && (
                <span className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-black text-white">
                  {angleLabel(current)}
                </span>
              )}
            </div>

            <div className="relative min-h-0 flex-1 bg-gradient-to-b from-[#f7f3ed] to-[#e9e1d7]">
              {loading && !frames.length ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-stone-800">여러 각도의 이미지를 만들고 있어요</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-stone-500">디자인, 색상, 로고와 피팅 정체성을 고정해 각도별 프레임을 생성합니다.</p>
                </div>
              ) : frames.length ? (
                <>
                  <RotationViewer
                    frames={frames}
                    index={index}
                    onIndexChange={setIndex}
                    fallbackImageUrl={sourceImageUrl}
                    altText={`${viewerAlt} ${current ? angleLabel(current) : ""}`}
                    className="h-full w-full"
                    imgClassName="object-contain p-4 sm:p-8"
                    showAngleBadge={false}
                    hintStorageKey="brander-360-modal-hint-seen"
                  />
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur sm:left-5"
                    aria-label="이전 각도"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur sm:right-5"
                    aria-label="다음 각도"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <Sparkles className="mx-auto h-7 w-7 text-brand" />
                  <p className="mt-3 font-bold text-stone-900">다각면 이미지를 준비하지 못했어요</p>
                  <Button type="button" className="mt-4 rounded-full" onClick={() => ensure()}>
                    다시 생성하기
                  </Button>
                </div>
              )}
            </div>

            {frames.length > 0 && (
              <div className="border-t border-stone-200/80 bg-white px-3 py-3 sm:px-5">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {frames.map((frame, frameIndex) => (
                    <button
                      type="button"
                      key={`${frame.angle}-${frame.imageUrl}`}
                      onClick={() => setIndex(frameIndex)}
                      className={`relative h-16 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-stone-100 transition sm:h-20 sm:w-16 ${
                        frameIndex === index ? "border-brand" : "border-transparent"
                      }`}
                      aria-label={`${angleLabel(frame)} 보기`}
                    >
                      <img src={frame.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[9px] font-bold text-white">
                        {frame.angle}°
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] leading-4 text-stone-400">
                  AI가 기준 이미지를 바탕으로 생성한 각도별 시뮬레이션입니다. 보이지 않는 후면·측면 디테일은 실제 제작물과 다를 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
