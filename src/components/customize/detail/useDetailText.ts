
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
  // 사용자의 커스텀 텍스트와 옵션 텍스트를 분리하여 저장
  const [customUserText, setCustomUserText] = useState("");
  
  // 모든 옵션 키워드를 제거하는 함수
  const removeAllOptionKeywords = (text: string): string => {
    let result = text;
    
    // 모든 "스타일: XXX" 패턴 제거
    styleOptions.forEach(style => {
      result = result.replace(new RegExp(`스타일\\s*:\\s*${style.label}(\\s*|$)`, 'g'), '');
    });
    
    // 모든 "포켓: XXX" 패턴 제거
    pocketOptions.forEach(pocket => {
      result = result.replace(new RegExp(`포켓\\s*:\\s*${pocket.label}(\\s*|$)`, 'g'), '');
    });
    
    // 모든 "색상: XXX" 패턴 제거
    colorOptions.forEach(color => {
      result = result.replace(new RegExp(`색상\\s*:\\s*${color.label}(\\s*|$)`, 'g'), '');
    });
    
    // 모든 "핏: XXX" 패턴 제거
    fitOptions.forEach(fit => {
      result = result.replace(new RegExp(`핏\\s*:\\s*${fit.label}(\\s*|$)`, 'g'), '');
    });
    
    // 중복 줄바꿈과 공백 정리
    return result.split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .join('\n');
  };
  
  // 특정 옵션 유형에 대한 모든 키워드 제거
  const removeOptionTypeKeywords = (text: string, optionType: string): string => {
    let result = text;
    const pattern = new RegExp(`${optionType}\\s*:\\s*[^\\n,]+(\\s*|$)`, 'g');
    return result.replace(pattern, '').trim();
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

  // 옵션 선택 시 텍스트 영역에 해당 내용 업데이트하는 함수
  const handleOptionSelect = (optionType: 'style' | 'pocket' | 'color' | 'fit', value: string) => {
    // 옵션에 맞는 세터 함수와 옵션 배열 선택
    let optionsArray: any[] = [];
    let setterFunc: (value: string) => void;
    let typeLabel = "";
    
    switch (optionType) {
      case 'style':
        optionsArray = styleOptions;
        setterFunc = onStyleSelect;
        typeLabel = '스타일';
        break;
      case 'pocket':
        optionsArray = pocketOptions;
        setterFunc = onPocketSelect;
        typeLabel = '포켓';
        break;
      case 'color':
        optionsArray = colorOptions;
        setterFunc = onColorSelect;
        typeLabel = '색상';
        break;
      case 'fit':
        optionsArray = fitOptions;
        setterFunc = onFitSelect;
        typeLabel = '핏';
        break;
      default:
        return;
    }
    
    // 선택한 값 업데이트
    setterFunc(value);
    
    // 사용자 텍스트에서 해당 옵션 타입 키워드 제거
    let cleanedText = removeOptionTypeKeywords(detailInput, typeLabel);
    
    // 사용자 커스텀 텍스트 추출 (사용자가 입력한 옵션 관련 내용 외의 텍스트)
    let userOnlyText = customUserText;
    
    // 새로운 옵션이 선택된 경우에만 텍스트 추가
    if (value) {
      const selectedOption = optionsArray.find(option => option.value === value);
      if (selectedOption) {
        const newOptionText = `${typeLabel}: ${selectedOption.label}`;
        
        // 옵션 텍스트와 사용자 텍스트 조합
        const allOptionsText = removeOptionTypeKeywords(generateOptionsText(), typeLabel);
        
        // 최종 텍스트 구성
        cleanedText = [
          userOnlyText.trim(),
          newOptionText,
          allOptionsText
        ].filter(Boolean).join('\n');
      }
    } else {
      // 옵션이 선택 해제된 경우 해당 옵션을 제외한 나머지 옵션 텍스트만 유지
      cleanedText = [
        userOnlyText.trim(),
        generateOptionsText().replace(new RegExp(`${typeLabel}\\s*:[^\\n]*`, 'g'), '').trim()
      ].filter(Boolean).join('\n');
    }
    
    // 중복 줄바꿈 제거 및 정리
    cleanedText = cleanedText.split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
    
    // 텍스트 영역 업데이트
    onDetailInputChange(cleanedText);
  };

  // 컴포넌트 마운트 시 커스텀 사용자 텍스트 초기화
  useEffect(() => {
    // 모든 옵션 텍스트를 제거하여 커스텀 텍스트 추출
    const userText = removeAllOptionKeywords(detailInput);
    setCustomUserText(userText);
    
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
    const userText = removeAllOptionKeywords(newText);
    setCustomUserText(userText);
  };

  return {
    handleTextAreaChange,
    handleOptionSelect
  };
};
