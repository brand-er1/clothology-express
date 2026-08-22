import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import type { CharacterGender, ClosetGarment, ClosetSlot } from "@/types/closet";

interface ImageRef {
  base64: string;
  mimeType: string;
}

const imageRefCache = new Map<string, Promise<ImageRef>>();
const hatIdentityImage: Record<CharacterGender, string> = {
  male: "/mascot/brand-er-male.png",
  female: "/mascot/brand-er-female.png",
};
const hatPattern = /hat|cap|beanie|bucket|모자|캡|비니|버킷/i;

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

const urlToImageRef = (url: string): Promise<ImageRef> => {
  const cached = imageRefCache.get(url);
  if (cached) return cached;
  const pending = (async () => {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error("이미지를 불러올 수 없습니다.");
    const blob = await response.blob();
    return { base64: await blobToBase64(blob), mimeType: blob.type || "image/png" };
  })();
  imageRefCache.set(url, pending);
  pending.catch(() => imageRefCache.delete(url));
  return pending;
};

const garmentToImageRef = async (garment: ClosetGarment): Promise<ImageRef> => {
  if (garment.designRef?.imageBase64 && garment.designRef.imageMimeType) {
    return { base64: garment.designRef.imageBase64, mimeType: garment.designRef.imageMimeType };
  }
  return urlToImageRef(garment.designRef?.imageUrl || garment.imageUrl);
};

const isHatGarment = (garment: ClosetGarment) =>
  garment.slot === "accessory" && hatPattern.test(`${garment.label} ${garment.designRef?.designContext || ""}`);

export interface DressCharacterResult {
  renderedImageUrl: string;
  renderedImagePath: string | null;
  textResponse: string | null;
}

interface DressCharacterOptions { changedSlots?: ClosetSlot[]; }

export const dressCharacter = async (
  character: CharacterGender,
  characterBaseImageUrl: string,
  garments: ClosetGarment[],
  options: DressCharacterOptions = {},
): Promise<DressCharacterResult | null> => {
  try {
    // Hats always use the explicit canonical gender mascot requested for headwear fitting.
    const effectiveIdentityUrl = garments.some(isHatGarment)
      ? hatIdentityImage[character]
      : characterBaseImageUrl;

    const [identityImage, garmentPayload] = await Promise.all([
      urlToImageRef(effectiveIdentityUrl),
      Promise.all(garments.map(async (garment) => ({
        slot: garment.slot,
        label: garment.label,
        image: await garmentToImageRef(garment),
      }))),
    ]);
    const { data } = await supabase.auth.getSession();
    const { data: result, error } = await supabase.functions.invoke("dress-character", {
      body: {
        characterGender: character,
        characterImage: identityImage,
        identityImage,
        garments: garmentPayload,
        changedSlots: options.changedSlots,
        userId: data.session?.user?.id,
      },
    });
    const identityScore = Number(result?.identityScore);
    if (error || !result?.renderedImageUrl || result?.preservationPassed !== true || !Number.isFinite(identityScore) || identityScore !== 1) {
      console.error("dress-character error:", error, result);
      toast({
        title: "기본 캐릭터를 유지하지 못해 적용하지 않았어요",
        description: "캐릭터가 달라진 결과는 화면에 반영하지 않습니다. 다시 시도해주세요.",
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

/** Edit the garment itself, then the closet re-renders from the untouched canonical mascot. */
export const modifyClosetGarment = async (
  garment: ClosetGarment,
  modificationPrompt: string,
): Promise<ClosetGarment | null> => {
  const imageUrl = garment.designRef?.imageUrl || garment.imageUrl;
  if (!imageUrl || !modificationPrompt.trim()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const { data: result, error } = await supabase.functions.invoke("modify-generated-image", {
      body: {
        imageUrl,
        modificationPrompt: modificationPrompt.trim(),
        userId: data.session?.user?.id,
        clothType: garment.designRef?.selectedType || garment.slot,
        originalPrompt: garment.designRef?.designContext || garment.label,
      },
    });
    if (error || !result?.modifiedImageUrl) {
      console.error("closet garment modification error", error, result);
      toast({ title: "옷 수정에 실패했어요", variant: "destructive" });
      return null;
    }
    imageRefCache.delete(imageUrl);
    return {
      ...garment,
      imageUrl: result.modifiedImageUrl,
      label: `${garment.label} · 수정`,
      designRef: {
        ...garment.designRef,
        imageUrl: result.modifiedImageUrl,
        imagePath: result.modifiedImagePath || garment.designRef?.imagePath || null,
        imageBase64: undefined,
        imageMimeType: undefined,
        designContext: [garment.designRef?.designContext, `수정: ${modificationPrompt.trim()}`].filter(Boolean).join("\n"),
      },
    };
  } catch (error) {
    console.error("closet garment modification request failed", error);
    toast({ title: "옷 수정에 실패했어요", variant: "destructive" });
    return null;
  }
};
