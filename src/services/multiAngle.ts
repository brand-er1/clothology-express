import { supabase } from "@/lib/supabase";

export type MultiAngleMode = "garment" | "fitting";

export interface MultiAngleFrame {
  angle: number;
  label: string;
  imageUrl: string;
  imagePath?: string | null;
}

export interface MultiAngleResult {
  frames: MultiAngleFrame[];
  sourceImageUrl: string;
  mode: MultiAngleMode;
  isAiGenerated: boolean;
}

// Caches the in-flight/resolved promise (not just the settled result) so two viewers requesting the
// same source image/mode at nearly the same time — e.g. the inline mannequin drag surface and the
// fullscreen modal button — share a single AI generation call instead of racing two.
const sessionCache = new Map<string, Promise<MultiAngleResult>>();

const requestMultiAngle = async (sourceImageUrl: string, mode: MultiAngleMode): Promise<MultiAngleResult> => {
  const { data, error } = await supabase.functions.invoke("generate-multi-angle", {
    body: {
      sourceImageUrl,
      mode,
      angles: [0, 45, 90, 135, 180, 225, 270, 315],
    },
  });

  if (error) throw error;
  if (!data?.frames?.length) {
    throw new Error(data?.error || "다각면 이미지를 생성하지 못했습니다.");
  }

  const result: MultiAngleResult = {
    sourceImageUrl,
    mode,
    isAiGenerated: true,
    frames: data.frames
      .filter((frame: MultiAngleFrame) => frame?.imageUrl && Number.isFinite(frame?.angle))
      .sort((a: MultiAngleFrame, b: MultiAngleFrame) => a.angle - b.angle),
  };

  if (result.frames.length < 4) {
    throw new Error("충분한 각도의 이미지를 생성하지 못했습니다. 다시 시도해주세요.");
  }

  return result;
};

export const generateMultiAngle = (sourceImageUrl: string, mode: MultiAngleMode): Promise<MultiAngleResult> => {
  const cacheKey = `${mode}:${sourceImageUrl}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  const pending = requestMultiAngle(sourceImageUrl, mode).catch((error) => {
    // A failed request must not stick around as a poisoned cache entry — let the next ensure() retry.
    sessionCache.delete(cacheKey);
    throw error;
  });
  sessionCache.set(cacheKey, pending);
  return pending;
};
