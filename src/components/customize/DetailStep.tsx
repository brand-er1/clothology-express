
import { useDetailText } from "./detail/useDetailText";
import { DetailInput } from "./detail/DetailInput";
import { StyleSelect } from "./detail/StyleSelect";
import { FitSelect } from "./detail/FitSelect";
import { PocketSelect } from "./detail/PocketSelect";
import { ColorSelect } from "./detail/ColorSelect";
import { TextureSelect } from "./detail/TextureSelect";
import { ElasticitySelect } from "./detail/ElasticitySelect";
import { TransparencySelect } from "./detail/TransparencySelect";
import { ThicknessSelect } from "./detail/ThicknessSelect";
import { SeasonSelect } from "./detail/SeasonSelect";
import { 
  styleOptions, 
  pocketOptions, 
  colorOptions, 
  fitOptions,
  textureOptions,
  elasticityOptions,
  transparencyOptions,
  thicknessOptions,
  seasonOptions
} from "@/lib/customize-constants";

interface DetailStepProps {
  detailInput: string;
  selectedStyle: string;
  selectedPocket: string;
  selectedColor: string;
  selectedFit?: string;
  selectedTexture?: string;
  selectedElasticity?: string;
  selectedTransparency?: string;
  selectedThickness?: string;
  selectedSeason?: string;
  onDetailInputChange: (value: string) => void;
  onStyleSelect: (value: string) => void;
  onPocketSelect: (value: string) => void;
  onColorSelect: (value: string) => void;
  onFitSelect?: (value: string) => void;
  onTextureSelect?: (value: string) => void;
  onElasticitySelect?: (value: string) => void;
  onTransparencySelect?: (value: string) => void;
  onThicknessSelect?: (value: string) => void;
  onSeasonSelect?: (value: string) => void;
}

export const DetailStep = ({
  detailInput,
  selectedStyle,
  selectedPocket,
  selectedColor,
  selectedFit = "",
  selectedTexture = "",
  selectedElasticity = "",
  selectedTransparency = "",
  selectedThickness = "",
  selectedSeason = "",
  onDetailInputChange,
  onStyleSelect,
  onPocketSelect,
  onColorSelect,
  onFitSelect = () => {},
  onTextureSelect = () => {},
  onElasticitySelect = () => {},
  onTransparencySelect = () => {},
  onThicknessSelect = () => {},
  onSeasonSelect = () => {},
}: DetailStepProps) => {
  const { handleTextAreaChange } = useDetailText({
    detailInput,
    selectedStyle,
    selectedPocket,
    selectedColor,
    selectedFit,
    selectedTexture,
    selectedElasticity,
    selectedTransparency,
    selectedThickness,
    selectedSeason,
    styleOptions,
    pocketOptions,
    colorOptions,
    fitOptions,
    textureOptions,
    elasticityOptions,
    transparencyOptions,
    thicknessOptions,
    seasonOptions,
    onDetailInputChange,
  });

  return (
    <div className="space-y-8">
      {/* Detail Input Area */}
      <DetailInput 
        detailInput={detailInput} 
        onChange={handleTextAreaChange} 
      />

      {/* Detail Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* First Row */}
        <StyleSelect 
          selectedStyle={selectedStyle} 
          styleOptions={styleOptions} 
          onStyleSelect={onStyleSelect} 
        />
        <FitSelect 
          selectedFit={selectedFit} 
          fitOptions={fitOptions} 
          onFitSelect={onFitSelect} 
        />
        <PocketSelect 
          selectedPocket={selectedPocket} 
          pocketOptions={pocketOptions} 
          onPocketSelect={onPocketSelect} 
        />
        
        {/* Second Row */}
        <ColorSelect 
          selectedColor={selectedColor} 
          colorOptions={colorOptions} 
          onColorSelect={onColorSelect} 
        />
        <TextureSelect
          selectedTexture={selectedTexture}
          textureOptions={textureOptions}
          onTextureSelect={onTextureSelect}
        />
        <ElasticitySelect
          selectedElasticity={selectedElasticity}
          elasticityOptions={elasticityOptions}
          onElasticitySelect={onElasticitySelect}
        />
        
        {/* Third Row */}
        <TransparencySelect
          selectedTransparency={selectedTransparency}
          transparencyOptions={transparencyOptions}
          onTransparencySelect={onTransparencySelect}
        />
        <ThicknessSelect
          selectedThickness={selectedThickness}
          thicknessOptions={thicknessOptions}
          onThicknessSelect={onThicknessSelect}
        />
        <SeasonSelect
          selectedSeason={selectedSeason}
          seasonOptions={seasonOptions}
          onSeasonSelect={onSeasonSelect}
        />
      </div>
    </div>
  );
};
