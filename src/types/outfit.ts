import type {
  CharacterGender,
  ClosetSlot,
  FabricInfo,
  FitType,
  GarmentMeasurements,
  MannequinSize,
} from "@/types/closet";

/** One slot's item snapshot inside a saved outfit (see get_outfit_detail / list_public_outfits). */
export interface OutfitItem {
  slot: ClosetSlot;
  garmentId: string | null;
  label: string | null;
  imageUrl: string;
  source: string | null;
  designId: string | null;
  baseSize?: string | null;
  fitType?: FitType | null;
  measurements?: GarmentMeasurements | null;
  fabric?: FabricInfo | null;
  hasMeasurements?: boolean;
  backImageUrl?: string | null;
}

/** Minimal card data for the outfit feed — image / author / title / like count only. */
export interface OutfitCardData {
  id: string;
  title: string;
  imageUrl: string;
  authorName: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  characterGender: CharacterGender;
}

export interface OutfitDetailData {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  authorName: string;
  characterGender: CharacterGender;
  mannequinSize: MannequinSize | null;
  isPublic: boolean;
  likeCount: number;
  likedByMe: boolean;
  isOwner: boolean;
  createdAt: string;
  items: OutfitItem[];
  tags: string[];
}

export interface MyOutfitData {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  isPublic: boolean;
  likeCount: number;
  createdAt: string;
  characterGender: CharacterGender;
  mannequinSize: MannequinSize | null;
  tags: string[];
}
