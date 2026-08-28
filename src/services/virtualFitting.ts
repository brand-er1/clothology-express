import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { garmentToImageRef, urlToImageRef } from "@/lib/closet-image-ref";
import { getFaceReferenceImage, getMannequinPreset } from "@/lib/mannequin-presets";
import { logClosetActivity } from "@/services/closetActivityLog";
import type { CharacterGender, ClosetGarment, ClosetSlot, GarmentFitInfo, MannequinSize } from "@/types/closet";

export interface VirtualFittingResult {
  renderedImageUrl: string;
  renderedImagePath: string | null;
  textResponse: string | null;
  isSimulated: boolean;
  requestId: string | null;
}

interface RunVirtualFittingOptions {
  changedSlots?: ClosetSlot[];
  /** Pass a stable id to make this call idempotent (e.g. re-sent after a timeout). Defaults to a fresh uuid. */
  requestId?: string;
  /** Suppress the default error toast — used by the size-comparison batch runner, which shows its own summary. */
  silent?: boolean;
}

const defaultFitInfo = (): GarmentFitInfo => ({ fitType: "regular", hasMeasurements: false });

/**
 * Calls the virtual-fitting edge function as a fail-closed clothing edit on a fixed gender+size
 * mannequin preset. Every request rebuilds from the canonical mannequin reference plus every
 * currently equipped original garment reference — a generated output is never fed back in as input,
 * which prevents cumulative identity/body-size/garment drift across repeated generations.
 */
export const runVirtualFitting = async (
  gender: CharacterGender,
  mannequinSize: MannequinSize,
  garments: ClosetGarment[],
  options: RunVirtualFittingOptions = {},
): Promise<VirtualFittingResult | null> => {
  try {
    const [mannequinImage, identityImage] = await Promise.all([
      urlToImageRef(getMannequinPreset(gender, mannequinSize).previewImage),
      urlToImageRef(getFaceReferenceImage(gender)),
    ]);

    const garmentPayload = await Promise.all(
      garments.map(async (garment) => ({
        slot: garment.slot,
        label: garment.label,
        image: await garmentToImageRef(garment),
        backImage: garment.backImageUrl ? await urlToImageRef(garment.backImageUrl) : undefined,
        fitInfo: {
          baseSize: garment.fitInfo?.baseSize,
          fitType: garment.fitInfo?.fitType || "regular",
          measurements: garment.fitInfo?.measurements || {},
          fabricStretch: garment.fitInfo?.fabric?.stretch,
          fabricThickness: garment.fitInfo?.fabric?.thickness,
          fabricDrape: garment.fitInfo?.fabric?.drape,
          hasMeasurements: garment.fitInfo?.hasMeasurements ?? false,
        },
      })),
    );

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    const requestId = options.requestId || crypto.randomUUID();

    const { data: result, error } = await supabase.functions.invoke("virtual-fitting", {
      body: {
        requestId,
        gender,
        mannequinSize,
        mannequinImage,
        identityImage,
        garments: garmentPayload,
        changedSlots: options.changedSlots,
        userId: user?.id,
      },
    });

    if (error || !result?.renderedImageUrl) {
      if (result?.processing) return null;
      console.error("virtual-fitting error:", error, result);
      if (!options.silent) {
        toast({
          title: "피팅 생성을 다시 시도해주세요",
          description: "잠시 후 다시 시도해주세요.",
          variant: "destructive",
        });
      }
      return null;
    }

    void logClosetActivity({
      eventType: "character_dressed",
      characterGender: gender,
      slot: options.changedSlots?.[0],
      imageUrl: result.renderedImageUrl,
      imagePath: result.renderedImagePath,
      label: garments.map((garment) => garment.label).join(", ") || "전체 벗기",
      metadata: {
        mannequinSize,
        changedSlots: options.changedSlots || [],
        wornSlots: garments.map((garment) => garment.slot),
        garmentIds: garments.map((garment) => garment.id),
        requestId,
        isSimulated: result.isSimulated,
      },
    });

    return {
      renderedImageUrl: result.renderedImageUrl,
      renderedImagePath: result.renderedImagePath || null,
      textResponse: result.textResponse || null,
      isSimulated: Boolean(result.isSimulated),
      requestId: result.requestId || requestId,
    };
  } catch (error) {
    console.error("virtual-fitting request failed:", error);
    if (!options.silent) {
      toast({
        title: "피팅을 생성하지 못했어요",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    }
    return null;
  }
};

export const garmentHasMeasurements = (garment: ClosetGarment) => Boolean(garment.fitInfo?.hasMeasurements);

export const withDefaultFitInfo = (garment: ClosetGarment): ClosetGarment =>
  garment.fitInfo ? garment : { ...garment, fitInfo: defaultFitInfo() };
