import { supabase } from "@/lib/supabase";

/**
 * AI 이미지 브랜딩 옵션 · "AI 이미지 수정" 클라이언트.
 * 프롬프트는 서버(_shared/brandingPolicy.ts)에서만 만든다. 화면은 프리셋 이름과 사용자 요청만 보낸다.
 */

/** 브랜드 로고 적용: 기본은 "none"(로고·글자 없는 순수 디자인). "creator" 는 제작자 본인 브랜드 로고만. */
export type BrandLogoMode = "none" | "creator";

export type AiImageEditPreset = "remove_logo" | "remove_text" | "design" | "color" | "custom";

export const AI_IMAGE_EDIT_PRESETS: Array<{ value: AiImageEditPreset; label: string; needsPrompt: boolean; placeholder?: string }> = [
  { value: "remove_logo", label: "로고 제거", needsPrompt: false },
  { value: "remove_text", label: "글자 제거", needsPrompt: false },
  { value: "design", label: "디자인 수정", needsPrompt: true, placeholder: "예: 소매를 반팔로, 포켓 없애기" },
  { value: "color", label: "컬러 수정", needsPrompt: true, placeholder: "예: 몸판을 차콜 그레이로" },
  { value: "custom", label: "직접 수정 요청", needsPrompt: true, placeholder: "어떻게 수정할지 적어주세요" },
];

const RATIOS: Array<[string, number]> = [
  ["1:1", 1], ["4:5", 0.8], ["3:4", 0.75], ["2:3", 2 / 3], ["9:16", 9 / 16],
  ["5:4", 1.25], ["4:3", 4 / 3], ["3:2", 1.5], ["16:9", 16 / 9],
];

/** 이미지 실제 비율에 가장 가까운 생성 비율(편집 결과의 구도를 원본과 같게 유지). */
export const nearestAspectRatio = (width: number, height: number) => {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  return RATIOS.reduce((best, entry) => (Math.abs(entry[1] - ratio) < Math.abs(best[1] - ratio) ? entry : best))[0];
};

export const measureImageAspectRatio = (url: string) =>
  new Promise<string>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(nearestAspectRatio(image.naturalWidth, image.naturalHeight));
    image.onerror = () => resolve("1:1");
    image.src = url;
  });

const readFunctionError = async (error: unknown) => {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    const payload = await context.json().catch(() => null);
    if (typeof payload?.error === "string") return payload.error;
  }
  return (error as { message?: string })?.message || "이미지를 수정하지 못했습니다.";
};

/** 기존 AI 이미지를 편집해 새 이미지 URL 을 돌려준다(원본은 그대로 남는다). */
export const editAiImage = async (input: {
  imageUrl: string;
  preset: AiImageEditPreset;
  prompt?: string;
  detailPageId?: string | null;
  aspectRatio?: string;
}) => {
  const aspectRatio = input.aspectRatio ?? (await measureImageAspectRatio(input.imageUrl));
  const { data, error } = await supabase.functions.invoke("edit-ai-image", {
    body: {
      imageUrl: input.imageUrl,
      preset: input.preset,
      prompt: input.prompt?.trim() || undefined,
      detailPageId: input.detailPageId ?? undefined,
      aspectRatio,
    },
  });
  if (error) throw new Error(await readFunctionError(error));
  if (!data?.url) throw new Error(data?.error || "수정된 이미지가 반환되지 않았습니다.");
  return { url: data.url as string, path: data.path as string };
};
