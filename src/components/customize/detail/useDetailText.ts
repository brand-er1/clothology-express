
import { useEffect, useRef } from "react";
import { 
  StyleOption, 
  PocketOption, 
  ColorOption, 
  FitOption,
  TextureOption,
  ElasticityOption,
  TransparencyOption,
  ThicknessOption,
  SeasonOption
} from "@/lib/customize-constants";

interface UseDetailTextProps {
  detailInput: string;
  selectedStyle: string;
  selectedPocket: string;
  selectedColor: string;
  selectedFit: string;
  selectedTexture?: string;
  selectedElasticity?: string;
  selectedTransparency?: string;
  selectedThickness?: string;
  selectedSeason?: string;
  styleOptions: StyleOption[];
  pocketOptions: PocketOption[];
  colorOptions: ColorOption[];
  fitOptions: FitOption[];
  textureOptions?: TextureOption[];
  elasticityOptions?: ElasticityOption[];
  transparencyOptions?: TransparencyOption[];
  thicknessOptions?: ThicknessOption[];
  seasonOptions?: SeasonOption[];
  onDetailInputChange: (value: string) => void;
}

export const useDetailText = ({
  detailInput,
  selectedStyle,
  selectedPocket,
  selectedColor,
  selectedFit,
  selectedTexture = "",
  selectedElasticity = "",
  selectedTransparency = "",
  selectedThickness = "",
  selectedSeason = "",
  styleOptions,
  pocketOptions,
  colorOptions,
  fitOptions,
  textureOptions = [],
  elasticityOptions = [],
  transparencyOptions = [],
  thicknessOptions = [],
  seasonOptions = [],
  onDetailInputChange,
}: UseDetailTextProps) => {
  const prevSelections = useRef({
    style: "",
    pocket: "",
    color: "",
    fit: "",
    texture: "",
    elasticity: "",
    transparency: "",
    thickness: "",
    season: "",
  });

  // When dropdown selections change, append a new line once per change; never overwrite or remove.
  useEffect(() => {
    let updatedText = detailInput || "";

    const appendIfChanged = (
      key: keyof typeof prevSelections.current,
      label: string,
      value: string | undefined | null,
      display?: string
    ) => {
      if (!value || !display) {
        // Mark cleared so re-selecting later will append again
        prevSelections.current[key] = "";
        return;
      }
      if (prevSelections.current[key] === value) {
        return;
      }
      const line = `${label}: ${display}`;
      updatedText = updatedText ? `${updatedText}\n${line}` : line;
      prevSelections.current[key] = value;
    };

    const style = styleOptions.find(s => s.value === selectedStyle)?.label;
    const pocket = pocketOptions.find(p => p.value === selectedPocket)?.label;
    const color = colorOptions.find(c => c.value === selectedColor)?.label;
    const fit = fitOptions.find(f => f.value === selectedFit)?.label;
    const texture = textureOptions.find(t => t.value === selectedTexture)?.label;
    const elasticity = elasticityOptions.find(e => e.value === selectedElasticity)?.label;
    const transparency = transparencyOptions.find(t => t.value === selectedTransparency)?.label;
    const thickness = thicknessOptions.find(t => t.value === selectedThickness)?.label;
    const season = seasonOptions.find(s => s.value === selectedSeason)?.label;

    appendIfChanged("style", "스타일", selectedStyle, style);
    appendIfChanged("pocket", "포켓", selectedPocket, pocket);
    appendIfChanged("color", "색상", selectedColor, color);
    appendIfChanged("fit", "핏", selectedFit, fit);
    appendIfChanged("texture", "촉감", selectedTexture, texture);
    appendIfChanged("elasticity", "신축성", selectedElasticity, elasticity);
    appendIfChanged("transparency", "비침", selectedTransparency, transparency);
    appendIfChanged("thickness", "두께", selectedThickness, thickness);
    appendIfChanged("season", "계절", selectedSeason, season);

    if (updatedText !== detailInput) {
      onDetailInputChange(updatedText);
    }
  }, [
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
    detailInput,
    onDetailInputChange,
  ]);

  // Handle manual text area changes
  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    onDetailInputChange(newText);
  };

  return {
    handleTextAreaChange
  };
};
