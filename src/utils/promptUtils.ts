
import { clothTypes, styleOptions, pocketOptions, colorOptions, fitOptions } from "@/lib/customize-constants";
import { Material } from "@/types/customize";

/**
 * Builds a generation prompt based on user selections
 */
export const buildGenerationPrompt = (
  selectedType: string,
  selectedMaterial: string,
  selectedStyle: string,
  selectedColor: string,
  selectedPocket: string,
  selectedDetail: string | undefined,
  selectedFit: string,
  materials: Material[]
): string => {
  // Find material by ID, including handling custom materials
  const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || selectedType;
  const selectedMaterialObj = materials.find(material => material.id === selectedMaterial);
  const selectedMaterialName = selectedMaterialObj?.name || selectedMaterial;
  
  const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label || selectedStyle;
  const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label || selectedPocket;
  const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label || selectedColor;
  const selectedFitName = fitOptions.find(fit => fit.value === selectedFit)?.label || selectedFit;

  // Construct the generation prompt
  const prompt = `${selectedColorName} ${selectedMaterialName} ${selectedClothType}, ${selectedStyleName} 스타일, ${selectedFitName}, ` +
    (selectedPocket !== 'none' ? `${selectedPocketName}, ` : '') +
    (selectedDetail ? `${selectedDetail}, ` : '') +
    `인체 없는 의류 사진, 고해상도, 프로덕트 이미지`;

  return prompt;
};

/**
 * Formats detail description for display and storage
 */
export const formatDetailDescription = (
  selectedDetail: string | undefined,
  selectedStyle: string,
  selectedPocket: string,
  selectedColor: string,
  selectedFit: string
): string => {
  // Get option labels for description
  const selectedStyleName = styleOptions.find(style => style.value === selectedStyle)?.label;
  const selectedPocketName = pocketOptions.find(pocket => pocket.value === selectedPocket)?.label;
  const selectedColorName = colorOptions.find(color => color.value === selectedColor)?.label;
  const selectedFitName = fitOptions.find(fit => fit.value === selectedFit)?.label;

  // Create a formatted description with the selections
  let detailDesc = '';
  if (selectedDetail) detailDesc += selectedDetail + '\n';
  if (selectedStyleName) detailDesc += `스타일: ${selectedStyleName}\n`;
  if (selectedPocketName && selectedPocket !== 'none') detailDesc += `포켓: ${selectedPocketName}\n`;
  if (selectedColorName) detailDesc += `색상: ${selectedColorName}\n`;
  if (selectedFitName) detailDesc += `핏: ${selectedFitName}`;
  
  return detailDesc.trim();
};
