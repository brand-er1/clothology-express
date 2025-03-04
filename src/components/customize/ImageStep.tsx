
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImageOff } from "lucide-react";
import { useState, useEffect } from "react";

interface ImageStepProps {
  isLoading: boolean;
  generatedImageUrl: string | null;
  storedImageUrl?: string | null;
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
  generatedImageUrl,
  storedImageUrl,
  selectedType,
  selectedMaterial,
  selectedDetail,
  selectedStyle,
  selectedColor,
  selectedPocket,
  selectedFit,
  onGenerateImage,
}: ImageStepProps) => {
  // Prefer stored image URL if available
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  
  // 이미지 URL 처리 로직 개선
  useEffect(() => {
    // 우선순위: 1. storedImageUrl (영구 저장), 2. generatedImageUrl (임시)
    const imageUrl = storedImageUrl || generatedImageUrl;
    setDisplayImageUrl(imageUrl);
    setImageError(false); // 새 URL이 설정되면 에러 상태 초기화
  }, [storedImageUrl, generatedImageUrl]);

  // 이미지가 로드되면 콘솔에 성공 메시지 출력
  const handleImageLoad = () => {
    console.log("Image loaded successfully:", displayImageUrl);
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* 이미지 생성 영역 - 2/3 차지 */}
      <Card className="p-6 md:col-span-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">이미지 생성</h3>
          <p className="text-sm text-gray-500">
            선택하신 옵션을 바탕으로 AI가 의상 이미지를 생성합니다.
          </p>
          <div className="flex flex-col items-center space-y-4">
            <div className="flex justify-center items-center h-[600px] w-full bg-gray-100 rounded-lg">
              {isLoading ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                  <p className="text-sm text-gray-500">이미지 생성 중...</p>
                </div>
              ) : displayImageUrl && !imageError ? (
                <div className="relative w-full h-full">
                  <img
                    src={displayImageUrl}
                    alt="Generated clothing design"
                    className="max-h-full max-w-full object-contain rounded-lg mx-auto"
                    onLoad={handleImageLoad}
                    onError={(e) => {
                      console.error("Image loading error for URL:", displayImageUrl);
                      setImageError(true);
                    }}
                  />
                  {storedImageUrl && !imageError && (
                    <div className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      저장됨
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {imageError ? (
                    <>
                      <ImageOff className="w-12 h-12 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 mb-4">이미지를 불러올 수 없습니다</p>
                    </>
                  ) : null}
                  <Button 
                    onClick={onGenerateImage}
                    className="bg-brand hover:bg-brand-dark"
                  >
                    {imageError ? "이미지 다시 생성하기" : "이미지 생성하기"}
                  </Button>
                </div>
              )}
            </div>
            {displayImageUrl && !isLoading && (
              <Button 
                onClick={() => {
                  setImageError(false);
                  onGenerateImage();
                }}
                variant="outline"
                className="w-full max-w-[200px]"
              >
                다시 생성하기
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 선택한 옵션 요약 - 1/3 차지 */}
      <Card className="p-6">
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
  );
};
