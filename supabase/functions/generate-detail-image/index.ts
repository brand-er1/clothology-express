import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildProductImagePrompt,
  IMAGE_ASPECT_RATIO,
  isDetailImageType,
  isDetailPageStyle,
  PEOPLE_MODE,
  type DetailImageType,
  type PromptProduct,
} from "../_shared/detailImagePrompt.ts";
import { fetchReferenceImage, getImageProvider, ImageProviderConfigError, type ImageGenerationResult, type ReferenceImage } from "../_shared/imageProviders.ts";
import { logAiUsage, precheckAiUsage } from "../_shared/aiUsage.ts";
import { CREATOR_LOGO_REFERENCE_LABEL, findCreatorLogo, parseBrandLogoMode } from "../_shared/brandingPolicy.ts";
import { designRetryNote, inspectGeneratedImage, REFRAME_ON_RETRY, TEXT_ON_RETRY, textPolicyIssue, violatesPeoplePolicy, type ImageQaResult } from "../_shared/imageQa.ts";
import { cropBelowHead } from "../_shared/reframeCrop.ts";
import { createTimeBudget, DETAIL_IMAGE_AI_BUDGET_MS, isTimeBudgetError, runWithinBudget, TIME_BUDGET_MESSAGE, TimeBudgetError } from "../_shared/timeBudget.ts";

/**
 * Generates ONE AI detail-page image from the creator's design (reference image).
 *
 *   frontend → quota check → this function → ImageProvider (../_shared/imageProviders.ts,
 *   Gemini by default; design + up to 2 creator reference photos) → Supabase Storage
 *   (generated_images/detail-pages/{user}/{page}/...) → generated_assets row → usage log → URL
 *
 * The vendor is behind the ImageProvider interface (DETAIL_IMAGE_PROVIDER / DETAIL_IMAGE_MODELS
 * secrets), and results are always copied into the existing public `generated_images` bucket. The prompt and the reference image are resolved here from
 * the detail page row, so a client can only generate images of its own page's design.
 *
 * Body: { detailPageId, imageType, style?, userInstruction? }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const extensionFor = (mimeType: string) =>
  mimeType.includes("webp") ? "webp" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";

const str = (value: unknown) => (typeof value === "string" ? value : "");
const strList = (value: unknown) => (Array.isArray(value) ? value.map(str).filter(Boolean) : []);

const toPromptProduct = (source: Record<string, unknown>): PromptProduct => {
  const provided = (source.userProvided ?? {}) as Record<string, unknown>;
  return {
    clothType: str(source.clothType),
    color: str(provided.colorName) || str(source.color),
    material: str(source.material),
    fit: str(source.fit) || str(provided.fitNote),
    designDescription: [str(source.designDescription), str(provided.details)].filter(Boolean).join(" / "),
    decorations: Array.isArray(source.decorations)
      ? source.decorations.map((entry) => {
          const decoration = (entry ?? {}) as Record<string, unknown>;
          return { kind: str(decoration.kind), label: str(decoration.label), location: str(decoration.location) };
        })
      : [],
    accessories: strList(source.accessories),
    constructionFeatures: strList(source.constructionFeatures),
    isFrontBackComposite: source.isFrontBackComposite !== false,
  };
};

/** Which creator reference photos help which image type (max 2 extra references per call). */
const REFERENCE_KINDS: Record<DetailImageType, string[]> = {
  hero: ["sample", "logo"],
  product_front: ["sample", "logo"],
  product_back: ["sample"],
  detail: ["detail", "logo", "sample"],
  fabric: ["fabric", "sample"],
  editorial: ["wearing", "reference", "brand"],
  lifestyle: ["wearing", "sample"],
  mood: ["brand", "reference"],
  flat_lay: ["sample", "fabric"],
};

const REFERENCE_LABEL: Record<string, string> = {
  sample: "creator's real sample photo of this product",
  fabric: "creator's photo of the actual fabric",
  detail: "creator's close-up of a real product detail",
  wearing: "creator's photo of the product being worn",
  reference: "creator's mood/styling reference (not the product)",
  logo: "creator's brand logo artwork as printed on the product",
  brand: "creator's brand image (mood only)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  let provider;
  try {
    provider = getImageProvider();
  } catch (error) {
    return json({ error: error instanceof ImageProviderConfigError ? error.message : "이미지 생성 설정 오류" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  let assetId: string | null = null;
  let userId: string | null = null;
  let pageId: string | null = null;
  let requestedType: string | null = null;
  const startedAt = Date.now();

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ error: "로그인이 필요합니다." }, 401);
    userId = user.id;

    const { detailPageId, imageType, style, userInstruction, brandLogo } = await req.json();
    if (typeof detailPageId !== "string" || !isDetailImageType(imageType)) {
      return json({ error: "잘못된 요청입니다." }, 400);
    }
    requestedType = imageType;

    // 본인 상세페이지만 생성 가능(다른 제작자의 펀딩/상세페이지 접근 차단)
    const { data: page, error: pageError } = await admin
      .from("product_detail_pages")
      .select("id, user_id, template, source")
      .eq("id", detailPageId)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page || page.user_id !== user.id) return json({ error: "상세페이지를 찾을 수 없습니다." }, 404);
    pageId = page.id as string;

    const quota = await precheckAiUsage(admin, user.id, "detail_image", page.id);
    if (!quota.allowed) return json({ error: quota.reason ?? "AI 이미지 생성 한도를 초과했습니다.", quotaExceeded: true }, 429);

    const source = (page.source ?? {}) as Record<string, unknown>;
    const referenceUrl = str(source.imageUrl);
    if (!/^https:\/\//.test(referenceUrl)) return json({ error: "참조할 디자인 이미지가 없습니다." }, 400);

    const detailPageStyle = isDetailPageStyle(style) ? style : isDetailPageStyle(page.template) ? page.template : "minimal";
    const product = toPromptProduct(source);
    const instruction = typeof userInstruction === "string" ? userInstruction.trim().slice(0, 500) : "";
    // 브랜드 로고는 제작자가 "내 브랜드 로고 적용"을 고른 경우에만(요청값 또는 상세페이지 설정). 기본은 로고 없음.
    const brandLogoMode = parseBrandLogoMode(brandLogo ?? source.brandLogoMode);
    const creatorLogo = brandLogoMode === "creator" ? await findCreatorLogo(admin, user.id) : null;
    if (brandLogoMode === "creator" && !creatorLogo) {
      return json({ error: "내 브랜드에 등록된 로고가 없습니다. 마이페이지 > 내 브랜드에서 로고를 등록해주세요." }, 400);
    }

    // 제작자가 올린 참고자료 중 이 이미지 유형에 도움이 되는 사진(최대 2장)
    // 로고 참고자료는 로고 적용을 고른 경우에만 쓴다(그 외에는 로고가 복제되지 않도록 제외).
    const wantedKinds = REFERENCE_KINDS[imageType as DetailImageType].filter((kind) => kind !== "logo" || creatorLogo);
    const { data: referenceRows } = await admin
      .from("detail_page_references")
      .select("kind, url, mime_type")
      .eq("detail_page_id", page.id)
      .eq("use_for_generation", true)
      .in("kind", wantedKinds)
      .order("created_at", { ascending: true })
      .limit(10);
    const orderedRefs = ((referenceRows ?? []) as Array<{ kind: string; url: string }>)
      .sort((a, b) => wantedKinds.indexOf(a.kind) - wantedKinds.indexOf(b.kind))
      .slice(0, 2);

    const designLabel = product.isFrontBackComposite ? "garment design, front (left) and back (right)" : "garment design";
    const prompt = buildProductImagePrompt({
      product,
      referenceImages: [
        designLabel,
        ...orderedRefs.map((ref) => REFERENCE_LABEL[ref.kind] ?? ref.kind),
        ...(creatorLogo ? [CREATOR_LOGO_REFERENCE_LABEL] : []),
      ],
      imageType,
      detailPageStyle,
      userInstruction: instruction,
      creatorLogo: creatorLogo ? { brandName: creatorLogo.brandName } : null,
    });

    const { data: asset, error: assetError } = await admin
      .from("generated_assets")
      .insert({
        user_id: user.id,
        detail_page_id: page.id,
        image_type: imageType,
        style: detailPageStyle,
        reference_image: referenceUrl,
        prompt,
        user_instruction: instruction || null,
        provider: provider.name,
        generation_status: "generating",
      })
      .select("id")
      .single();
    if (assetError) throw assetError;
    assetId = asset.id as string;

    const references: ReferenceImage[] = [(await fetchReferenceImage(referenceUrl, designLabel, true))!];
    for (const ref of orderedRefs) {
      const extra = await fetchReferenceImage(ref.url, REFERENCE_LABEL[ref.kind] ?? ref.kind).catch(() => null);
      if (extra) references.push(extra);
    }
    if (creatorLogo) {
      const logo = await fetchReferenceImage(creatorLogo.url, CREATOR_LOGO_REFERENCE_LABEL).catch(() => null);
      if (!logo) throw new Error("내 브랜드 로고 이미지를 불러오지 못했습니다.");
      references.push(logo);
    }

    // 생성 → 자동 검수(얼굴·사람·글자/로고·원본 일치).
    // 착용 컷에 머리가 위쪽에 걸쳐 들어오면 카메라 프레임을 어깨선 아래로 다시 잡고(재구도) 재검수,
    // 그래도 안 되면 더 엄격한 구도로 한 번 다시 생성한다. 흐림·가림 처리는 하지 않으며,
    // 끝까지 얼굴/머리가 보이는 결과는 저장하지 않는다.
    const peopleMode = PEOPLE_MODE[imageType as DetailImageType];
    const aspectRatio = IMAGE_ASPECT_RATIO[imageType as DetailImageType];
    const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    const qaScope = imageType === "detail" || imageType === "fabric" ? "partial" : "full";
    // 게이트웨이 150초 제한 전에 이유가 담긴 응답을 돌려주도록 AI 호출(생성 · 검수)은 예산 안에서만 한다.
    const budget = createTimeBudget(startedAt, DETAIL_IMAGE_AI_BUDGET_MS);
    const inspect = async (image: ImageGenerationResult) => {
      const qa = await inspectGeneratedImage(geminiKey, { data: image.base64, mimeType: image.mimeType }, references[0], qaScope, budget.signal());
      // 시간이 다 돼 검수하지 못한 이미지는 통과시키지 않는다.
      if (!qa && budget.expired()) throw new TimeBudgetError();
      return qa;
    };
    // 사람 정책을 통과한 뒤 글자 · 디자인을 본다: BRAND-ER 표기는 저장하지 않고, 원본 디자인에 없는 글자 · 숫자
    // (소품 · 배경 · 캡션)나 원본과 다른 디자인(예: 없던 스트링 추가)은 한 번 다시 생성한다.
    // 다시 생성할 시간이 없거나 재시도가 더 나쁘면 첫 결과를 쓴다.
    const allowedBrand = creatorLogo?.brandName ?? null;
    const judge = (image: ImageGenerationResult, qa: ImageQaResult | null, reframed: boolean) => {
      const textIssue = textPolicyIssue(qa, allowedBrand);
      const designDifferences = qa && !qa.matchesReference ? qa.designDifferences : null;
      return {
        image, qa, reframed, peopleOk: true, textIssue, designDifferences,
        ok: !textIssue && !designDifferences, acceptable: textIssue !== "brand_er",
      };
    };
    const settle = async (image: ImageGenerationResult) => {
      const firstQa = await inspect(image);
      if (!violatesPeoplePolicy(firstQa, peopleMode)) return judge(image, firstQa, false);
      if (peopleMode === "faceless_worn" && firstQa && firstQa.personCount <= 1) {
        const cropped = await cropBelowHead(image.base64, firstQa.headBox);
        if (cropped) {
          const reframedImage = { ...image, ...cropped };
          const croppedQa = await inspect(reframedImage);
          if (croppedQa && !violatesPeoplePolicy(croppedQa, peopleMode)) return judge(reframedImage, croppedQa, true);
        }
      }
      return { image, qa: firstQa, reframed: false, peopleOk: false, textIssue: null, designDifferences: null, ok: false, acceptable: false };
    };

    // 재시도 프롬프트는 첫 시도가 걸린 정책에 맞춘다(얼굴/사람 → 재구도, 글자 → 소품 없는 세트, 디자인 → 차이 되돌리기).
    let retryNote = REFRAME_ON_RETRY;
    const { result, attempts } = await runWithinBudget(
      async (retry) => {
        const settled = await settle(await provider.generate({ prompt: retry ? `${prompt}\n\n${retryNote}` : prompt, references, aspectRatio, signal: budget.signal() }));
        if (!retry && settled.peopleOk) {
          retryNote = [
            settled.textIssue ? TEXT_ON_RETRY : "",
            settled.designDifferences ? designRetryNote(settled.designDifferences) : "",
          ].filter(Boolean).join("\n\n");
        }
        return settled;
      },
      budget,
    );
    if (!result.ok && !result.acceptable) {
      throw new Error(
        result.peopleOk
          ? "BRAND-ER 표기가 없는 이미지를 만들지 못했습니다. 다시 생성해 주세요."
          : "얼굴이 보이지 않는 구도로 이미지를 만들지 못했습니다. 다시 생성해 주세요.",
      );
    }
    const generated = result.image;
    const qa: ImageQaResult | null = result.qa;
    const reframed = result.reframed;

    // Persist in our own storage so the page never depends on a provider's temporary URL.
    const path = `detail-pages/${user.id}/${page.id}/${imageType}-${Date.now()}.${extensionFor(generated.mimeType)}`;
    const { error: uploadError } = await admin.storage
      .from("generated_images")
      .upload(path, fromBase64(generated.base64), { contentType: generated.mimeType, upsert: false, cacheControl: "31536000" });
    if (uploadError) throw uploadError;
    const url = admin.storage.from("generated_images").getPublicUrl(path).data.publicUrl;

    await admin
      .from("generated_assets")
      .update({ generation_status: "completed", generated_image: url, storage_path: path, model: generated.model, provider: generated.provider })
      .eq("id", assetId);

    await logAiUsage(admin, {
      userId: user.id, feature: "detail_image", status: "success", provider: generated.provider, model: generated.model,
      detailPageId: page.id, imageType, latencyMs: Date.now() - startedAt,
      metadata: {
        references: references.length, style: detailPageStyle, instruction: Boolean(instruction), brandLogo: brandLogoMode,
        peopleMode, attempts, reframed, textIssue: result.textIssue, designChanged: Boolean(result.designDifferences), qa,
      },
    });

    return json({ assetId, imageType, url, model: generated.model, style: detailPageStyle, references: references.length, peopleMode, attempts, reframed, textIssue: result.textIssue, qa });
  } catch (error) {
    const timedOut = isTimeBudgetError(error);
    const message = timedOut ? TIME_BUDGET_MESSAGE : error instanceof Error ? error.message : String(error);
    console.error("generate-detail-image error:", message);
    if (assetId) {
      await admin
        .from("generated_assets")
        .update({ generation_status: "failed", error_message: message.slice(0, 1000) })
        .eq("id", assetId);
    }
    if (userId && pageId) {
      await logAiUsage(admin, {
        userId, feature: "detail_image", status: "failed", provider: provider?.name, detailPageId: pageId,
        imageType: requestedType, latencyMs: Date.now() - startedAt, error: message,
      });
    }
    // timedOut: 시간 예산 초과(생성 자체는 정상) → 프론트가 한 번 자동으로 다시 요청한다.
    return json({ error: message, assetId, timedOut }, 502);
  }
});
