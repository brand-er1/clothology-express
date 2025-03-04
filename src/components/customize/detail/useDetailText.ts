
import { useEffect, useState } from "react";
import { StyleOption, PocketOption, ColorOption, FitOption } from "@/lib/customize-constants";

interface UseDetailTextProps {
  detailInput: string;
  selectedStyle: string;
  selectedPocket: string;
  selectedColor: string;
  selectedFit: string;
  styleOptions: StyleOption[];
  pocketOptions: PocketOption[];
  colorOptions: ColorOption[];
  fitOptions: FitOption[];
  onDetailInputChange: (value: string) => void;
  onStyleSelect: (value: string) => void;
  onPocketSelect: (value: string) => void;
  onColorSelect: (value: string) => void;
  onFitSelect: (value: string) => void;
}

export const useDetailText = ({
  detailInput,
  selectedStyle,
  selectedPocket,
  selectedColor,
  selectedFit,
  styleOptions,
  pocketOptions,
  colorOptions,
  fitOptions,
  onDetailInputChange,
  onStyleSelect,
  onPocketSelect,
  onColorSelect,
  onFitSelect,
}: UseDetailTextProps) => {
  // 이전 옵션 값을 추적하여 변경 사항 감지
  const [prevOptions, setPrevOptions] = useState({
    style: "",
    pocket: "",
    color: "",
    fit: ""
  });
  
  // 사용자의 커스텀 텍스트와 옵션 텍스트를 분리하여 저장
  const [customUserText, setCustomUserText] = useState("");
  
  // 옵션 텍스트를 전체 텍스트에서 제거하는 함수
  const removeOptionText = (fullText: string, optionType: string, optionValue: string): string => {
    if (!optionValue) return fullText;
    
    // 패턴 매칭: 텍스트 어디에나 있는 "옵션유형: 값"
    const pattern = new RegExp(`${optionType}\\s*:\\s*${optionValue}(\\s*|$)`, 'g');
    return fullText.replace(pattern, '').trim();
  };
  
  // 선택된 옵션에 대한 텍스트 생성
  const generateOptionsText = () => {
    const optionLines = [];
    
    if (selectedStyle) {
      const style = styleOptions.find(s => s.value === selectedStyle);
      if (style) {
        optionLines.push(`스타일: ${style.label}`);
      }
    }
    
    if (selectedPocket) {
      const pocket = pocketOptions.find(p => p.value === selectedPocket);
      if (pocket) {
        optionLines.push(`포켓: ${pocket.label}`);
      }
    }
    
    if (selectedColor) {
      const color = colorOptions.find(c => c.value === selectedColor);
      if (color) {
        optionLines.push(`색상: ${color.label}`);
      }
    }

    if (selectedFit) {
      const fit = fitOptions.find(f => f.value === selectedFit);
      if (fit) {
        optionLines.push(`핏: ${fit.label}`);
      }
    }

    return optionLines.join('\n');
  };

  // 텍스트에서 옵션 값 추출하는 함수
  const extractOptionFromText = (text: string, optionType: string, options: any[]): string => {
    // "옵션유형: 값" 형식의 패턴 찾기
    const pattern = new RegExp(`${optionType}\\s*:\\s*([^\\n,]+)`, 'i');
    const match = text.match(pattern);
    
    if (match && match[1]) {
      const value = match[1].trim();
      // 일치하는 옵션 값 찾기
      const option = options.find(opt => opt.label === value);
      return option ? option.value : "";
    }
    
    return "";
  };

  // 컴포넌트 마운트 시 커스텀 사용자 텍스트 초기화
  useEffect(() => {
    let userText = detailInput;
    
    // 모든 옵션 텍스트를 제거하여 커스텀 텍스트 추출
    styleOptions.forEach(style => {
      userText = removeOptionText(userText, "스타일", style.label);
    });
    
    pocketOptions.forEach(pocket => {
      userText = removeOptionText(userText, "포켓", pocket.label);
    });
    
    colorOptions.forEach(color => {
      userText = removeOptionText(userText, "색상", color.label);
    });
    
    fitOptions.forEach(fit => {
      userText = removeOptionText(userText, "핏", fit.label);
    });
    
    // 줄바꿈 정리
    userText = userText.split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
    
    setCustomUserText(userText);
    
    // 초기 옵션 값 저장
    setPrevOptions({
      style: styleOptions.find(s => s.value === selectedStyle)?.label || "",
      pocket: pocketOptions.find(p => p.value === selectedPocket)?.label || "",
      color: colorOptions.find(c => c.value === selectedColor)?.label || "",
      fit: fitOptions.find(f => f.value === selectedFit)?.label || ""
    });
    
    // 텍스트에서 옵션 값 추출하여 선택기 업데이트
    const styleFromText = extractOptionFromText(detailInput, "스타일", styleOptions);
    const pocketFromText = extractOptionFromText(detailInput, "포켓", pocketOptions);
    const colorFromText = extractOptionFromText(detailInput, "색상", colorOptions);
    const fitFromText = extractOptionFromText(detailInput, "핏", fitOptions);
    
    // 텍스트에서 추출한 값으로 선택기 업데이트
    if (styleFromText && styleFromText !== selectedStyle) {
      onStyleSelect(styleFromText);
    }
    
    if (pocketFromText && pocketFromText !== selectedPocket) {
      onPocketSelect(pocketFromText);
    }
    
    if (colorFromText && colorFromText !== selectedColor) {
      onColorSelect(colorFromText);
    }
    
    if (fitFromText && fitFromText !== selectedFit) {
      onFitSelect(fitFromText);
    }
  }, []);

  // 수동 텍스트 영역 변경 처리
  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    onDetailInputChange(newText);
    
    // 텍스트에서 옵션 값 추출하여 선택기 업데이트
    const styleFromText = extractOptionFromText(newText, "스타일", styleOptions);
    const pocketFromText = extractOptionFromText(newText, "포켓", pocketOptions);
    const colorFromText = extractOptionFromText(newText, "색상", colorOptions);
    const fitFromText = extractOptionFromText(newText, "핏", fitOptions);
    
    // 텍스트에서 추출한 값으로 선택기 업데이트
    if (styleFromText !== selectedStyle) {
      onStyleSelect(styleFromText || ""); // 텍스트에서 옵션이 제거되면 선택도 제거
    }
    
    if (pocketFromText !== selectedPocket) {
      onPocketSelect(pocketFromText || "");
    }
    
    if (colorFromText !== selectedColor) {
      onColorSelect(colorFromText || "");
    }
    
    if (fitFromText !== selectedFit) {
      onFitSelect(fitFromText || "");
    }
    
    // 옵션 텍스트를 제외한 사용자 텍스트 추출
    let userText = newText;
    
    styleOptions.forEach(style => {
      userText = removeOptionText(userText, "스타일", style.label);
    });
    
    pocketOptions.forEach(pocket => {
      userText = removeOptionText(userText, "포켓", pocket.label);
    });
    
    colorOptions.forEach(color => {
      userText = removeOptionText(userText, "색상", color.label);
    });
    
    fitOptions.forEach(fit => {
      userText = removeOptionText(userText, "핏", fit.label);
    });
    
    // 줄바꿈 정리 및 사용자 커스텀 텍스트 저장
    userText = userText.split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
    
    setCustomUserText(userText);
  };

  return {
    handleTextAreaChange
  };
};
