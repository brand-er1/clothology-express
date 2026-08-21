import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import type { CharacterGender, ClosetGarment } from "@/types/closet";

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

/**
 * Calls the dress-character edge function to generate a new image of the base BRAND-ER character
 * actually wearing the given garments — a real AI re-render, never a client-side overlay. Always pass
 * the character's plain base reference image (not a previous render) plus every currently-equipped
 * design garment together, so same-slot swaps replace cleanly and multiple garments render coherently.
 */
export const dressCharacter = async (
  character: CharacterGender,
  characterBaseImageUrl: string,
  garments: ClosetGarment[],
): Promise<DressCharacterResult | null> => {
  try {
    const characterImage = await urlToImageRef(characterBaseImageUrl);
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
        garments: garmentPayload,
        userId: user?.id,
      },
    });

    if (error || !result?.renderedImageUrl) {
      console.error("dress-character error:", error, result);
      toast({
        title: "옷을 입혀보지 못했어요",
        description: "잠시 후 다시 시도해주세요.",
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
