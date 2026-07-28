
import { DetailInput } from "./detail/DetailInput";

interface DetailStepProps {
  detailInput: string;
  selectedType?: string;
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
  selectedType = "",
  onDetailInputChange,
}: DetailStepProps) => {
  const handleTextAreaChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    onDetailInputChange(event.target.value);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <DetailInput
        detailInput={detailInput}
        selectedType={selectedType}
        onChange={handleTextAreaChange}
        onExampleUse={onDetailInputChange}
      />
    </div>
  );
};
