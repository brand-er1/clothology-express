
export interface Material {
  id: string;
  name: string;
  description: string;
}

export interface CustomMeasurements {
  [key: string]: number;
}

export interface SizeTableItem {
  key: string;
  value: string;
  editable: boolean;
}

export interface UseCustomizeFormState {
  currentStep: number;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  newMaterialName: string;
  materials: Material[];
  isLoading: boolean;
  generatedImageUrl: string | null;
  storedImageUrl: string | null;
  imagePath: string | null;
  selectedSize: string;
  customMeasurements: CustomMeasurements;
  sizeTableData: SizeTableItem[];
}
