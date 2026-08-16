
import type {
  DecorationLocation,
  UploadedArtworkAnalysis,
} from "@/types/productionEstimate";

export interface Material {
  id: string;
  name: string;
  description: string;
  badge?: string;
  characteristics?: string[];
  imageUrl?: string;
  isCustom?: boolean;
}

export type ArtworkSize = "small" | "medium" | "large";

export interface ArtworkReference {
  base64: string;
  mimeType: string;
  fileName: string;
  backgroundRemoval?:
    | "removed"
    | "already-transparent"
    | "not-detected"
    | "preserved";
}

export interface CompositedImageReference {
  base64: string;
  mimeType: "image/webp";
  width: number;
  height: number;
}

export interface ArtworkPlacement {
  location: DecorationLocation;
  size: ArtworkSize;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
}

export interface ImageModificationEntry {
  prompt: string;
  response: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  artworkAnalysis?: UploadedArtworkAnalysis | null;
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
  selectedStyle: string;
  selectedPocket: string;
  selectedColor: string;
  selectedFit: string;
  selectedTexture: string;
  selectedElasticity: string;
  selectedTransparency: string;
  selectedThickness: string;
  selectedSeason: string;
  isLoading: boolean;
  generatedImageUrl: string | null;
  storedImageUrl: string | null;
  imagePath: string | null;
  selectedSize: string;
  customMeasurements: CustomMeasurements;
  sizeTableData: SizeTableItem[];
}

export interface OrderCreationResult {
  success: boolean;
  redirectToConfirmation?: boolean;
}
