
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
}: UseDetailTextProps) => {
  // 이전 옵션 텍스트를 추적하는 객체를 생성
  const [prevOptions, setPrevOptions] = useState({
    style: "",
    pocket: "",
    color: "",
    fit: ""
  });
  
  // 사용자가 직접 입력한 텍스트만 추출
  const [customUserText, setCustomUserText] = useState("");
  
  // 옵션 텍스트에서 옵션 레이블만 제거하고 사용자 입력 텍스트 유지
  const removeOptionText = (fullText: string, optionPrefix: string, optionValue: string): string => {
    if (!optionValue) return fullText;
    
    // "옵션명: 값" 형태의 텍스트를 찾아 제거
    const pattern = new RegExp(`${optionPrefix}\\s*:\\s*${optionValue}`, 'g');
    return fullText.replace(pattern, '').trim();
  };
  
  // 선택된 옵션들을 문자열로 생성
  const generateOptionsText = () => {
    const optionLines = [];
    
    if (selectedStyle) {
      const style = styleOptions.find(s => s.value === selectedStyle);
      if (style) optionLines.push(`스타일: ${style.label}`);
    }
    
    if (selectedPocket) {
      const pocket = pocketOptions.find(p => p.value === selectedPocket);
      if (pocket) optionLines.push(`포켓: ${pocket.label}`);
    }
    
    if (selectedColor) {
      const color = colorOptions.find(c => c.value === selectedColor);
      if (color) optionLines.push(`색상: ${color.label}`);
    }

    if (selectedFit) {
      const fit = fitOptions.find(f => f.value === selectedFit);
      if (fit) optionLines.push(`핏: ${fit.label}`);
    }

    return optionLines.join('\n');
  };

  // 처음 컴포넌트가 로드될 때 기존 텍스트에서 사용자 입력 부분만 추출
  useEffect(() => {
    let userText = detailInput;
    
    // 각 옵션별 텍스트 제거
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
    userText = userText.split('\n').filter(line => line.trim() !== '').join('\n');
    
    setCustomUserText(userText);
    
    // 초기 옵션 상태 설정
    const initialStyle = styleOptions.find(s => s.value === selectedStyle)?.label || "";
    const initialPocket = pocketOptions.find(p => p.value === selectedPocket)?.label || "";
    const initialColor = colorOptions.find(c => c.value === selectedColor)?.label || "";
    const initialFit = fitOptions.find(f => f.value === selectedFit)?.label || "";
    
    setPrevOptions({
      style: initialStyle,
      pocket: initialPocket,
      color: initialColor,
      fit: initialFit
    });
  }, []);

  // 옵션 변경 시 텍스트 업데이트
  useEffect(() => {
    // 현재 옵션에 대한 텍스트 생성
    const optionsText = generateOptionsText();
    
    // 옵션 텍스트와 사용자 텍스트 결합
    const combinedText = [optionsText, customUserText]
      .filter(text => text.trim() !== '')
      .join('\n\n');
    
    // 최종 텍스트 업데이트
    onDetailInputChange(combinedText.trim());
    
    // 현재 옵션 상태 업데이트
    const currentStyle = styleOptions.find(s => s.value === selectedStyle)?.label || "";
    const currentPocket = pocketOptions.find(p => p.value === selectedPocket)?.label || "";
    const currentColor = colorOptions.find(c => c.value === selectedColor)?.label || "";
    const currentFit = fitOptions.find(f => f.value === selectedFit)?.label || "";
    
    setPrevOptions({
      style: currentStyle,
      pocket: currentPocket,
      color: currentColor,
      fit: currentFit
    });
  }, [selectedStyle, selectedPocket, selectedColor, selectedFit]);

  // 사용자가 텍스트 영역을 직접 편집할 때
  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    
    // 옵션 라인을 제외한 사용자 입력 텍스트만 업데이트
    let userText = newText;
    
    // 각 옵션별 텍스트 제거
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
    userText = userText.split('\n').filter(line => line.trim() !== '').join('\n');
    
    setCustomUserText(userText);
    
    // 텍스트 영역의 전체 값을 그대로 설정 (옵션 + 사용자 텍스트)
    onDetailInputChange(newText);
  };

  return {
    handleTextAreaChange
  };
};
