
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ImageStepProps {
  isLoading: boolean;
  generatedImageUrl: string | null;
  storedImageUrl?: string | null;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  onGenerateImage: () => void;
}

export const ImageStep = ({
  isLoading,
  generatedImageUrl,
  storedImageUrl,
  selectedType,
  selectedMaterial,
  selectedDetail,
  onGenerateImage,
}: ImageStepProps) => {
  // Prefer stored image URL if available
  const displayImageUrl = storedImageUrl || generatedImageUrl;
  
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
              ) : displayImageUrl ? (
                <div className="relative w-full h-full">
                  <img
                    src={displayImageUrl}
                    alt="Generated clothing design"
                    className="max-h-full max-w-full object-contain rounded-lg mx-auto"
                    onError={(e) => {
                      console.error("Image loading error:", e);
                      e.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                  {storedImageUrl && (
                    <div className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      저장됨
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={onGenerateImage}
                  className="bg-brand hover:bg-brand-dark"
                >
                  이미지 생성하기
                </Button>
              )}
            </div>
            {displayImageUrl && !isLoading && (
              <Button 
                onClick={onGenerateImage}
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
            {selectedDetail && selectedDetail.trim() && (
              <div className="pt-2 border-t">
                <span className="text-gray-600">추가 디테일:</span>
                <p className="mt-1 text-sm whitespace-pre-wrap">{selectedDetail}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
