
export interface Material {
  id: string;
  name: string;
  description: string;
}

export interface CustomMeasurements {
  [key: string]: number;
}

export interface UseCustomizeFormState {
  currentStep: number;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  newMaterialName: string;
  materials: Material[];
  selectedStyle: string;
  selectedPocket: string;
  selectedColor: string;
  selectedFit: string;
  isLoading: boolean;
  generatedImageUrl: string | null;
  selectedSize: string;
  customMeasurements: CustomMeasurements;
}

// Adding the missing types needed for sizeRecommendation.ts
export interface SizeRecommendationParams {
  clothingType: string;
  gender: string;
  height?: number;
  weight?: number;
  materials?: string[];
  style?: string;
  fit?: string;
  customMeasurements?: CustomMeasurements;
}

export interface SizeRecommendationResult {
  recommendedSize: string;
  measurements: CustomMeasurements;
  debugInfo?: any;
  clothingType?: string;
  gender?: string;
}
