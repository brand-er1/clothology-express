import { Download, Loader2, X, ZoomIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { downloadImage } from "@/lib/download-image";

/** 고객 의뢰 이미지: 클릭하면 전체 화면으로 확대, 원본 다운로드. */
export const ImageLightbox = ({ src, alt, filename, className }: { src: string; alt: string; filename: string; className?: string }) => {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadImage(src, filename);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-lg border border-gray-200 bg-[#f2efeb]"
        aria-label="의뢰 이미지 크게 보기"
        data-testid="request-image-zoom"
      >
        {failed ? (
          <div className="flex h-48 items-center justify-center text-xs text-gray-400">이미지를 불러올 수 없습니다</div>
        ) : (
          <img src={src} alt={alt} onError={() => setFailed(true)} className="h-auto max-h-[420px] w-full object-contain" />
        )}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white opacity-90 transition group-hover:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" /> 확대
        </span>
      </button>
      <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={() => void download()} disabled={downloading} data-testid="request-image-download">
        {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
        원본 이미지 다운로드
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[100dvh] max-h-none w-screen max-w-none rounded-none border-0 bg-black p-0 sm:h-[94vh] sm:w-[94vw] sm:max-w-[94vw] sm:rounded-lg [&>button]:hidden">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img src={src} alt={alt} className="h-full w-full object-contain" data-testid="request-image-full" />
          <div className="absolute right-3 top-3 flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => void download()} disabled={downloading}>
              {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}원본 다운로드
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)} aria-label="닫기"><X className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
