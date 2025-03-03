
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
  selectedStyle: string;
  selectedColor: string;
  selectedPocket: string;
  selectedFit: string;
  selectedDetail: string;
  onGenerateImage: () => void;
}

export const ImageStep = ({
  isLoading,
  generatedImageUrl,
  storedImageUrl,
  selectedType,
  selectedMaterial,
  selectedStyle,
  selectedColor,
  selectedPocket,
  selectedFit,
  selectedDetail,
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
  
  // 선택된 스타일 이름 가져오기
  const getSelectedStyleName = (value: string) => {
    if (!value) return "";
    const styleOptions = [
      { value: "casual", label: "캐주얼" },
      { value: "formal", label: "포멀" },
      { value: "street", label: "스트릿" },
      { value: "modern", label: "모던" },
    ];
    return styleOptions.find(style => style.value === value)?.label || value;
  };

  // 선택된 핏 이름 가져오기
  const getSelectedFitName = (value: string) => {
    if (!value) return "";
    const fitOptions = [
      { value: "loose", label: "루즈핏" },
      { value: "regular", label: "레귤러핏" },
      { value: "slim", label: "슬림핏" },
      { value: "oversized", label: "오버사이즈" },
    ];
    return fitOptions.find(fit => fit.value === value)?.label || value;
  };

  // 선택된 색상 이름 가져오기
  const getSelectedColorName = (value: string) => {
    if (!value) return "";
    const colorOptions = [
      { value: "black", label: "검정" },
      { value: "white", label: "흰색" },
      { value: "navy", label: "네이비" },
      { value: "gray", label: "회색" },
    ];
    return colorOptions.find(color => color.value === value)?.label || value;
  };
  
  // 선택된 주머니 이름 가져오기
  const getSelectedPocketName = (value: string) => {
    if (!value) return "";
    const pocketOptions = [
      { value: "none", label: "없음" },
      { value: "patch", label: "패치 포켓" },
      { value: "welt", label: "웰트 포켓" },
      { value: "flap", label: "플랩 포켓" },
    ];
    return pocketOptions.find(pocket => pocket.value === value)?.label || value;
  };
  
  // 통합된 상세 설명 생성
  const getDetailedDescription = () => {
    let description = selectedDetail || "";
    
    const styleName = getSelectedStyleName(selectedStyle);
    const fitName = getSelectedFitName(selectedFit);
    const colorName = getSelectedColorName(selectedColor);
    const pocketName = getSelectedPocketName(selectedPocket);
    
    const details = [
      styleName && `스타일: ${styleName}`,
      fitName && `핏: ${fitName}`,
      colorName && `색상: ${colorName}`,
      (pocketName && selectedPocket !== 'none') && `포켓: ${pocketName}`
    ].filter(Boolean).join('\n');
    
    if (details && description) {
      return `${description}\n\n${details}`;
    } else if (details) {
      return details;
    } else {
      return description;
    }
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
              <p className="mt-1 text-sm whitespace-pre-wrap">{getDetailedDescription() || "-"}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
