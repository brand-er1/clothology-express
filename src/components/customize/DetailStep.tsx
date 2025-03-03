
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";

interface DetailStepProps {
  detailInput: string;
  selectedStyle: string;
  selectedPocket: string;
  selectedColor: string;
  selectedFit?: string;
  onDetailInputChange: (value: string) => void;
  onStyleSelect: (value: string) => void;
  onPocketSelect: (value: string) => void;
  onColorSelect: (value: string) => void;
  onFitSelect?: (value: string) => void;
}

type StyleOption = {
  value: string;
  label: string;
};

type PocketOption = {
  value: string;
  label: string;
};

type ColorOption = {
  value: string;
  hex: string;
  label: string;
};

const styleOptions: StyleOption[] = [
  { value: "casual", label: "캐주얼" },
  { value: "formal", label: "포멀" },
  { value: "street", label: "스트릿" },
  { value: "modern", label: "모던" },
];

const pocketOptions: PocketOption[] = [
  { value: "none", label: "없음" },
  { value: "one-chest", label: "가슴 포켓 1개" },
  { value: "two-side", label: "사이드 포켓 2개" },
  { value: "multiple", label: "멀티 포켓" },
];

const colorOptions: ColorOption[] = [
  { value: "black", label: "검정", hex: "#000000" },
  { value: "white", label: "흰색", hex: "#FFFFFF" },
  { value: "navy", label: "네이비", hex: "#000080" },
  { value: "gray", label: "회색", hex: "#808080" },
];

type FitOption = {
  value: string;
  label: string;
};

const fitOptions: FitOption[] = [
  { value: "loose", label: "루즈핏" },
  { value: "regular", label: "레귤러핏" },
  { value: "slim", label: "슬림핏" },
  { value: "oversized", label: "오버사이즈" },
];

export const DetailStep = ({
  detailInput,
  selectedStyle,
  selectedPocket,
  selectedColor,
  selectedFit = "",
  onDetailInputChange,
  onStyleSelect,
  onPocketSelect,
  onColorSelect,
  onFitSelect = () => {},
}: DetailStepProps) => {
  // 이전에 옵션을 통해 생성된 텍스트를 추적하기 위한 상태
  const [prevOptionText, setPrevOptionText] = useState<string>("");
  
  // 사용자가 직접 추가한 커스텀 텍스트만 추출
  const extractCustomText = (fullText: string, optionText: string): string => {
    if (!optionText) return fullText;
    
    // 옵션 텍스트 줄들을 배열로 분리
    const optionLines = optionText.split('\n').filter(Boolean);
    
    // 전체 텍스트에서 옵션 텍스트 줄들을 제거
    let customText = fullText;
    optionLines.forEach(line => {
      customText = customText.replace(line, '');
    });
    
    // 빈 줄 정리
    return customText.split('\n').filter(Boolean).join('\n');
  };
  
  // 선택된 옵션들을 문자열로 변환
  const generateDetailText = () => {
    const details = [];
    
    if (selectedStyle) {
      const style = styleOptions.find(s => s.value === selectedStyle);
      if (style) details.push(`스타일: ${style.label}`);
    }
    
    if (selectedPocket) {
      const pocket = pocketOptions.find(p => p.value === selectedPocket);
      if (pocket) details.push(`포켓: ${pocket.label}`);
    }
    
    if (selectedColor) {
      const color = colorOptions.find(c => c.value === selectedColor);
      if (color) details.push(`색상: ${color.label}`);
    }

    if (selectedFit) {
      const fit = fitOptions.find(f => f.value === selectedFit);
      if (fit) details.push(`핏: ${fit.label}`);
    }

    return details.join('\n');
  };

  // 옵션이 변경될 때마다 텍스트 업데이트
  useEffect(() => {
    const newOptionText = generateDetailText();
    
    // 기존 사용자 입력 텍스트만 유지 (옵션 관련 텍스트는 제거)
    const customText = extractCustomText(detailInput, prevOptionText);
    
    // 새 옵션 텍스트와 커스텀 텍스트 결합
    const finalText = [newOptionText, customText].filter(Boolean).join('\n\n');
    
    // 이전 옵션 텍스트 업데이트
    setPrevOptionText(newOptionText);
    
    onDetailInputChange(finalText.trim());
  }, [selectedStyle, selectedPocket, selectedColor, selectedFit]);

  return (
    <div className="space-y-8">
      {/* Detail Input Area */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              추가적인 디테일을 더 입력하세요. 아래 옵션들을 선택하거나 직접 입력할 수 있습니다.
            </p>
            <textarea
              value={detailInput}
              onChange={(e) => onDetailInputChange(e.target.value)}
              placeholder="추가 디테일을 자유롭게 입력해주세요"
              className="w-full h-32 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>
      </Card>

      {/* Detail Options */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Style Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">스타일</h3>
          <Select value={selectedStyle} onValueChange={onStyleSelect}>
            <SelectTrigger>
              <SelectValue placeholder="스타일 선택" />
            </SelectTrigger>
            <SelectContent>
              {styleOptions.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Fit Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">핏</h3>
          <Select value={selectedFit} onValueChange={onFitSelect}>
            <SelectTrigger>
              <SelectValue placeholder="핏 선택" />
            </SelectTrigger>
            <SelectContent>
              {fitOptions.map((fit) => (
                <SelectItem key={fit.value} value={fit.value}>
                  {fit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Pocket Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">포켓</h3>
          <Select value={selectedPocket} onValueChange={onPocketSelect}>
            <SelectTrigger>
              <SelectValue placeholder="포켓 선택" />
            </SelectTrigger>
            <SelectContent>
              {pocketOptions.map((pocket) => (
                <SelectItem key={pocket.value} value={pocket.value}>
                  {pocket.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Color Selection */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">색상</h3>
          <Select value={selectedColor} onValueChange={onColorSelect}>
            <SelectTrigger>
              <SelectValue placeholder="색상 선택" />
            </SelectTrigger>
            <SelectContent>
              {colorOptions.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span>{color.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      </div>
    </div>
  );
};
