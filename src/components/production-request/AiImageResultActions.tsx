import { Download, Factory, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onRegenerate: () => void;
  onDownload: () => void;
  onRequestProduction: () => void;
  isRegenerating?: boolean;
  isDownloading?: boolean;
  isPreparingRequest?: boolean;
  disabled?: boolean;
  className?: string;
  /** 안내 튜토리얼이 가리키는 '다시 생성' 버튼 표식 */
  regenerateTutorialId?: string;
};

/**
 * AI 의류 이미지 생성 완료 화면의 하단 버튼: 이미지 다시 생성 · 이미지 다운로드 · 제작의뢰하기.
 * '제작의뢰하기'는 브랜드 컬러(버건디)로 가장 눈에 띄게 둔다(모바일은 맨 위 전체 폭, PC 는 오른쪽 끝).
 */
export const AiImageResultActions = ({
  onRegenerate, onDownload, onRequestProduction, isRegenerating, isDownloading, isPreparingRequest, disabled, className, regenerateTutorialId,
}: Props) => (
  <div className={cn("w-full rounded-lg border border-black/[0.07] bg-white p-3 sm:p-4", className)} data-testid="ai-image-result-actions">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.35fr]">
      <Button
        type="button"
        onClick={onRequestProduction}
        disabled={disabled || isPreparingRequest}
        className="order-first col-span-2 h-[52px] rounded-[3px] bg-brand text-[15px] font-bold shadow-[0_10px_24px_rgba(116,27,43,0.22)] hover:bg-brand-dark sm:order-last sm:col-span-1"
        data-testid="request-production"
      >
        {isPreparingRequest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Factory className="mr-2 h-4 w-4" />}
        제작의뢰하기
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onRegenerate}
        disabled={disabled || isRegenerating}
        className="h-[52px] rounded-[3px] border-stone-300 text-[14px] font-bold"
        data-testid="regenerate-image"
        data-tutorial={regenerateTutorialId}
      >
        {isRegenerating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
        이미지 다시 생성
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onDownload}
        disabled={disabled || isDownloading}
        className="h-[52px] rounded-[3px] border-stone-300 text-[14px] font-bold"
        data-testid="download-design"
      >
        {isDownloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
        이미지 다운로드
      </Button>
    </div>
    <p className="mt-2.5 text-center text-[12px] leading-5 text-stone-500">
      마음에 드는 디자인은 <span className="font-bold text-brand">제작의뢰하기</span>로 실제 제작 상담과 견적을 받아보세요.
    </p>
  </div>
);
