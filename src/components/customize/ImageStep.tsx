
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageOff, Maximize2 } from "lucide-react";
import { useState, useEffect } from "react";

interface ImageStepProps {
  isLoading: boolean;
  generatedImageUrls: string[] | null;
  selectedImageIndex: number;
  storedImageUrls?: string[] | null;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  selectedStyle?: string;
  selectedColor?: string;
  selectedPocket?: string;
  selectedFit?: string;
  onGenerateImage: () => void;
}

export const ImageStep = ({
  isLoading,
  generatedImageUrls,
  selectedImageIndex,
  storedImageUrls,
  selectedType,
  selectedMaterial,
  selectedDetail,
  selectedStyle,
  selectedColor,
  selectedPocket,
  selectedFit,
  onGenerateImage,
}: ImageStepProps) => {
  const [imageErrors, setImageErrors] = useState<boolean[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Reset error state when image URLs array changes
  useEffect(() => {
    if (generatedImageUrls) {
      setImageErrors(new Array(generatedImageUrls.length).fill(false));
    } else {
      setImageErrors([]);
    }
  }, [generatedImageUrls]);
  
  return (
    <>
    <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="border-0 bg-transparent p-0 shadow-none sm:border sm:bg-card sm:p-6 sm:shadow-sm">
        <div className="space-y-4">
          <div className="px-1 sm:px-0">
            <h3 className="text-[17px] font-semibold sm:text-lg">이미지 생성 결과</h3>
            <p className="mt-1.5 text-[14px] leading-6 text-gray-500 sm:text-sm">
              선택하신 옵션을 바탕으로 AI가 의상 이미지를 생성합니다. 다음 단계에서 디테일하게 디자인을 수정할 수 있습니다.
            </p>
          </div>
          
          {isLoading && !generatedImageUrls ? (
            <div className="flex min-h-[520px] w-full items-center justify-center rounded-2xl bg-gray-100 sm:min-h-[660px]">
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                <p className="text-[14px] text-gray-500">이미지 생성 중...</p>
              </div>
            </div>
          ) : generatedImageUrls && generatedImageUrls.length > 0 ? (
            <div className="space-y-4">
              <div className={`grid gap-4 ${
                generatedImageUrls.length > 1
                  ? "grid-cols-1 2xl:grid-cols-2"
                  : "grid-cols-1"
              }`}>
                {generatedImageUrls.map((imageUrl, index) => {
                  const resolvedImageUrl =
                    storedImageUrls && storedImageUrls[index]
                      ? storedImageUrls[index]
                      : imageUrl;

                  return (
                  <div
                    key={index}
                    className="relative overflow-hidden rounded-[1.35rem] border border-gray-200 bg-[#f2efeb] shadow-[0_18px_55px_rgba(36,26,24,0.08)] transition-all sm:rounded-2xl"
                  >
                    {!imageErrors[index] ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(resolvedImageUrl)}
                        className="group relative flex min-h-[520px] w-full cursor-zoom-in items-center justify-center sm:min-h-[680px] lg:min-h-[820px]"
                        aria-label={`생성된 의류 디자인 ${index + 1} 크게 보기`}
                      >
                        <img
                          src={resolvedImageUrl}
                          alt={`Generated clothing design ${index + 1}`}
                          className="absolute inset-0 h-full w-full scale-[1.06] object-contain object-center sm:scale-100"
                          onLoad={() => console.log(`Image ${index + 1} loaded successfully`)}
                          onError={() => {
                            console.error(`Image ${index + 1} loading error:`, imageUrl);
                            setImageErrors(prev => {
                              const newErrors = [...prev];
                              newErrors[index] = true;
                              return newErrors;
                            });
                          }}
                        />
                        <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/72 px-3.5 py-2 text-[12px] font-bold text-white shadow-lg backdrop-blur transition sm:bottom-4 sm:right-4 sm:px-4 sm:text-xs sm:opacity-0 sm:group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4" />
                          전체 화면
                        </span>
                        {selectedImageIndex === index && (
                          <span className="absolute right-3 top-3 rounded-full bg-brand px-3 py-1.5 text-[12px] font-bold text-white shadow-md sm:right-4 sm:top-4 sm:text-xs">
                            선택됨
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex min-h-[520px] w-full flex-col items-center justify-center bg-gray-100 sm:min-h-[680px] lg:min-h-[820px]">
                        <ImageOff className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <p className="px-1 text-center text-[13px] leading-5 text-stone-500 sm:hidden">
                이미지를 누르면 화면 전체로 더 크게 확인할 수 있어요.
              </p>
              
              <Button 
                onClick={onGenerateImage}
                variant="outline"
                className="h-12 w-full rounded-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand mr-2"></span>
                    이미지 생성 중...
                  </>
                ) : "이미지 다시 생성하기"}
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[520px] w-full items-center justify-center rounded-2xl bg-gray-100 sm:min-h-[660px]">
              <div className="flex flex-col items-center">
                <Button 
                  onClick={onGenerateImage}
                  className="h-12 rounded-full bg-brand px-7 hover:bg-brand-dark"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                      이미지 생성 중...
                    </>
                  ) : "이미지 생성하기"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="h-fit rounded-2xl p-4 sm:p-6 xl:sticky xl:top-28">
        <div className="space-y-4">
          <h3 className="text-[17px] font-semibold sm:text-lg">선택한 옵션</h3>
          <div className="space-y-2">
            <div className="flex justify-between gap-4 text-[14px] sm:text-sm">
              <span className="text-gray-600">의류 종류:</span>
              <span className="text-right font-medium">{selectedType || "-"}</span>
            </div>
            <div className="flex justify-between gap-4 text-[14px] sm:text-sm">
              <span className="text-gray-600">소재:</span>
              <span className="text-right font-medium">{selectedMaterial || "-"}</span>
            </div>
            
            <div className="pt-2 border-t">
              <span className="text-[14px] text-gray-600 sm:text-sm">상세 설명:</span>
              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-6 sm:text-sm">{selectedDetail || "-"}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
    <Dialog
      open={Boolean(previewImageUrl)}
      onOpenChange={(open) => {
        if (!open) setPreviewImageUrl(null);
      }}
    >
      <DialogContent className="h-[100dvh] w-screen max-w-none rounded-none border-white/15 bg-black p-0 sm:h-[94vh] sm:w-[96vw] sm:max-w-[96vw] sm:rounded-2xl sm:p-3">
        <DialogTitle className="sr-only">생성된 의류 디자인 크게 보기</DialogTitle>
        {previewImageUrl && (
          <img
            src={previewImageUrl}
            alt="생성된 의류 디자인 원본 크기 미리보기"
            className="h-full w-full scale-[1.1] object-contain p-2 sm:scale-100 sm:p-0"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};
