import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ScreeningSource = "upload" | "final_design";
type Decision = "clear" | "review" | "blocked";
type RiskLevel = "low" | "medium" | "high";

type RawDetectedMark = {
  displayName?: unknown;
  normalizedName?: unknown;
  confidence?: unknown;
  evidence?: unknown;
  matchType?: unknown;
  isGloballyRecognized?: unknown;
  likelyThirdPartyBrand?: unknown;
};

type DetectedMark = {
  displayName: string;
  normalizedName: string;
  confidence: number;
  evidence: string;
  matchType: "wordmark" | "symbol" | "combined" | "trade_dress" | "unknown";
  isGloballyRecognized: boolean;
  likelyThirdPartyBrand: boolean;
};

type KiprisMatch = {
  query: string;
  trademarkName: string | null;
  applicationNumber: string | null;
  registrationNumber: string | null;
  applicationStatus: string | null;
  applicantName: string | null;
  classification: string | null;
  imageUrl: string | null;
  exactNameMatch: boolean;
  apparelClassMatch: boolean;
};

const analysisVersion = "brand-er-known-famous-logo-v3";
const supportedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const maximumImageBytes = 10 * 1024 * 1024;
const validMatchTypes = new Set([
  "wordmark",
  "symbol",
  "combined",
  "trade_dress",
]);
const genericSearchTerms = new Set([
  "brand",
  "logo",
  "original",
  "fashion",
  "clothing",
  "apparel",
  "브랜드",
  "로고",
  "오리지널",
  "패션",
]);
const blockedFamousBrandAliases = new Set([
  "nike",
  "나이키",
  "swoosh",
  "스우시",
  "jordan",
  "jumpman",
  "adidas",
  "아디다스",
  "reebok",
  "리복",
  "puma",
  "푸마",
  "newbalance",
  "뉴발란스",
  "underarmour",
  "언더아머",
  "asics",
  "아식스",
  "fila",
  "휠라",
  "vans",
  "반스",
  "converse",
  "컨버스",
  "crocs",
  "크록스",
  "thenorthface",
  "노스페이스",
  "patagonia",
  "파타고니아",
  "arcteryx",
  "아크테릭스",
  "supreme",
  "슈프림",
  "stussy",
  "스투시",
  "carhartt",
  "칼하트",
  "dickies",
  "디키즈",
  "champion",
  "챔피온",
  "stoneisland",
  "스톤아일랜드",
  "moncler",
  "몽클레르",
  "canadagoose",
  "캐나다구스",
  "lacoste",
  "라코스테",
  "poloralphlauren",
  "ralphlauren",
  "폴로랄프로렌",
  "tommyhilfiger",
  "타미힐피거",
  "calvinklein",
  "캘빈클라인",
  "levis",
  "리바이스",
  "diesel",
  "디젤",
  "gucci",
  "구찌",
  "prada",
  "프라다",
  "louisvuitton",
  "루이비통",
  "chanel",
  "샤넬",
  "dior",
  "디올",
  "hermes",
  "에르메스",
  "balenciaga",
  "발렌시아가",
  "burberry",
  "버버리",
  "celine",
  "fendi",
  "versace",
  "givenchy",
  "saintlaurent",
  "ysl",
  "valentino",
  "bottegaveneta",
  "loewe",
  "miumiu",
  "maisonmargiela",
  "commedesgarcons",
  "chromehearts",
  "크롬하츠",
  "offwhite",
  "오프화이트",
  "bape",
  "abathingape",
  "베이프",
  "newera",
  "뉴에라",
  "mlb",
  "메이저리그베이스볼",
  "descente",
  "데상트",
  "discoveryexpedition",
  "디스커버리익스페디션",
  "nationalgeographic",
  "내셔널지오그래픽",
  "gentlemonster",
  "젠틀몬스터",
  "adererror",
  "아더에러",
  "thisisneverthat",
  "디스이즈네버댓",
  "matinkim",
  "마뗑킴",
  "마땡킴",
  "mardimercredi",
  "마르디메크르디",
  "musinsastandard",
  "무신사스탠다드",
  "covernat",
  "커버낫",
  "kirsh",
  "키르시",
  "emis",
  "이미스",
  "marithefrancoisgirbaud",
  "마리떼프랑소와저버",
  "anderssonbell",
  "앤더슨벨",
  "wooyoungmi",
  "우영미",
  "apple",
  "애플",
  "cocacola",
  "코카콜라",
  "disney",
  "디즈니",
  "marvel",
  "마블",
]);

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseJsonResponse = (text: string) => {
  const normalized = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
  return JSON.parse(normalized);
};

const clampConfidence = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.min(1, Math.max(0, parsed));
};

const cleanText = (value: unknown, maximum = 180) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);

const normalizeSearchName = (value: unknown) =>
  cleanText(value, 80)
    .replace(/[®™©]/g, "")
    .replace(/[^\p{L}\p{N}\s&._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const comparableName = (value: string) =>
  value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const decodeBase64 = (value: string) => {
  const clean = value.replace(/^data:image\/[^;]+;base64,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }
  return btoa(binary);
};

const hashBytes = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const isTrustedStorageImageUrl = (value: string, supabaseUrl: string) => {
  try {
    const imageUrl = new URL(value);
    const projectUrl = new URL(supabaseUrl);
    return (
      imageUrl.protocol === "https:" &&
      imageUrl.origin === projectUrl.origin &&
      imageUrl.pathname.startsWith("/storage/v1/object/")
    );
  } catch {
    return false;
  }
};

const readImageBytes = async (response: Response) => {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maximumImageBytes) {
    throw new Error("10MB 이하 이미지만 검수할 수 있습니다.");
  }

  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalLength += value.length;
    if (totalLength > maximumImageBytes) {
      await reader.cancel();
      throw new Error("10MB 이하 이미지만 검수할 수 있습니다.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};

const normalizeMarks = (value: unknown): DetectedMark[] => {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 8)
    .map((item) => {
      const mark = (item || {}) as RawDetectedMark;
      const displayName = cleanText(mark.displayName, 100);
      const normalizedName = normalizeSearchName(mark.normalizedName) ||
        normalizeSearchName(displayName);
      const rawMatchType = cleanText(mark.matchType, 30);

      return {
        displayName: displayName || normalizedName || "식별되지 않은 표지",
        normalizedName,
        confidence: clampConfidence(mark.confidence),
        evidence: cleanText(mark.evidence, 240),
        matchType: validMatchTypes.has(rawMatchType)
          ? rawMatchType as DetectedMark["matchType"]
          : "unknown",
        isGloballyRecognized: Boolean(mark.isGloballyRecognized),
        likelyThirdPartyBrand: Boolean(mark.likelyThirdPartyBrand),
      };
    })
    .filter((mark) => mark.displayName || mark.normalizedName);
};

const normalizeRecognizedText = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, 100))
        .filter((item) => item.length >= 2),
    ),
  ).slice(0, 12);
};

const analyzeImage = async (
  bytes: Uint8Array,
  mimeType: string,
  geminiApiKey: string,
) => {
  const prompt = `
You are a conservative visual brand-safety analyst for a Korean apparel
manufacturing platform. Inspect the supplied image only. Identify visible
words, wordmarks, symbols, monograms, emblems, signature product patterns,
or trade dress that could identify a brand.

Return JSON only:
{
  "hasBrandIdentifier": true,
  "detectedMarks": [
    {
      "displayName": "name shown to a Korean reviewer",
      "normalizedName": "best official brand/search name",
      "confidence": 0.0,
      "evidence": "short Korean visual explanation",
      "matchType": "wordmark | symbol | combined | trade_dress | unknown",
      "isGloballyRecognized": false,
      "likelyThirdPartyBrand": false
    }
  ],
  "recognizedText": ["all legible words"],
  "summary": "short Korean summary"
}

Rules:
- Do not call a generic geometric shape, ordinary word, decorative pattern,
  illustration, character, or photograph a known brand without specific visual
  evidence.
- Set likelyThirdPartyBrand=true only when the image is likely reproducing or
  closely imitating an identifiable existing brand, not merely because it
  contains a logo-like original design.
- Treat Korean domestic fashion brands as existing third-party brands too.
  For example, normalize MATIN KIM or 마뗑킴 to "MATIN KIM".
- Recognize well-known logos even when the brand name is removed, recolored,
  rotated, partially hidden, or slightly altered.
- Set isGloballyRecognized=true for a brand widely recognized in South Korea
  or internationally, despite the field name.
- Do not determine legal infringement and do not assume who owns the image.
- If no identifiable mark exists, return an empty detectedMarks array.
`.trim();
  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: bytesToBase64(bytes),
              mimeType,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.05,
    },
  });
  const models = ["gemini-3-flash-preview", "gemini-3-pro-preview"];
  let lastError = "이미지 분석 모델이 응답하지 않았습니다.";

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    );
    if (!response.ok) {
      lastError = `Gemini ${model} 오류 (${response.status})`;
      continue;
    }

    const payload = await response.json();
    const text = (payload?.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();
    if (!text) continue;

    try {
      const parsed = parseJsonResponse(text);
      return {
        marks: normalizeMarks(parsed?.detectedMarks),
        recognizedText: normalizeRecognizedText(parsed?.recognizedText),
        summary: cleanText(parsed?.summary, 300),
        raw: parsed,
      };
    } catch {
      lastError = "상표 검수 분석 결과를 해석하지 못했습니다.";
    }
  }

  throw new Error(lastError);
};

const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const extractXmlValues = (xml: string, names: string[]) => {
  for (const name of names) {
    const expression = new RegExp(
      `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,
      "gi",
    );
    const values = Array.from(xml.matchAll(expression))
      .map((match) => decodeXml(match[1] || ""))
      .filter(Boolean);
    if (values.length) return values;
  }
  return [];
};

const searchKipris = async (
  query: string,
  serviceKey: string,
): Promise<KiprisMatch[]> => {
  const url = new URL(
    "https://plus.kipris.or.kr/kipo-api/kipi/trademarkInfoSearchService/getWordSearch",
  );
  url.searchParams.set("searchString", query);
  url.searchParams.set("searchRecentYear", "0");
  url.searchParams.set("ServiceKey", serviceKey);

  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`KIPRIS 응답 오류 (${response.status})`);
  }

  const xml = await response.text();
  const [resultCode] = extractXmlValues(xml, ["resultCode"]);
  if (resultCode && !/^0+$/.test(resultCode)) {
    throw new Error("KIPRIS가 검색 요청을 처리하지 못했습니다.");
  }

  const applicationNumbers = extractXmlValues(xml, [
    "applicationNumber",
    "ApplicationNumber",
  ]);
  const registrationNumbers = extractXmlValues(xml, [
    "registrationNumber",
    "registerNumber",
  ]);
  const trademarkNames = extractXmlValues(xml, [
    "trademarkName",
    "title",
    "markName",
  ]);
  const statuses = extractXmlValues(xml, [
    "applicationStatus",
    "legalStatus",
    "status",
  ]);
  const applicants = extractXmlValues(xml, [
    "applicantName",
    "rightHolderName",
  ]);
  const classifications = extractXmlValues(xml, [
    "classificationCode",
    "classification",
    "classNumber",
  ]);
  const imageUrls = extractXmlValues(xml, [
    "drawing",
    "imagePath",
    "sampleImage",
  ]);
  const count = Math.min(
    10,
    Math.max(
      applicationNumbers.length,
      registrationNumbers.length,
      trademarkNames.length,
    ),
  );
  const queryComparable = comparableName(query);
  const matches: KiprisMatch[] = [];

  for (let index = 0; index < count; index += 1) {
    const trademarkName = trademarkNames[index] || null;
    const classification = classifications[index] || null;
    const status = statuses[index] || null;
    if (
      status &&
      /거절|취하|포기|소멸|취소|무효|rejected|withdrawn|expired|cancelled/i
        .test(status)
    ) {
      continue;
    }

    matches.push({
      query,
      trademarkName,
      applicationNumber: applicationNumbers[index] || null,
      registrationNumber: registrationNumbers[index] || null,
      applicationStatus: status,
      applicantName: applicants[index] || null,
      classification,
      imageUrl: imageUrls[index] || null,
      exactNameMatch: Boolean(trademarkName) &&
        comparableName(trademarkName || "") === queryComparable,
      apparelClassMatch: Boolean(
        classification &&
          /(^|[^\d])25([^\d]|$)|의류|피복|clothing|apparel/i.test(
            classification,
          ),
      ),
    });
  }

  return matches;
};

const buildSearchTerms = (marks: DetectedMark[], recognizedText: string[]) =>
  Array.from(
    new Set(
      [
        ...marks.map((mark) => mark.normalizedName),
        ...recognizedText,
      ]
        .map(normalizeSearchName)
        .filter((term) => {
          const comparable = comparableName(term);
          return (
            comparable.length >= 2 &&
            !genericSearchTerms.has(term.toLocaleLowerCase())
          );
        }),
    ),
  ).slice(0, 4);

const resolveDecision = (
  marks: DetectedMark[],
  recognizedText: string[],
  kiprisMatches: KiprisMatch[],
) => {
  const knownBrandText = recognizedText.find((text) =>
    blockedFamousBrandAliases.has(comparableName(text))
  );
  const knownBrandMark = marks.find(
    (mark) =>
      (
        blockedFamousBrandAliases.has(comparableName(mark.normalizedName)) ||
        blockedFamousBrandAliases.has(comparableName(mark.displayName))
      ) &&
      mark.confidence >= 0.65,
  );
  const modelConfirmedFamousMark = marks.find(
    (mark) =>
      mark.isGloballyRecognized &&
      mark.likelyThirdPartyBrand &&
      comparableName(mark.normalizedName).length >= 3 &&
      mark.confidence >= 0.9,
  );
  const blockedMark = knownBrandMark || modelConfirmedFamousMark;

  if (knownBrandText || blockedMark) {
    const name = knownBrandText || blockedMark?.displayName ||
      "유명 브랜드 표지";
    return {
      decision: "blocked" as Decision,
      riskLevel: "high" as RiskLevel,
      reason:
        `${name} 등 정확히 식별된 유명 브랜드 로고 또는 매우 유사한 표지가 감지되어 이미지 적용을 차단했습니다.`,
    };
  }

  const exactApparelMatch = kiprisMatches.find(
    (match) => match.exactNameMatch && match.apparelClassMatch,
  );
  if (exactApparelMatch || marks.length > 0 || kiprisMatches.length > 0) {
    const name = exactApparelMatch?.trademarkName ||
      marks[0]?.displayName ||
      kiprisMatches[0]?.trademarkName;
    return {
      decision: "clear" as Decision,
      riskLevel: "low" as RiskLevel,
      reason: `${
        name ? `${name} 관련 ` : ""
      }일반 상표·브랜드 표지로 감지되어 우선 승인되었습니다. 감지 기록은 관리자 확인용으로 보관됩니다.`,
    };
  }

  return {
    decision: "clear" as Decision,
    riskLevel: "low" as RiskLevel,
    reason: "식별 가능한 제3자 상표나 브랜드 로고가 감지되지 않았습니다.",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "지원하지 않는 요청입니다." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const kiprisServiceKey = Deno.env.get("KIPRIS_SERVICE_KEY") || "";
    const authorization = req.headers.get("Authorization") || "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiApiKey) {
      return jsonResponse(
        { error: "상표 검수 서버 설정이 완료되지 않았습니다." },
        500,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "로그인이 필요합니다." }, 401);
    }

    const requestData = await req.json();
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const source = requestData?.source === "upload"
      ? "upload" as ScreeningSource
      : requestData?.source === "final_design"
      ? "final_design" as ScreeningSource
      : null;
    if (!source) {
      return jsonResponse({ error: "올바르지 않은 검수 유형입니다." }, 400);
    }

    let mimeType = cleanText(requestData?.mimeType, 80);
    let bytes: Uint8Array;
    let imageUrl: string | null = null;

    if (requestData?.imageBase64) {
      if (!supportedMimeTypes.has(mimeType)) {
        return jsonResponse({ error: "지원하지 않는 이미지 형식입니다." }, 400);
      }
      bytes = decodeBase64(String(requestData.imageBase64));
    } else if (requestData?.imageUrl) {
      imageUrl = String(requestData.imageUrl);
      if (!isTrustedStorageImageUrl(imageUrl, supabaseUrl)) {
        return jsonResponse(
          { error: "허용된 이미지 저장소의 파일만 검수할 수 있습니다." },
          400,
        );
      }
      const imageResponse = await fetch(imageUrl, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!imageResponse.ok) {
        return jsonResponse(
          { error: "검수할 이미지를 불러오지 못했습니다." },
          400,
        );
      }
      mimeType = (imageResponse.headers.get("content-type") || "image/jpeg")
        .split(";")[0]
        .trim();
      if (!supportedMimeTypes.has(mimeType)) {
        return jsonResponse({ error: "지원하지 않는 이미지 형식입니다." }, 400);
      }
      bytes = await readImageBytes(imageResponse);
    } else {
      return jsonResponse({ error: "검수할 이미지가 없습니다." }, 400);
    }

    if (bytes.length === 0 || bytes.length > maximumImageBytes) {
      return jsonResponse(
        { error: "10MB 이하 이미지만 검수할 수 있습니다." },
        400,
      );
    }

    const imageSha256 = await hashBytes(bytes);
    let cacheQuery = adminClient
      .from("trademark_screenings")
      .select("*")
      .eq("user_id", user.id)
      .eq("image_sha256", imageSha256)
      .eq("source", source)
      .eq("analysis_version", analysisVersion);
    cacheQuery = imageUrl
      ? cacheQuery.eq("image_url", imageUrl)
      : cacheQuery.is("image_url", null);
    const { data: cached } = await cacheQuery.maybeSingle();
    if (cached) {
      return jsonResponse({
        screening: {
          ...cached,
          disclaimer:
            "유명 브랜드 로고 차단을 위한 자동 선별이며 감지 기록은 관리자 확인용으로 보관됩니다.",
        },
        cached: true,
      });
    }

    const analysis = await analyzeImage(bytes, mimeType, geminiApiKey);
    const searchTerms = buildSearchTerms(
      analysis.marks,
      analysis.recognizedText,
    );
    const kiprisMatches: KiprisMatch[] = [];
    let kiprisChecked = false;

    if (kiprisServiceKey && searchTerms.length > 0) {
      const results = await Promise.allSettled(
        searchTerms.map((term) => searchKipris(term, kiprisServiceKey)),
      );
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          kiprisChecked = true;
          kiprisMatches.push(...result.value);
        }
      });
    }

    const resolved = resolveDecision(
      analysis.marks,
      analysis.recognizedText,
      kiprisMatches,
    );
    const { data: saved, error: saveError } = await adminClient
      .from("trademark_screenings")
      .insert({
        user_id: user.id,
        image_sha256: imageSha256,
        image_url: imageUrl,
        source,
        decision: resolved.decision,
        risk_level: resolved.riskLevel,
        detected_marks: analysis.marks,
        recognized_text: analysis.recognizedText,
        kipris_checked: kiprisChecked,
        kipris_matches: kiprisMatches.slice(0, 20),
        reason: resolved.reason,
        analysis_version: analysisVersion,
      })
      .select("*")
      .single();
    if (saveError || !saved) {
      console.error("Trademark screening save failed", saveError);
      return jsonResponse(
        { error: "상표 검수 결과를 저장하지 못했습니다." },
        500,
      );
    }

    return jsonResponse({
      screening: {
        ...saved,
        disclaimer:
          "유명 브랜드 로고 차단을 위한 자동 선별이며 감지 기록은 관리자 확인용으로 보관됩니다.",
      },
      cached: false,
    });
  } catch (error) {
    console.error("Trademark screening failed", error);
    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : "상표 검수 중 오류가 발생했습니다.",
      },
      500,
    );
  }
});
