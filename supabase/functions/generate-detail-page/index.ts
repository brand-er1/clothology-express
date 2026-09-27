import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logAiUsage, precheckAiUsage } from "../_shared/aiUsage.ts";

/**
 * Writes product detail page (상세페이지) copy from the creator's verified product facts and
 * the generated design image. Returns structured JSON only — the frontend owns layout.
 *
 * Requires the GEMINI_API_KEY secret (already used by analyze-production-estimate).
 * Login is required and each call is metered (ai_usage_precheck / log_ai_usage).
 * Optional body.tone rewrites the same facts in a different voice (section "AI 다시 작성").
 * body.mode = "analyze" returns the AI product analysis + three recommended concepts instead of
 * copy (상품 분석 → 콘셉트 추천). body.analysis (the creator-confirmed analysis) steers the copy.
 * The client sanitizes the result again and falls back to a deterministic writer if this
 * function fails, so it is safe to deploy after the frontend.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const fetchImage = async (url: string) => {
  if (!/^https:\/\//.test(url)) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null;
    const mimeType = (response.headers.get("content-type") || "image/png").split(";")[0];
    if (!mimeType.startsWith("image/")) return null;
    return { data: arrayBufferToBase64(buffer), mimeType };
  } catch {
    return null;
  }
};

const TEMPLATE_TONE: Record<string, string> = {
  minimal: "절제되고 정돈된 패션 쇼핑몰 톤. 짧고 담백한 문장.",
  street: "스트리트 브랜드 톤. 짧고 힘 있는 문장, 자신감 있는 어조.",
  luxury: "고급 에디토리얼 톤. 여유 있고 우아한 문장, 과장 없이.",
  sports: "스포츠 브랜드 톤. 활동성과 움직임을 강조하되 기능성 수치나 성능을 단정하지 않음.",
  casual: "친근하고 밝은 데일리웨어 톤. 편하게 말하듯이.",
  vintage: "빈티지 감성 톤. 시간이 쌓인 듯한 따뜻한 문장, 과장 없이.",
  y2k: "Y2K 감성 톤. 경쾌하고 톡톡 튀는 짧은 문장.",
  emotional: "감성적인 에세이 톤. 부드럽고 서정적인 문장.",
  lookbook: "브랜드 룩북 톤. 시즌 컨셉을 설명하는 절제된 에디토리얼 문장.",
  editorial: "패션 매거진 에디토리얼 톤. 관찰하듯 담백하게, 짧은 문장과 여백.",
  outdoor: "아웃도어 브랜드 톤. 사실을 정리하듯 간결하게, 성능을 단정하지 않음.",
};

const CONCEPT_IDS = ["minimal", "street", "editorial", "luxury", "vintage", "sports", "outdoor", "casual", "y2k", "emotional", "lookbook"];
const PART_IDS = ["collar", "hood", "neckline", "print", "embroidery", "pocket", "zipper", "button", "stitch", "cuff", "hem", "drawstring", "label", "patch"];

const buildAnalysisPrompt = (facts: Record<string, unknown>) => `
당신은 패션 브랜드의 아트 디렉터이자 상품 MD입니다. 첨부된 의류 디자인 이미지(합성 이미지라면 왼쪽=앞면, 오른쪽=뒷면)와
아래 "제작자 입력 정보"를 보고 상세페이지 제작용 상품 분석을 하세요.

규칙:
- 이미지에서 실제로 보이는 것만 적으세요. 보이지 않는 지퍼·포켓·자수·봉제 디테일을 추측해서 넣지 마세요.
- 혼용률, 실제 원단명, 중량(g/m², 온스), 번수, 기능성(방수·발수·흡습속건 등), 인증은 절대 적지 마세요.
  materialGuess 에는 "스웨트 계열로 보임"처럼 추정임이 드러나는 짧은 표현만 쓰세요.
- parts 는 이 목록 중 이미지에서 확인되는 것만: ${PART_IDS.join(", ")}
- concepts 는 이 목록 중 이 상품에 가장 어울리는 3개를 추천 순서대로: ${CONCEPT_IDS.join(", ")}
  서로 다른 분위기(예: 미니멀 / 스트릿 / 에디토리얼)가 되게 고르고, reason 은 40자 이내 한국어 한 문장.
- 모든 텍스트는 한국어, 짧게.

제작자 입력 정보(JSON):
${JSON.stringify(facts, null, 2).slice(0, 5000)}

다음 JSON 형식으로만 답하세요:
{
  "analysis": {
    "category": "의류 카테고리",
    "mainColor": {"name": "메인 컬러명", "hex": "#RRGGBB"},
    "subColors": [{"name": "서브 컬러명", "hex": "#RRGGBB"}],
    "materialGuess": "추정 소재 (추정임을 드러내는 표현)",
    "silhouette": "실루엣",
    "fit": "보이는 핏 (확실하지 않으면 빈 문자열)",
    "designFeatures": ["보이는 디자인 특징"],
    "parts": ["확인되는 디테일 부위 id"],
    "target": "예상 타깃",
    "mood": ["제품 분위기 키워드"],
    "brandMoods": ["어울리는 브랜드 무드"],
    "emphasis": ["상세페이지에서 강조할 특징"]
  },
  "concepts": [{"id": "concept id", "reason": "추천 이유"}]
}
`.trim();

const TONE_OVERRIDE: Record<string, string> = {
  concise: "간결하게: 문장을 짧게, 핵심만.",
  emotional: "감성적으로: 부드럽고 서정적인 표현.",
  professional: "전문적으로: 정확하고 신뢰감 있는 설명 톤.",
  street: "스트릿하게: 짧고 힘 있는 스트리트 브랜드 말투.",
  luxury: "고급스럽게: 여유 있고 우아한 에디토리얼 문장.",
};

const EMPHASIS_LABEL: Record<string, string> = {
  design: "디자인", fit: "핏", fabric: "소재", detail: "디테일", process: "제작과정",
  scarcity: "희소성", price: "가격", brand_story: "브랜드 스토리",
};

const buildPrompt = (source: Record<string, unknown>, template: string, tone: string, emphasis: string[], parts: string[]) => `
당신은 독립 패션 브랜드의 시니어 에디토리얼 카피라이터입니다.
아래 "확인된 제품 정보"와 첨부된 의류 디자인 이미지(왼쪽=앞면, 오른쪽=뒷면)만 근거로
펀딩 상품 상세페이지 문구를 작성하세요.

톤: ${TONE_OVERRIDE[tone] ?? TEMPLATE_TONE[template] ?? TEMPLATE_TONE.minimal}
${emphasis.length ? `강조할 요소(이 순서로 비중을 높이세요, 단 사실 근거가 있는 범위에서만): ${emphasis.join(", ")}` : ""}

절대 규칙:
- 확인된 제품 정보나 이미지에서 확인할 수 없는 사실을 만들지 마세요.
- 원단 혼용률(예: 면 100%), 중량(g/m², 온스), 번수, 기능성(방수, 발수, 흡습속건, 냉감, 항균, UV 차단 등),
  인증(KC, OEKO-TEX, 오가닉 등), 특허, 원산지 표기는 "확인된 제품 정보"에 명시된 경우에만 쓰세요.
- 가격, 할인, 배송 날짜, 수량을 숫자로 약속하지 마세요.
- 이미지에 보이는 디자인 요소(프린트, 자수, 포켓, 절개, 부자재 등)는 설명해도 됩니다.
- 브랜드명·제작자명은 주어진 값만 쓰세요.
- 확인이 필요한 정보는 missingInfo 배열에 "질문" 형태로 적으세요.
- 모든 문구는 한국어(productNameEn만 영어 대문자)로, 이모지와 해시태그 없이 작성하세요.
- 문체: 짧고 절제된 패션 에디토리얼 문체. 제품을 관찰하듯 구체적으로 쓰고, 감탄사와 느낌표를 쓰지 마세요.
- 금지 표현: "최고의 품질", "완벽한 핏", "당신만을 위한", "특별한 당신", "압도적인", "인생템", "놓치지 마세요",
  "지금 바로", "품절 임박" 같은 근거 없는 과장·구매 압박 문구.
- 제품 스토리는 제작자가 입력한 제작 배경·설명에 있는 내용만으로 쓰세요. 브랜드 역사나 사연을 지어내지 마세요.
  제작 배경이 없으면 디자인에서 보이는 사실만으로 1~2문장만 쓰세요.
${parts.length ? `- detailCallouts 의 part 는 이 목록에서만 고르세요(실제 존재가 확인된 부위): ${parts.join(", ")}` : "- 확인된 디테일 부위가 없으므로 detailCallouts 는 빈 배열로 두세요."}

확인된 제품 정보(JSON):
${JSON.stringify(source, null, 2).slice(0, 6000)}

다음 JSON 형식으로만 답하세요:
{
  "productName": "한국어 상품명 (20자 이내)",
  "productNameEn": "ENGLISH PRODUCT NAME",
  "oneLiner": "한 줄 소개 (40자 이내)",
  "mainCopy": "메인 카피 (30자 이내)",
  "story": "제품 스토리/기획 배경 2~4문장",
  "designDescription": "앞면/뒷면 디자인 특징 2~3문장",
  "designPoints": [{"title": "포인트 제목", "text": "1~2문장"}],
  "fabricDescription": "원단 설명 1~2문장 (원단명만 근거로)",
  "fitDescription": "핏/실루엣 설명 1~2문장",
  "colorDescription": "컬러 설명 1~2문장",
  "productionMethod": "제작 방식 설명 1~2문장",
  "styling": ["추천 스타일링 문장", "..."],
  "sizeGuide": "사이즈 안내 1~2문장",
  "care": ["세탁/관리 안내 문장", "..."],
  "fundingGuide": "펀딩 안내 1~2문장",
  "productionSchedule": "제작 일정 안내 1~2문장 (날짜 약속 없이)",
  "shippingGuide": "배송 안내 1문장",
  "notices": ["주의사항 문장", "..."],
  "missingInfo": ["확인이 필요한 질문"],
  "keyMessage": "히어로에 들어갈 짧은 키 메시지 (18자 이내, 마침표 없이)",
  "designHighlights": ["디자인 핵심 문장 (각 30자 이내)"],
  "detailCallouts": [{"part": "부위 id", "text": "그 부위를 설명하는 한 문장 (40자 이내)"}],
  "lookbookCaption": "룩북 캡션 한 줄 (30자 이내)"
}
designHighlights는 1~3개, detailCallouts는 확인된 부위마다 최대 1개, designPoints는 3~5개, styling은 2~3개, care는 2~4개, notices는 3~5개로 작성하세요.
`.trim();

const parseJson = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST만 지원합니다." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  let userId: string | null = null;
  let detailPageId: string | null = null;
  const startedAt = Date.now();

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!geminiApiKey) return json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 503);

    // 로그인한 회원만 호출할 수 있다(anon 키만으로 AI 비용이 발생하지 않도록).
    const authorization = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "로그인이 필요합니다." }, 401);
    userId = userData.user.id;

    const { source = {}, template = "minimal", tone = "", detailPageId: requestedPageId, mode = "copy", analysis = null } = await req.json();
    const analyze = mode === "analyze";
    if (typeof requestedPageId === "string") {
      const { data: page } = await admin.from("product_detail_pages").select("id, user_id").eq("id", requestedPageId).maybeSingle();
      if (page && page.user_id === userId) detailPageId = page.id as string;
    }

    const quota = await precheckAiUsage(admin, userId, "detail_copy", detailPageId);
    if (!quota.allowed) return json({ error: quota.reason ?? "AI 문구 생성 한도를 초과했습니다.", quotaExceeded: true }, 429);

    const provided = source.userProvided ?? {};
    const emphasis = (Array.isArray(provided.emphasis) ? provided.emphasis : [])
      .map((key: string) => EMPHASIS_LABEL[key])
      .filter(Boolean);
    const facts = {
      의류종류: source.clothType,
      원단: source.material,
      원단혼용률_작성자입력: source.userProvided?.composition || undefined,
      색상: source.userProvided?.colorName || source.color,
      핏: source.fit || source.userProvided?.fitNote,
      디자인설명: source.designDescription,
      디자인옵션: source.styleOptions,
      프린팅_자수_장식: source.decorations,
      부자재: source.accessories,
      구성요소: source.constructionFeatures,
      제작방식: source.productionMethod,
      사이즈: source.sizeOptions,
      제작배경_작성자입력: source.userProvided?.background || undefined,
      추천대상_작성자입력: source.userProvided?.targetCustomer || undefined,
      관리메모_작성자입력: source.userProvided?.careNote || undefined,
      한줄소개_작성자입력: provided.oneLiner || undefined,
      강조특징_작성자입력: provided.highlights || undefined,
      디테일_작성자입력: provided.details || undefined,
      제작방식_작성자입력: provided.productionNote || undefined,
      상세페이지무드_작성자입력: provided.mood || undefined,
      원단중량_작성자입력: provided.fabricWeight || undefined,
      원단촉감_작성자입력: provided.fabricHand || undefined,
      신축성_작성자입력: provided.fabricStretch || undefined,
      두께_작성자입력: provided.fabricThickness || undefined,
      AI분석_제작자확인: analysis && typeof analysis === "object"
        ? {
            디자인특징: (analysis as Record<string, unknown>).designFeatures,
            실루엣: (analysis as Record<string, unknown>).silhouette,
            분위기: (analysis as Record<string, unknown>).mood,
            강조점: (analysis as Record<string, unknown>).emphasis,
          }
        : undefined,
      브랜드명: source.brandName,
      브랜드소개: source.brandShortDescription || source.brandDescription,
      제작자명: source.creatorName,
    };

    const image = typeof source.imageUrl === "string" ? await fetchImage(source.imageUrl) : null;
    const confirmedParts = (analysis && typeof analysis === "object" && Array.isArray((analysis as Record<string, unknown>).parts)
      ? ((analysis as Record<string, unknown>).parts as unknown[])
      : []
    ).filter((part): part is string => typeof part === "string" && PART_IDS.includes(part));
    const promptText = analyze
      ? buildAnalysisPrompt(facts)
      : buildPrompt(facts, String(template), String(tone), emphasis, confirmedParts);
    const parts: Array<Record<string, unknown>> = [{ text: promptText }];
    if (image) parts.push({ inlineData: image });

    const body = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: analyze ? 0.3 : 0.6 },
    });

    const models = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-3-pro-preview"];
    const errors: string[] = [];
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
      );
      if (!response.ok) {
        errors.push(`${model}: ${response.status}`);
        if (![400, 404, 429, 500, 503].includes(response.status)) break;
        continue;
      }
      const data = await response.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((part: { text?: string }) => part.text || "")
        .join("")
        .trim();
      if (!text) {
        errors.push(`${model}: empty`);
        continue;
      }
      try {
        const parsed = parseJson(text);
        if (analyze && (!parsed || typeof parsed.analysis !== "object")) throw new Error("no analysis");
        await logAiUsage(admin, {
          userId, feature: "detail_copy", status: "success", provider: "gemini", model, detailPageId,
          latencyMs: Date.now() - startedAt, metadata: { mode: analyze ? "analyze" : "copy", tone: tone || null, template },
        });
        if (analyze) return json({ analysis: parsed.analysis, concepts: parsed.concepts ?? [], model, usedImage: Boolean(image) });
        return json({ copy: parsed, model, usedImage: Boolean(image) });
      } catch {
        errors.push(`${model}: invalid ${analyze ? "analysis" : "json"}`);
      }
    }
    const failure = `AI ${analyze ? "상품 분석" : "문구 생성"} 실패 (${errors.join(", ")})`;
    await logAiUsage(admin, {
      userId, feature: "detail_copy", status: "failed", provider: "gemini", detailPageId,
      latencyMs: Date.now() - startedAt, error: failure,
    });
    return json({ error: failure }, 502);
  } catch (error) {
    console.error("generate-detail-page error:", error);
    if (userId) {
      await logAiUsage(admin, {
        userId, feature: "detail_copy", status: "failed", provider: "gemini", detailPageId,
        latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error),
      });
    }
    return json({ error: error instanceof Error ? error.message : "알 수 없는 오류" }, 500);
  }
});
