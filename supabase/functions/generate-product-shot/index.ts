import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  fetchReferenceImage,
  getImageProvider,
  ImageProviderConfigError,
  type ImageGenerationResult,
  type ReferenceImage,
} from "../_shared/imageProviders.ts";
import { logAiUsage, precheckAiUsage } from "../_shared/aiUsage.ts";
import { designRetryNote, inspectGeneratedImage, REFRAME_ON_RETRY, TEXT_ON_RETRY, textPolicyIssue, violatesPeoplePolicy, type ImageQaResult } from "../_shared/imageQa.ts";
import { createTimeBudget, DETAIL_IMAGE_AI_BUDGET_MS, isTimeBudgetError, runWithinBudget, TIME_BUDGET_MESSAGE, TimeBudgetError } from "../_shared/timeBudget.ts";
import {
  ANALYSIS_PROMPT,
  buildProductShotPrompt,
  type Box,
  type DesignAnalysis,
  focusBoxForShot,
  getShotSpec,
  isInferredShot,
  isProductShotType,
  isShotAvailable,
  normalizeRegion,
  parseDesignAnalysis,
  type ProductShotType,
  regionToBox,
} from "../_shared/productShotPrompt.ts";
import { cropReferenceImages, type CropRequest } from "../_shared/productShotCrop.ts";

/**
 * AI 상세 컷 · 디테일 컷 생성.
 *
 *   action "analyze"  : 원본 디자인 이미지에서 보이는 디자인 요소(넥라인 · 소매 · 밑단 · 프린팅 · 자수 · 지퍼/단추 · 포켓 ·
 *                       로고)와 위치를 분석해 캐시한다. 화면은 이 결과로 원본에 없는 디테일 컷을 비활성화한다.
 *   action "generate" : 컷 1장을 만든다. 원본 이미지를 REFERENCE IMAGE 1 로, 확대할 부분 · 앞/뒤 뷰를 잘라 추가 참조로 넘기는
 *                       이미지 참조 기반 생성이다. 생성 후 원본과 같은 디자인인지 비전 모델로 검수하고, 다르면 한 번 다시 만든다.
 *                       shotId 를 주면 그 컷(실패 · 다시 생성)을 같은 조건으로 다시 만든다.
 *
 * 로그인 필요. 디자인은 본인 소유만, 원본 · 참고 이미지는 이 프로젝트 Storage 의 이미지만 받는다.
 * 사용량은 기존 기능과 분리된 product_shot / product_shot_analysis 한도로 집계한다.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ANALYSIS_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];
const MAX_EXTRA_REFERENCES = 3;

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const extensionFor = (mime: string) => (mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png");

const isProjectStorageUrl = (value: unknown, supabaseUrl: string): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === new URL(supabaseUrl).origin && url.pathname.startsWith("/storage/v1/object/");
  } catch {
    return false;
  }
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any;

type DesignRow = { id: string; user_id: string | null; product_type: string | null; fabric: string | null; color: string | null; fit: string | null; detail: string | null; prompt: string | null };

const loadOwnedDesign = async (admin: Admin, designId: unknown, userId: string): Promise<DesignRow | null> => {
  if (designId === undefined || designId === null || designId === "") return null;
  if (!isUuid(designId)) throw new HttpError(400, "디자인 정보가 올바르지 않습니다.");
  const { data, error } = await admin
    .from("designs")
    .select("id, user_id, product_type, fabric, color, fit, detail, prompt")
    .eq("id", designId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "디자인을 찾을 수 없습니다.");
  if (data.user_id !== userId) throw new HttpError(403, "내 디자인에서만 상세 컷을 만들 수 있습니다.");
  return data as DesignRow;
};

/** 원본 이미지 분석(캐시 우선). 실패하면 null — 생성은 분석 없이(좌표 · 존재 확인 없이) 보수적인 프롬프트로 진행한다. */
const analyzeDesign = async (
  admin: Admin,
  apiKey: string,
  input: { userId: string; designId: string | null; sourceUrl: string; source: ReferenceImage; force?: boolean },
): Promise<{ analysis: DesignAnalysis | null; cached: boolean; quotaError?: string }> => {
  if (!input.force) {
    const { data: cached } = await admin
      .from("design_shot_analyses")
      .select("analysis")
      .eq("user_id", input.userId)
      .eq("source_image_url", input.sourceUrl)
      .maybeSingle();
    if (cached?.analysis) return { analysis: parseDesignAnalysis(cached.analysis), cached: true };
  }

  const quota = await precheckAiUsage(admin, input.userId, "product_shot_analysis");
  if (!quota.allowed) return { analysis: null, cached: false, quotaError: quota.reason };

  const startedAt = Date.now();
  let calls = 0;
  let lastError = "analysis_failed";
  for (const model of ANALYSIS_MODELS) {
    calls += 1;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: ANALYSIS_PROMPT }, { inlineData: { data: input.source.data, mimeType: input.source.mimeType } }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      });
      if (!response.ok) {
        lastError = `model=${model} status=${response.status}`;
        continue;
      }
      const data = await response.json();
      const text = (data?.candidates?.[0]?.content?.parts ?? []).map((part: { text?: string }) => part.text ?? "").join("");
      const analysis = parseDesignAnalysis(text);
      await admin.from("design_shot_analyses").upsert(
        { user_id: input.userId, design_id: input.designId, source_image_url: input.sourceUrl, analysis, model },
        { onConflict: "user_id,source_image_url" },
      );
      await logAiUsage(admin, {
        userId: input.userId, feature: "product_shot_analysis", status: "success", provider: "gemini", model,
        imageType: "analysis", latencyMs: Date.now() - startedAt, units: calls, metadata: { designId: input.designId },
      });
      return { analysis, cached: false };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  console.error("product shot analysis failed:", lastError);
  await logAiUsage(admin, {
    userId: input.userId, feature: "product_shot_analysis", status: "failed", provider: "gemini",
    imageType: "analysis", latencyMs: Date.now() - startedAt, error: lastError, units: calls, metadata: { designId: input.designId },
  });
  return { analysis: null, cached: false };
};

const SHOT_LABEL_EN: Record<string, string> = {
  neckline: "neckline / collar", sleeve: "sleeve end and cuff", hem: "bottom hem", print: "printed graphic",
  embroidery: "embroidery", closure: "zipper / buttons", pocket: "pocket", design_detail: "main design detail (logo / print / embroidery)",
};

/** 컷 종류별 추가 참조(원본에서 잘라낸 앞/뒤 뷰 · 확대 부위 · 사용자 선택 영역). */
const cropPlan = (type: ProductShotType, analysis: DesignAnalysis | null, region: Box | null): CropRequest[] => {
  const spec = getShotSpec(type)!;
  const plan: CropRequest[] = [];
  if (type === "custom_region" && region) {
    plan.push({ box: region, label: "SELECTED AREA — crop of REFERENCE IMAGE 1 that the user selected; the close-up must show exactly this", padding: 0.04 });
    return plan;
  }
  if (spec.category === "detail") {
    const focus = focusBoxForShot(type, analysis);
    if (focus) {
      plan.push({ box: focus, label: `CLOSE-UP AREA — crop of REFERENCE IMAGE 1 showing the exact ${SHOT_LABEL_EN[type] ?? type} to reproduce`, padding: 0.15 });
      return plan;
    }
    if (analysis?.frontBox) plan.push({ box: analysis.frontBox, label: "FRONT VIEW crop of REFERENCE IMAGE 1 (higher detail of the same garment)", padding: 0.03 });
    return plan;
  }
  if (analysis?.layout === "front_back") {
    if (analysis.frontBox) plan.push({ box: analysis.frontBox, label: "FRONT VIEW crop of REFERENCE IMAGE 1 (same garment)", padding: 0.03 });
    if (analysis.backBox && (type === "back" || type === "side" || type === "three_quarter")) {
      plan.push({ box: analysis.backBox, label: "BACK VIEW crop of REFERENCE IMAGE 1 (same garment)", padding: 0.03 });
    }
  }
  return plan;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  let provider;
  try {
    provider = getImageProvider();
  } catch (error) {
    return json({ error: error instanceof ImageProviderConfigError ? error.message : "이미지 생성 설정 오류" }, 503);
  }

  const startedAt = Date.now();
  let userId: string | null = null;
  let shotId: string | null = null;
  let shotType = "";
  let generationCalls = 0;
  let qaCalls = 0;
  let designIdForLog: string | null = null;

  try {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "로그인이 필요합니다.", code: "login_required" }, 401);
    userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action === "analyze" ? "analyze" : "generate";

    // 다시 생성 · 실패 재시도: 저장된 컷의 조건을 그대로 쓴다.
    let existing: Record<string, unknown> | null = null;
    if (action === "generate" && body.shotId !== undefined) {
      if (!isUuid(body.shotId)) return json({ error: "컷 정보가 올바르지 않습니다." }, 400);
      const { data } = await admin.from("design_shots").select("*").eq("id", body.shotId).maybeSingle();
      if (!data || data.user_id !== userId) return json({ error: "컷을 찾을 수 없습니다." }, 404);
      existing = data;
    }

    const sourceUrl = (existing?.source_image_url as string | undefined) ?? body.sourceImageUrl;
    if (!isProjectStorageUrl(sourceUrl, supabaseUrl)) {
      return json({ error: "BRAND-ER 에 저장된 디자인 이미지에서만 상세 컷을 만들 수 있습니다." }, 400);
    }
    const design = await loadOwnedDesign(admin, existing ? existing.design_id : body.designId, userId);
    designIdForLog = design?.id ?? null;

    const source = (await fetchReferenceImage(sourceUrl, "the ORIGINAL garment design (front on the left, back on the right when two views are shown)", true))!;

    if (action === "analyze") {
      if (!geminiKey) return json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 503);
      const result = await analyzeDesign(admin, geminiKey, { userId, designId: design?.id ?? null, sourceUrl, source, force: body.force === true });
      if (!result.analysis && result.quotaError) return json({ error: result.quotaError, quotaExceeded: true }, 429);
      if (!result.analysis) return json({ error: "디자인을 분석하지 못했습니다. 잠시 후 다시 시도해주세요." }, 502);
      return json({ analysis: result.analysis, cached: result.cached });
    }

    shotType = String(existing?.shot_type ?? body.shotType ?? "");
    if (!isProductShotType(shotType)) return json({ error: "지원하지 않는 컷 유형입니다." }, 400);
    const spec = getShotSpec(shotType)!;

    const regionInput = existing ? existing.region : body.region;
    const region = normalizeRegion(regionInput);
    if (shotType === "custom_region" && !region) return json({ error: "확대할 영역을 이미지에서 선택해주세요." }, 400);
    const regionBox = region ? regionToBox(region) : null;
    const note = typeof (existing?.note ?? body.note) === "string" ? String(existing?.note ?? body.note).trim().slice(0, 200) : "";

    const rawRefs = (existing ? existing.reference_image_urls : body.referenceImageUrls) as unknown;
    const referenceUrls = (Array.isArray(rawRefs) ? rawRefs : [])
      .filter((url): url is string => isProjectStorageUrl(url, supabaseUrl))
      .slice(0, MAX_EXTRA_REFERENCES);

    const analysisResult = geminiKey
      ? await analyzeDesign(admin, geminiKey, { userId, designId: design?.id ?? null, sourceUrl, source })
      : { analysis: null, cached: false };
    const analysis = analysisResult.analysis;

    // 원본에 없는 부자재 · 디테일은 만들지 않는다(사용자 지정 영역은 사용자가 직접 본 부분이라 예외).
    if (!isShotAvailable(shotType, analysis)) {
      return json({
        error: `원본 디자인에서 ${spec.label} 요소를 찾을 수 없어 생성하지 않았습니다. 이미지에서 원하는 부분을 직접 선택해 확대 컷을 만들어주세요.`,
        code: "element_missing",
      }, 422);
    }

    const quota = await precheckAiUsage(admin, userId, "product_shot");
    if (!quota.allowed) return json({ error: quota.reason ?? "AI 상세 컷 생성 한도를 초과했습니다.", quotaExceeded: true }, 429);

    const focusBox = shotType === "custom_region" ? regionBox : focusBoxForShot(shotType, analysis);
    const crops = await cropReferenceImages(source, cropPlan(shotType, analysis, regionBox));
    const references: ReferenceImage[] = [source, ...crops];
    for (const url of referenceUrls) {
      const extra = await fetchReferenceImage(
        url,
        "creator-provided photo of the SAME garment — use it for parts that are hidden or unclear in REFERENCE IMAGE 1 (it shows the real product)",
      ).catch(() => null);
      if (extra) references.push(extra);
    }

    const promptInput = {
      type: shotType,
      referenceLabels: references.map((ref) => ref.label),
      analysis,
      product: { clothType: design?.product_type, material: design?.fabric, color: design?.color, fit: design?.fit },
      region: shotType === "custom_region" ? regionBox : null,
      note,
    };
    const prompt = buildProductShotPrompt(promptInput);
    const inferred = isInferredShot(shotType, analysis) && referenceUrls.length === 0;

    const rowPatch = {
      status: "generating",
      prompt,
      focus_box: focusBox,
      is_inferred: inferred,
      error_message: null,
      provider: provider.name,
    };
    if (existing) {
      const { error } = await admin.from("design_shots").update(rowPatch).eq("id", existing.id);
      if (error) throw error;
      shotId = existing.id as string;
    } else {
      const { data: inserted, error } = await admin
        .from("design_shots")
        .insert({
          ...rowPatch,
          user_id: userId,
          design_id: design?.id ?? null,
          batch_id: isUuid(body.batchId) ? body.batchId : null,
          source_image_url: sourceUrl,
          shot_category: spec.category,
          shot_type: shotType,
          region,
          note: note || null,
          reference_image_urls: referenceUrls,
        })
        .select("id")
        .single();
      if (error) throw error;
      shotId = inserted.id as string;
    }

    // 생성 → 검수(사람 · 글자 · 원본 디자인 일치). 다르면 차이를 되돌리도록 한 번 다시 생성한다.
    const budget = createTimeBudget(startedAt, DETAIL_IMAGE_AI_BUDGET_MS);
    const qaReference = { data: source.data, mimeType: source.mimeType };
    const judge = async (image: ImageGenerationResult) => {
      qaCalls += 1;
      const qa: ImageQaResult | null = await inspectGeneratedImage(geminiKey, { data: image.base64, mimeType: image.mimeType }, qaReference, spec.qaScope, budget.signal());
      if (!qa && budget.expired()) throw new TimeBudgetError();
      const peopleOk = !violatesPeoplePolicy(qa, "none");
      const textIssue = textPolicyIssue(qa, null);
      const designDifferences = qa && !qa.matchesReference ? qa.designDifferences : null;
      return {
        image, qa, peopleOk, textIssue, designDifferences,
        ok: peopleOk && !textIssue && !designDifferences,
        acceptable: peopleOk && textIssue !== "brand_er",
      };
    };
    let retryNote = "";
    const { result, attempts } = await runWithinBudget(
      async (retry) => {
        generationCalls += 1;
        const image = await provider.generate({
          prompt: retry && retryNote ? buildProductShotPrompt({ ...promptInput, retryNote }) : prompt,
          references,
          aspectRatio: spec.aspectRatio,
          signal: budget.signal(),
        });
        const judged = await judge(image);
        if (!retry) {
          retryNote = [
            judged.peopleOk ? "" : REFRAME_ON_RETRY,
            judged.textIssue ? TEXT_ON_RETRY : "",
            judged.designDifferences ? designRetryNote(judged.designDifferences) : "",
          ].filter(Boolean).join("\n\n");
        }
        return judged;
      },
      budget,
    );
    if (!result.ok && !result.acceptable) {
      throw new Error(result.peopleOk ? "BRAND-ER 표기가 없는 이미지를 만들지 못했습니다. 다시 생성해 주세요." : "사람이 없는 제품 컷을 만들지 못했습니다. 다시 생성해 주세요.");
    }

    const generated = result.image;
    const path = `shots/${userId}/${design?.id ?? "no-design"}/${shotType}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extensionFor(generated.mimeType)}`;
    const { error: uploadError } = await admin.storage
      .from("generated_images")
      .upload(path, fromBase64(generated.base64), { contentType: generated.mimeType, upsert: false, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    const url = admin.storage.from("generated_images").getPublicUrl(path).data.publicUrl;

    const qaSummary = result.qa
      ? { matchesReference: result.qa.matchesReference, designDifferences: result.qa.designDifferences, extraText: result.qa.extraText, model: result.qa.model }
      : null;
    const cost = await logAiUsage(admin, {
      userId, feature: "product_shot", status: "success", provider: generated.provider, model: generated.model,
      imageType: shotType, latencyMs: Date.now() - startedAt, units: generationCalls, secondaryUnits: qaCalls,
      metadata: { shotId, designId: design?.id ?? null, attempts, references: references.length, inferred, qa: qaSummary, regenerate: Boolean(existing) },
    });

    const { data: previous } = await admin.from("design_shots").select("image_url, previous_image_urls, attempt_count, api_calls, estimated_cost_usd").eq("id", shotId).single();
    const { data: saved, error: saveError } = await admin
      .from("design_shots")
      .update({
        status: "succeeded",
        image_url: url,
        storage_path: path,
        previous_image_urls: previous?.image_url
          ? [...((previous.previous_image_urls as string[] | null) ?? []), previous.image_url].slice(-10)
          : (previous?.previous_image_urls ?? []),
        qa: qaSummary,
        model: generated.model,
        provider: generated.provider,
        attempt_count: Number(previous?.attempt_count ?? 0) + 1,
        api_calls: Number(previous?.api_calls ?? 0) + generationCalls + qaCalls,
        estimated_cost_usd: Number(previous?.estimated_cost_usd ?? 0) + Number(cost ?? 0),
        latency_ms: Date.now() - startedAt,
        error_message: null,
      })
      .eq("id", shotId)
      .select("*")
      .single();
    if (saveError) throw saveError;

    return json({ shot: saved, attempts, analysisCached: analysisResult.cached });
  } catch (error) {
    const timedOut = isTimeBudgetError(error);
    const status = error instanceof HttpError ? error.status : 502;
    const message = timedOut ? TIME_BUDGET_MESSAGE : error instanceof Error ? error.message : String(error);
    console.error("generate-product-shot error:", message);
    let shot = null;
    if (shotId) {
      const { data: previous } = await admin.from("design_shots").select("attempt_count, api_calls, image_url").eq("id", shotId).single();
      const { data } = await admin
        .from("design_shots")
        .update({
          // 이미 성공한 결과가 있던 컷(다시 생성 실패)은 이전 이미지를 유지한다.
          status: previous?.image_url ? "succeeded" : "failed",
          error_message: message.slice(0, 1000),
          attempt_count: Number(previous?.attempt_count ?? 0) + 1,
          api_calls: Number(previous?.api_calls ?? 0) + generationCalls + qaCalls,
          latency_ms: Date.now() - startedAt,
        })
        .eq("id", shotId)
        .select("*")
        .single();
      shot = data;
    }
    if (userId && shotType && generationCalls > 0) {
      await logAiUsage(admin, {
        userId, feature: "product_shot", status: "failed", provider: provider?.name, imageType: shotType,
        latencyMs: Date.now() - startedAt, error: message, units: generationCalls, secondaryUnits: qaCalls,
        metadata: { shotId, designId: designIdForLog },
      });
    }
    return json({ error: message, code: error instanceof HttpError ? error.code : undefined, shot, timedOut }, status);
  }
});
