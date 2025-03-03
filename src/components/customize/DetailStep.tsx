
import { Card } from "@/components/ui/card";
import { useEffect } from "react";

interface DetailStepProps {
  detailInput: string;
  onDetailInputChange: (value: string) => void;
}

export const DetailStep = ({
  detailInput,
  onDetailInputChange,
}: DetailStepProps) => {
  return (
    <div className="space-y-8">
      {/* Detail Input Area */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">디테일 정보</h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              원하시는 옷의 디테일을 자유롭게 입력해주세요. 스타일, 핏, 색상, 주머니 형태 등 모든 세부 사항을 포함해 주세요.
            </p>
            <p className="text-sm text-gray-500">
              (예: 검정색 루즈핏 티셔츠, 가슴 포켓 있음, 미니멀한 디자인, 캐주얼 스타일 등)
            </p>
            <textarea
              value={detailInput}
              onChange={(e) => onDetailInputChange(e.target.value)}
              placeholder="원하시는 디테일을 자유롭게 입력해주세요"
              className="w-full h-64 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};
