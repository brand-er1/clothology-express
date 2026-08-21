import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import type { CharacterGender, ClosetGarment, ClosetSlot } from "@/types/closet";

interface ImageRef {
  base64: string;
  mimeType: string;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("이미지를 변환할 수 없습니다."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("이미지를 변환할 수 없습니다."));
    reader.readAsDataURL(blob);
  });

/** Fetches any http(s) or same-origin image URL and returns it as base64 for the Gemini call. */
const urlToImageRef = async (url: string): Promise<ImageRef> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("이미지를 불러올 수 없습니다.");
  }
  const blob = await response.blob();
  return { base64: await blobToBase64(blob), mimeType: blob.type || "image/png" };
};

const garmentToImageRef = async (garment: ClosetGarment): Promise<ImageRef> => {
  if (garment.designRef?.imageBase64 && garment.designRef.imageMimeType) {
    return { base64: garment.designRef.imageBase64, mimeType: garment.designRef.imageMimeType };
  }
  const sourceUrl = garment.designRef?.imageUrl || garment.imageUrl;
  return urlToImageRef(sourceUrl);
};

export interface DressCharacterResult {
  renderedImageUrl: string;
  renderedImagePath: string | null;
  textResponse: string | null;
}

interface DressCharacterOptions {
  /** The exact currently displayed look. Using it as the edit source keeps every other slot unchanged. */
  editSourceImageUrl?: string | null;
  /** Only these slots may differ from the current look. */
  changedSlots?: ClosetSlot[];
}

/**
 * Calls the dress-character edge function as a fail-closed clothing edit. The canonical base image is
 * always the identity anchor. When an existing render is available it becomes the edit source and only
 * changed slots are sent, so an unchanged top is not regenerated during a bottom swap.
 */
export const dressCharacter = async (
  character: CharacterGender,
  characterBaseImageUrl: string,
  garments: ClosetGarment[],
  options: DressCharacterOptions = {},
): Promise<DressCharacterResult | null> => {
  try {
    const identityImage = await urlToImageRef(characterBaseImageUrl);
    const characterImage = options.editSourceImageUrl
      ? await urlToImageRef(options.editSourceImageUrl)
      : identityImage;
    const garmentPayload = await Promise.all(
      garments.map(async (garment) => ({
        slot: garment.slot,
        label: garment.label,
        image: await garmentToImageRef(garment),
      })),
    );

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    const { data: result, error } = await supabase.functions.invoke("dress-character", {
      body: {
        characterGender: character,
        characterImage,
        identityImage,
        garments: garmentPayload,
        changedSlots: options.changedSlots,
        userId: user?.id,
      },
    });

    const identityScore = Number(result?.identityScore);
    if (
      error ||
      !result?.renderedImageUrl ||
      result?.preservationPassed !== true ||
      !Number.isFinite(identityScore) ||
      identityScore < 0.98
    ) {
      console.error("dress-character error:", error, result);
      toast({
        title: "기존 캐릭터를 그대로 유지했어요",
        description: "조금이라도 달라질 수 있는 생성 결과는 적용하지 않았습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
      return null;
    }

    return {
      renderedImageUrl: result.renderedImageUrl,
      renderedImagePath: result.renderedImagePath || null,
      textResponse: result.textResponse || null,
    };
  } catch (error) {
    console.error("dress-character request failed:", error);
    toast({
      title: "옷을 입혀보지 못했어요",
      description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      variant: "destructive",
    });
    return null;
  }
};
