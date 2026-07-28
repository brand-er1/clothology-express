
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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="p-4 sm:p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">이미지 생성</h3>
          <p className="text-sm text-gray-500">
            선택하신 옵션을 바탕으로 AI가 의상 이미지를 생성합니다. 다음 단계에서 디테일하게 디자인을 수정할 수 있습니다.
          </p>
          
          {isLoading && !generatedImageUrls ? (
            <div className="flex justify-center items-center h-[600px] w-full bg-gray-100 rounded-lg">
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                <p className="text-sm text-gray-500">이미지 생성 중...</p>
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
                    className="relative overflow-hidden rounded-2xl border-2 border-gray-200 bg-gray-50 transition-all"
                  >
                    {!imageErrors[index] ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(resolvedImageUrl)}
                        className="group relative flex min-h-[460px] w-full cursor-zoom-in items-center justify-center sm:min-h-[620px] lg:min-h-[760px]"
                        aria-label={`생성된 의류 디자인 ${index + 1} 크게 보기`}
                      >
                        <img
                          src={resolvedImageUrl}
                          alt={`Generated clothing design ${index + 1}`}
                          className="h-full max-h-[860px] w-full object-contain object-center"
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
                        <span className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white opacity-100 shadow-lg backdrop-blur transition sm:opacity-0 sm:group-hover:opacity-100">
                          <Maximize2 className="h-4 w-4" />
                          크게 보기
                        </span>
                        {selectedImageIndex === index && (
                          <span className="absolute right-4 top-4 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-md">
                            선택됨
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="flex min-h-[460px] w-full flex-col items-center justify-center bg-gray-100 sm:min-h-[620px] lg:min-h-[760px]">
                        <ImageOff className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              
              <Button 
                onClick={onGenerateImage}
                variant="outline"
                className="w-full"
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
            <div className="flex justify-center items-center h-[600px] w-full bg-gray-100 rounded-lg">
              <div className="flex flex-col items-center">
                <Button 
                  onClick={onGenerateImage}
                  className="bg-brand hover:bg-brand-dark"
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

      <Card className="h-fit p-6 xl:sticky xl:top-28">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">선택한 옵션</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">의류 종류:</span>
              <span className="font-medium">{selectedType || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">소재:</span>
              <span className="font-medium">{selectedMaterial || "-"}</span>
            </div>
            
            <div className="pt-2 border-t">
              <span className="text-gray-600">상세 설명:</span>
              <p className="mt-1 text-sm whitespace-pre-wrap">{selectedDetail || "-"}</p>
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
      <DialogContent className="h-[94vh] w-[96vw] max-w-[96vw] border-white/15 bg-black p-3 sm:rounded-2xl">
        <DialogTitle className="sr-only">생성된 의류 디자인 크게 보기</DialogTitle>
        {previewImageUrl && (
          <img
            src={previewImageUrl}
            alt="생성된 의류 디자인 원본 크기 미리보기"
            className="h-full w-full object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
};
