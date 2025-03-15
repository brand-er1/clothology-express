
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImageOff } from "lucide-react";
import { useState, useEffect } from "react";

interface ImageStepProps {
  isLoading: boolean;
  generatedImageUrls: string[] | null;
  selectedImageIndex: number;
  storedImageUrl?: string | null;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  selectedStyle?: string;
  selectedColor?: string;
  selectedPocket?: string;
  selectedFit?: string;
  onGenerateImage: () => void;
  onSelectImage: (index: number) => void;
}

export const ImageStep = ({
  isLoading,
  generatedImageUrls,
  selectedImageIndex,
  storedImageUrl,
  selectedType,
  selectedMaterial,
  selectedDetail,
  selectedStyle,
  selectedColor,
  selectedPocket,
  selectedFit,
  onGenerateImage,
  onSelectImage,
}: ImageStepProps) => {
  const [imageErrors, setImageErrors] = useState<boolean[]>([]);
  
  // 이미지 URL 배열이 변경될 때마다 에러 상태 초기화
  useEffect(() => {
    if (generatedImageUrls) {
      setImageErrors(new Array(generatedImageUrls.length).fill(false));
    } else {
      setImageErrors([]);
    }
  }, [generatedImageUrls]);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* 이미지 생성 영역 - 2/3 차지 */}
      <Card className="p-6 md:col-span-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">이미지 생성</h3>
          <p className="text-sm text-gray-500">
            선택하신 옵션을 바탕으로 AI가 의상 이미지를 생성합니다. 마음에 드는 이미지를 선택하세요.
          </p>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-[600px] w-full bg-gray-100 rounded-lg">
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                <p className="text-sm text-gray-500">이미지 생성 중...</p>
              </div>
            </div>
          ) : generatedImageUrls && generatedImageUrls.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {generatedImageUrls.map((imageUrl, index) => (
                  <div 
                    key={index}
                    className={`relative border-2 rounded-lg cursor-pointer overflow-hidden transition-all
                      ${selectedImageIndex === index ? 'border-brand shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => onSelectImage(index)}
                  >
                    {!imageErrors[index] ? (
                      <div className="aspect-square relative">
                        <img
                          src={imageUrl}
                          alt={`Generated clothing design ${index + 1}`}
                          className="w-full h-full object-cover object-center"
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
                        {selectedImageIndex === index && (
                          <div className="absolute top-2 right-2 bg-brand text-white text-xs px-2 py-1 rounded">
                            선택됨
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-100 flex flex-col items-center justify-center">
                        <ImageOff className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={onGenerateImage}
                variant="outline"
                className="w-full"
              >
                이미지 다시 생성하기
              </Button>
            </div>
          ) : (
            <div className="flex justify-center items-center h-[600px] w-full bg-gray-100 rounded-lg">
              <div className="flex flex-col items-center">
                <Button 
                  onClick={onGenerateImage}
                  className="bg-brand hover:bg-brand-dark"
                >
                  이미지 생성하기
                </Button>
              </div>
            </div>
          )}
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
