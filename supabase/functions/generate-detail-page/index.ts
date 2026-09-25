import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Writes product detail page (상세페이지) copy from the creator's verified product facts and
 * the generated design image. Returns structured JSON only — the frontend owns layout.
 *
 * Requires the GEMINI_API_KEY secret (already used by analyze-production-estimate).
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
};

const buildPrompt = (source: Record<string, unknown>, template: string) => `
당신은 한국 패션 브랜드 쇼핑몰의 시니어 카피라이터입니다.
아래 "확인된 제품 정보"와 첨부된 의류 디자인 이미지(왼쪽=앞면, 오른쪽=뒷면)만 근거로
펀딩 상품 상세페이지 문구를 작성하세요.

톤: ${TEMPLATE_TONE[template] ?? TEMPLATE_TONE.minimal}

절대 규칙:
- 확인된 제품 정보나 이미지에서 확인할 수 없는 사실을 만들지 마세요.
- 원단 혼용률(예: 면 100%), 중량(g/m², 온스), 번수, 기능성(방수, 발수, 흡습속건, 냉감, 항균, UV 차단 등),
  인증(KC, OEKO-TEX, 오가닉 등), 특허, 원산지 표기는 "확인된 제품 정보"에 명시된 경우에만 쓰세요.
- 가격, 할인, 배송 날짜, 수량을 숫자로 약속하지 마세요.
- 이미지에 보이는 디자인 요소(프린트, 자수, 포켓, 절개, 부자재 등)는 설명해도 됩니다.
- 브랜드명·제작자명은 주어진 값만 쓰세요.
- 확인이 필요한 정보는 missingInfo 배열에 "질문" 형태로 적으세요.
- 모든 문구는 한국어(productNameEn만 영어 대문자)로, 이모지와 해시태그 없이 작성하세요.

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
  "missingInfo": ["확인이 필요한 질문"]
}
designPoints는 3~5개, styling은 2~3개, care는 2~4개, notices는 3~5개로 작성하세요.
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

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!geminiApiKey) return json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, 503);

    const { source = {}, template = "minimal" } = await req.json();
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
      브랜드명: source.brandName,
      브랜드소개: source.brandShortDescription || source.brandDescription,
      제작자명: source.creatorName,
    };

    const image = typeof source.imageUrl === "string" ? await fetchImage(source.imageUrl) : null;
    const parts: Array<Record<string, unknown>> = [{ text: buildPrompt(facts, String(template)) }];
    if (image) parts.push({ inlineData: image });

    const body = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.6 },
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
        return json({ copy: parseJson(text), model, usedImage: Boolean(image) });
      } catch {
        errors.push(`${model}: invalid json`);
      }
    }
    return json({ error: `AI 문구 생성 실패 (${errors.join(", ")})` }, 502);
  } catch (error) {
    console.error("generate-detail-page error:", error);
    return json({ error: error instanceof Error ? error.message : "알 수 없는 오류" }, 500);
  }
});
