
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
  // Track previous option values to detect changes
  const [prevOptions, setPrevOptions] = useState({
    style: "",
    pocket: "",
    color: "",
    fit: ""
  });
  
  // Store user's custom text separately from options
  const [customUserText, setCustomUserText] = useState("");
  
  // Function to remove option text from the full text
  const removeOptionText = (fullText: string, optionType: string, optionValue: string): string => {
    if (!optionValue) return fullText;
    
    // Pattern to match: "옵션유형: 값" anywhere in the text
    const pattern = new RegExp(`${optionType}\\s*:\\s*${optionValue}(\\s*|$)`, 'g');
    return fullText.replace(pattern, '').trim();
  };
  
  // Generate text for selected options
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

  // Initialize custom user text on component mount
  useEffect(() => {
    let userText = detailInput;
    
    // Extract any custom text by removing all option texts
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
    
    // Clean up line breaks
    userText = userText.split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
    
    setCustomUserText(userText);
    
    // Store initial option values
    setPrevOptions({
      style: styleOptions.find(s => s.value === selectedStyle)?.label || "",
      pocket: pocketOptions.find(p => p.value === selectedPocket)?.label || "",
      color: colorOptions.find(c => c.value === selectedColor)?.label || "",
      fit: fitOptions.find(f => f.value === selectedFit)?.label || ""
    });
  }, []);

  // Update text when options change
  useEffect(() => {
    // Get current option display values
    const currentStyle = styleOptions.find(s => s.value === selectedStyle)?.label || "";
    const currentPocket = pocketOptions.find(p => p.value === selectedPocket)?.label || "";
    const currentColor = colorOptions.find(c => c.value === selectedColor)?.label || "";
    const currentFit = fitOptions.find(f => f.value === selectedFit)?.label || "";
    
    // Skip processing if nothing has changed
    if (
      prevOptions.style === currentStyle && 
      prevOptions.pocket === currentPocket && 
      prevOptions.color === currentColor && 
      prevOptions.fit === currentFit
    ) {
      return;
    }
    
    // Generate the new options text
    const optionsText = generateOptionsText();
    
    // Combine options with custom text
    let finalText = optionsText;
    if (customUserText) {
      finalText = optionsText ? `${optionsText}\n\n${customUserText}` : customUserText;
    }
    
    // Update the detail input
    onDetailInputChange(finalText);
    
    // Update previous option values
    setPrevOptions({
      style: currentStyle,
      pocket: currentPocket,
      color: currentColor,
      fit: currentFit
    });
  }, [selectedStyle, selectedPocket, selectedColor, selectedFit]);

  // Handle manual text area changes
  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    onDetailInputChange(newText);
    
    // Extract custom text excluding option texts
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
    
    // Clean up and store user's custom text
    userText = userText.split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
    
    setCustomUserText(userText);
  };

  return {
    handleTextAreaChange
  };
};
