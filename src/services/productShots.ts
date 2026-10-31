import { supabase } from "@/lib/supabase";
import { compressImage } from "@/services/brand";
import { downloadBlob, safeFileName, zipStore } from "@/lib/xlsx";
import {
  ALL_SHOTS,
  type DesignAnalysis,
  type NormalizedRegion,
  type ProductShotType,
} from "../../supabase/functions/_shared/productShotPrompt";

/**
 * AI 상세 컷 · 디테일 컷 클라이언트.
 * 생성은 Edge Function(generate-product-shot)만 하고, 결과(design_shots)는 본인 행만 RLS 로 읽는다.
 * 컷 1장 = 요청 1번이라 여러 장을 만들어도 성공한 컷은 남고 실패한 컷만 다시 시도할 수 있다.
 */

export type { DesignAnalysis, NormalizedRegion, ProductShotType };
export { ALL_SHOTS, ANGLE_SHOTS, BASIC_SHOT_SET, DETAIL_SHOTS, getShotSpec, isShotAvailable, planBasicShotSet } from "../../supabase/functions/_shared/productShotPrompt";

export type DesignShotStatus = "queued" | "generating" | "succeeded" | "failed";

export type DesignShot = {
  id: string;
  design_id: string | null;
  batch_id: string | null;
  source_image_url: string;
  shot_category: "angle" | "detail" | "custom";
  shot_type: ProductShotType;
  region: NormalizedRegion | null;
  note: string | null;
  reference_image_urls: string[];
  status: DesignShotStatus;
  image_url: string | null;
  previous_image_urls: string[];
  is_inferred: boolean;
  qa: { matchesReference?: boolean; designDifferences?: string[] } | null;
  error_message: string | null;
  attempt_count: number;
  api_calls: number;
  estimated_cost_usd: number;
  saved_to_closet_at: string | null;
  created_at: string;
  updated_at: string;
};

export class ProductShotError extends Error {
  constructor(
    message: string,
    public code?: string,
    public shot?: DesignShot | null,
    public quotaExceeded = false,
    public status?: number,
  ) {
    super(message);
    this.name = "ProductShotError";
  }
}

export const shotLabel = (type: string) => ALL_SHOTS.find((spec) => spec.type === type)?.label ?? type;

const SHOT_COLUMNS =
  "id, design_id, batch_id, source_image_url, shot_category, shot_type, region, note, reference_image_urls, status, image_url, previous_image_urls, is_inferred, qa, error_message, attempt_count, api_calls, estimated_cost_usd, saved_to_closet_at, created_at, updated_at";

const invokeShotFunction = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("generate-product-shot", { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    const payload = context && typeof context.json === "function" ? await context.json().catch(() => null) : null;
    const status = context?.status;
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : status === 546 || status === 504
          ? "이미지 생성 시간이 초과되었습니다. 다시 시도해주세요."
          : error.message || "상세 컷을 만들지 못했습니다.";
    throw new ProductShotError(message, payload?.code, (payload?.shot as DesignShot | null) ?? null, Boolean(payload?.quotaExceeded), status);
  }
  return data as Record<string, unknown>;
};

/** 원본 디자인에서 보이는 디자인 요소(넥라인 · 프린팅 · 자수 · 부자재 · 포켓 등)와 위치. 같은 이미지는 서버 캐시를 쓴다. */
export const analyzeDesignForShots = async (input: { designId?: string | null; sourceImageUrl: string; force?: boolean }) => {
  const data = await invokeShotFunction({
    action: "analyze",
    designId: input.designId || undefined,
    sourceImageUrl: input.sourceImageUrl,
    force: input.force || undefined,
  });
  return data.analysis as DesignAnalysis;
};

export type GenerateShotInput = {
  designId?: string | null;
  sourceImageUrl: string;
  shotType: ProductShotType;
  region?: NormalizedRegion | null;
  note?: string | null;
  referenceImageUrls?: string[];
  batchId?: string | null;
  /** 이미 있는 컷을 같은 조건으로 다시 만든다(실패 재시도 · 다시 생성). */
  shotId?: string | null;
};

export const generateProductShot = async (input: GenerateShotInput): Promise<DesignShot> => {
  const data = await invokeShotFunction(
    input.shotId
      ? { action: "generate", shotId: input.shotId }
      : {
          action: "generate",
          designId: input.designId || undefined,
          sourceImageUrl: input.sourceImageUrl,
          shotType: input.shotType,
          region: input.region ?? undefined,
          note: input.note?.trim() || undefined,
          referenceImageUrls: input.referenceImageUrls?.length ? input.referenceImageUrls : undefined,
          batchId: input.batchId ?? undefined,
        },
  );
  return data.shot as DesignShot;
};

/** 이 디자인(없으면 같은 원본 이미지)에서 만든 내 컷 목록. 최신순. */
export const listDesignShots = async (input: { designId?: string | null; sourceImageUrl?: string | null }) => {
  let query = supabase.from("design_shots").select(SHOT_COLUMNS).order("created_at", { ascending: false }).limit(60);
  if (input.designId) query = query.eq("design_id", input.designId);
  else if (input.sourceImageUrl) query = query.eq("source_image_url", input.sourceImageUrl);
  else return [] as DesignShot[];
  const { data, error } = await query;
  if (error) throw new Error(error.message || "상세 컷 목록을 불러오지 못했습니다.");
  return (data ?? []) as DesignShot[];
};

export const markShotSavedToCloset = async (shotId: string) => {
  const { error } = await supabase.from("design_shots").update({ saved_to_closet_at: new Date().toISOString() }).eq("id", shotId);
  if (error) console.error("design_shots saved flag failed:", error.message);
};

export const deleteDesignShot = async (shotId: string) => {
  const { error } = await supabase.from("design_shots").delete().eq("id", shotId);
  if (error) throw new Error(error.message || "컷을 삭제하지 못했습니다.");
};

export const fetchProductShotQuota = async (): Promise<{ used: number; limit: number } | null> => {
  const { data, error } = await supabase.rpc("get_my_product_shot_quota");
  if (error || !data) return null;
  return { used: Number(data.used ?? 0), limit: Number(data.limit ?? 0) };
};

/** 후면 · 측면 등 원본에서 보이지 않는 부분을 보완할 실제 제품 사진(최대 3장). 본인 creator-assets 폴더에 올린다. */
export const uploadShotReference = async (file: File) => {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("로그인이 필요합니다.");
  const blob = await compressImage(file);
  const path = `${user.id}/shot-references/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("creator-assets").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw new Error(error.message || "참고 이미지를 올리지 못했습니다.");
  return supabase.storage.from("creator-assets").getPublicUrl(path).data.publicUrl;
};

/** 작업을 동시에 limit 개씩 실행한다(한 작업의 실패가 다른 작업을 멈추지 않는다). */
export const runWithConcurrency = async <T,>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index).catch(() => undefined);
    }
  });
  await Promise.all(runners);
};

const extensionFromType = (type: string) => (type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png");

const fetchImageBlob = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`이미지를 내려받지 못했습니다 (${response.status})`);
  return response.blob();
};

export const shotFileName = (baseName: string, shot: Pick<DesignShot, "shot_type" | "id">, type: string, index?: number) =>
  `${safeFileName(baseName)}_${index !== undefined ? `${String(index + 1).padStart(2, "0")}_` : ""}${safeFileName(shotLabel(shot.shot_type))}_${shot.id.slice(0, 6)}.${extensionFromType(type)}`;

/** 이미지 한 장 다운로드(교차 출처라 a[download] 대신 blob 으로 받는다). */
export const downloadImageUrl = async (url: string, fileNameWithoutExt: string) => {
  const blob = await fetchImageBlob(url);
  downloadBlob(blob, `${safeFileName(fileNameWithoutExt)}.${extensionFromType(blob.type)}`);
};

export const downloadShot = async (shot: DesignShot, baseName: string) => {
  if (!shot.image_url) throw new Error("다운로드할 이미지가 없습니다.");
  const blob = await fetchImageBlob(shot.image_url);
  downloadBlob(blob, shotFileName(baseName, shot, blob.type));
};

/** 성공한 컷 전체(+원본 디자인)를 ZIP 하나로 내려받는다. */
export const downloadShotsZip = async (shots: DesignShot[], baseName: string, originalUrl?: string | null) => {
  const ready = shots.filter((shot) => shot.status === "succeeded" && shot.image_url);
  if (!ready.length) throw new Error("다운로드할 이미지가 없습니다.");
  const files: { name: string; data: Uint8Array }[] = [];
  if (originalUrl) {
    const blob = await fetchImageBlob(originalUrl).catch(() => null);
    if (blob) files.push({ name: `${safeFileName(baseName)}_00_원본디자인.${extensionFromType(blob.type)}`, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  for (const [index, shot] of ready.entries()) {
    const blob = await fetchImageBlob(shot.image_url!);
    files.push({ name: shotFileName(baseName, shot, blob.type, index), data: new Uint8Array(await blob.arrayBuffer()) });
  }
  downloadBlob(new Blob([zipStore(files)], { type: "application/zip" }), `${safeFileName(baseName)}_상세컷.zip`);
};
