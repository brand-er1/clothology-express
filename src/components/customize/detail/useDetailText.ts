
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

  // Remove all instances of a specific option type (e.g., all "스타일: xyz" entries)
  const removeOptionTypeKeywords = (fullText: string, optionType: string): string => {
    const pattern = new RegExp(`${optionType}\\s*:.*?($|\\n)`, 'g');
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

  // Update detail text with current options, removing any old options
  const updateDetailTextWithAllOptions = () => {
    let cleanedText = customUserText;
    
    // Remove all option types from the text
    cleanedText = removeOptionTypeKeywords(cleanedText, "스타일");
    cleanedText = removeOptionTypeKeywords(cleanedText, "포켓");
    cleanedText = removeOptionTypeKeywords(cleanedText, "색상");
    cleanedText = removeOptionTypeKeywords(cleanedText, "핏");
    
    // Clean up line breaks and spaces
    cleanedText = cleanedText.split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');
    
    // Generate new options text
    const optionsText = generateOptionsText();
    
    // Combine options with cleaned custom text
    let finalText = optionsText;
    if (cleanedText) {
      finalText = optionsText ? `${optionsText}\n\n${cleanedText}` : cleanedText;
    }
    
    return finalText;
  };

  // Initialize custom user text on component mount
  useEffect(() => {
    let userText = detailInput;
    
    // Extract any custom text by removing all option texts
    userText = removeOptionTypeKeywords(userText, "스타일");
    userText = removeOptionTypeKeywords(userText, "포켓");
    userText = removeOptionTypeKeywords(userText, "색상");
    userText = removeOptionTypeKeywords(userText, "핏");
    
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
    
    // Update the detail input with all current options
    onDetailInputChange(updateDetailTextWithAllOptions());
    
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
    
    // Remove all options systematically
    userText = removeOptionTypeKeywords(userText, "스타일");
    userText = removeOptionTypeKeywords(userText, "포켓");
    userText = removeOptionTypeKeywords(userText, "색상");
    userText = removeOptionTypeKeywords(userText, "핏");
    
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
