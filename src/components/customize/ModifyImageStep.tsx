
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ImageOff, Send, RefreshCw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";

interface ModifyImageStepProps {
  isLoading: boolean;
  selectedImageUrl: string | null;
  modificationHistory: Array<{
    prompt: string;
    response: string;
  }>;
  onModifyImage: (prompt: string) => Promise<void>;
  onResetModifications: () => void;
}

export const ModifyImageStep = ({
  isLoading,
  selectedImageUrl,
  modificationHistory,
  onModifyImage,
  onResetModifications,
}: ModifyImageStepProps) => {
  const [modificationPrompt, setModificationPrompt] = useState("");
  const [imageError, setImageError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modificationPrompt.trim()) {
      toast({
        title: "입력 필요",
        description: "수정할 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await onModifyImage(modificationPrompt);
      setModificationPrompt("");
    } catch (error) {
      console.error("Error modifying image:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Image and modification input area - occupies 2/3 of the space */}
      <Card className="p-6 md:col-span-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">이미지 수정</h3>
          <p className="text-sm text-gray-500">
            AI에게 선택한 이미지를 어떻게 수정할지 설명해주세요. 
            디테일, 컬러, 스타일 등 변경하고 싶은 부분을 자세히 설명하세요.
          </p>
          
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-full max-w-md aspect-square border rounded-md overflow-hidden">
              {selectedImageUrl && !imageError ? (
                <img
                  src={selectedImageUrl}
                  alt="Selected clothing design"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                  <ImageOff className="w-12 h-12 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">이미지를 불러올 수 없습니다</p>
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <Textarea
                placeholder="이미지를 어떻게 수정할지 설명해주세요. (예: '소매를 짧게 만들어주세요', '색상을 파란색으로 변경해주세요')"
                value={modificationPrompt}
                onChange={(e) => setModificationPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                disabled={isLoading}
              />
              <div className="flex space-x-2">
                <Button
                  type="submit"
                  className="bg-brand hover:bg-brand-dark flex-1"
                  disabled={isLoading || !modificationPrompt.trim()}
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></span>
                      수정 중...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> 수정하기
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetModifications}
                  disabled={isLoading || modificationHistory.length === 0}
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> 처음으로
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Card>

      {/* Chat history - occupies 1/3 of the space */}
      <Card className="p-6 overflow-hidden flex flex-col">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">수정 내역</h3>
          
          {modificationHistory.length > 0 ? (
            <div className="overflow-y-auto max-h-[500px] flex flex-col space-y-4 pr-2">
              {modificationHistory.map((entry, index) => (
                <div key={index} className="space-y-2">
                  <div className="bg-gray-100 p-3 rounded-lg rounded-br-none">
                    <p className="text-sm font-medium">나</p>
                    <p className="text-sm">{entry.prompt}</p>
                  </div>
                  <div className="bg-brand/10 p-3 rounded-lg rounded-bl-none">
                    <p className="text-sm font-medium">AI</p>
                    <p className="text-sm whitespace-pre-wrap">{entry.response}</p>
                  </div>
                  {index < modificationHistory.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              아직 수정 내역이、 없습니다
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
