
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";

interface DetailStepProps {
  detailInput: string;
  selectedStyle: string;
  selectedPocket: string;
  selectedColor: string;
  onDetailInputChange: (value: string) => void;
  onStyleSelect: (value: string) => void;
  onPocketSelect: (value: string) => void;
  onColorSelect: (value: string) => void;
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

export const DetailStep = ({
  detailInput,
  selectedStyle,
  selectedPocket,
  selectedColor,
  onDetailInputChange,
  onStyleSelect,
  onPocketSelect,
  onColorSelect,
}: DetailStepProps) => {
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

    return details.join('\n');
  };

  // 옵션이 변경될 때마다 텍스트 업데이트
  useEffect(() => {
    const newDetails = generateDetailText();
    // 기존 수동 입력 텍스트를 보존하고 선택된 옵션들을 추가
    const existingCustomText = detailInput.split('\n').filter(line => 
      !line.startsWith('스타일:') && 
      !line.startsWith('포켓:') && 
      !line.startsWith('색상:')
    ).join('\n');

    const finalText = [newDetails, existingCustomText].filter(Boolean).join('\n\n');
    onDetailInputChange(finalText.trim());
  }, [selectedStyle, selectedPocket, selectedColor]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
