import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { garmentToImageRef } from "@/lib/closet-image-ref";
import type { ClosetGarment } from "@/types/closet";

export interface EditGarmentResult {
  editedImageUrl: string;
  editedImagePath: string | null;
  textResponse: string | null;
}

/**
 * EDIT GARMENT (pipeline step B, see edit-closet-garment edge function): sends the garment's
 * CURRENT image plus the user's modification instruction. Never starts a new garment from
 * scratch, and never touches the character — "이 옷으로 입히기" (dress-character) only runs
 * afterwards, once the user is happy with the edited garment image.
 */
export const editGarment = async (
  garment: ClosetGarment,
  modificationPrompt: string,
): Promise<EditGarmentResult | null> => {
  try {
    const baseImage = await garmentToImageRef(garment);
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    const { data: result, error } = await supabase.functions.invoke("edit-closet-garment", {
      body: {
        baseImage,
        modificationPrompt,
        garmentLabel: garment.label,
        userId: user?.id,
      },
    });

    if (error || !result?.editedImageUrl) {
      console.error("edit-closet-garment error:", error, result);
      toast({
        title: "옷을 수정하지 못했어요",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
      return null;
    }

    return {
      editedImageUrl: result.editedImageUrl,
      editedImagePath: result.editedImagePath || null,
      textResponse: result.textResponse || null,
    };
  } catch (error) {
    console.error("edit-closet-garment request failed:", error);
    toast({
      title: "옷을 수정하지 못했어요",
      description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
      variant: "destructive",
    });
    return null;
  }
};
