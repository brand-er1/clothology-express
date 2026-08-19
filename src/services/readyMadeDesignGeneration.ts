import { supabase } from "@/lib/supabase";
import { prepareArtworkReference } from "@/lib/artwork-upload";
import type { ArtworkReference } from "@/types/customize";

/**
 * Generates a standalone print graphic (logo/artwork) for the ready-made group wear service,
 * from a plain-language description. Reuses the same `generate-optimized-image` edge function
 * the custom-clothing AI design flow calls (no backend change needed) — only the prompt differs,
 * steering it toward a flat printable graphic instead of a photo of a garment.
 *
 * The result goes through the same `prepareArtworkReference` pipeline an uploaded logo file
 * would (downsizing + background removal for a solid-color background), so an AI-generated
 * design and an uploaded one are indistinguishable to every downstream step (placement preview,
 * trademark screening, order submission).
 */
export const generateReadyMadeDesignGraphic = async (
  description: string,
): Promise<ArtworkReference> => {
  const trimmed = description.trim();
  if (!trimmed) {
    throw new Error("생성할 디자인을 설명해주세요.");
  }

  const prompt = `${trimmed}, 단체복 인쇄용 로고/그래픽 디자인, 옷이나 사람 없이 그래픽 요소만, 배경은 흰색 또는 단색, 벡터 스타일, 고해상도`;

  const { data, error } = await supabase.functions.invoke("generate-optimized-image", {
    body: { prompt },
  });

  if (error) {
    throw new Error(error.message || "디자인 생성에 실패했습니다.");
  }

  const imageUrl: string | undefined =
    data?.storedImageUrls?.[0] || data?.imageUrls?.[0];
  if (!imageUrl) {
    throw new Error("디자인을 생성하지 못했습니다.");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("생성된 디자인 이미지를 불러오지 못했습니다.");
  }
  const blob = await response.blob();
  const file = new File([blob], "ai-generated-design.png", {
    type: blob.type || "image/png",
  });

  return prepareArtworkReference(file, "logo");
};
