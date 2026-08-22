import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { garmentToImageRef, urlToImageRef } from "@/lib/closet-image-ref";
import type { CharacterGender, ClosetGarment, ClosetSlot } from "@/types/closet";

export interface DressCharacterResult {
  renderedImageUrl: string;
  renderedImagePath: string | null;
  textResponse: string | null;
}

interface DressCharacterOptions {
  /** Slots changed by the last user action (all equipped references are still sent). */
  changedSlots?: ClosetSlot[];
}

/**
 * Calls the dress-character edge function as a fail-closed clothing edit. Every request starts from the
 * canonical base image and includes every currently equipped original garment reference. A generated
 * output is deliberately never used as input, which prevents cumulative identity and garment drift.
 */
export const dressCharacter = async (
  character: CharacterGender,
  characterBaseImageUrl: string,
  garments: ClosetGarment[],
  options: DressCharacterOptions = {},
): Promise<DressCharacterResult | null> => {
  try {
    const identityImage = await urlToImageRef(characterBaseImageUrl);
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
        characterImage: identityImage,
        identityImage,
        garments: garmentPayload,
        changedSlots: options.changedSlots,
        userId: user?.id,
      },
    });

    if (error || !result?.renderedImageUrl) {
      console.error("dress-character error:", error, result);
      toast({
        title: "옷 적용을 다시 시도해주세요",
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
