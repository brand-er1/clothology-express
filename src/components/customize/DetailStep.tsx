
import { useDetailText } from "./detail/useDetailText";
import { DetailInput } from "./detail/DetailInput";
import { StyleSelect } from "./detail/StyleSelect";
import { FitSelect } from "./detail/FitSelect";
import { PocketSelect } from "./detail/PocketSelect";
import { ColorSelect } from "./detail/ColorSelect";
import { styleOptions, pocketOptions, colorOptions, fitOptions } from "@/lib/customize-constants";

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
  const { handleTextAreaChange, handleOptionSelect } = useDetailText({
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
  });

  return (
    <div className="space-y-8">
      {/* Detail Input Area */}
      <DetailInput 
        detailInput={detailInput} 
        onChange={handleTextAreaChange} 
      />

      {/* Detail Options */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Style Selection */}
        <StyleSelect 
          selectedStyle={selectedStyle} 
          styleOptions={styleOptions} 
          onStyleSelect={(value) => handleOptionSelect('style', value)} 
        />

        {/* Fit Selection */}
        <FitSelect 
          selectedFit={selectedFit} 
          fitOptions={fitOptions} 
          onFitSelect={(value) => handleOptionSelect('fit', value)} 
        />

        {/* Pocket Selection */}
        <PocketSelect 
          selectedPocket={selectedPocket} 
          pocketOptions={pocketOptions} 
          onPocketSelect={(value) => handleOptionSelect('pocket', value)} 
        />

        {/* Color Selection */}
        <ColorSelect 
          selectedColor={selectedColor} 
          colorOptions={colorOptions} 
          onColorSelect={(value) => handleOptionSelect('color', value)} 
        />
      </div>
    </div>
  );
};
