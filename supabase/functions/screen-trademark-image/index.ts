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
type AnalysisStatus = "completed" | "unavailable";
type MarkSource = "visual" | "upload";
type CandidateType = "text" | "symbol" | "pattern" | "combined" | "unknown";
type NormalizationMethod =
  | "original"
  | "rotation"
  | "mirror"
  | "perspective"
  | "wrinkle"
  | "low_resolution";

type SimilarityScores = {
  text: number;
  shape: number;
  color: number;
  placement: number;
  productClass: number;
  transformation: number;
  composite: number;
};

type CandidateRegion = {
  id: string;
  label: string;
  candidateType: CandidateType;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  evidence: string;
};

type NormalizationResult = {
  method: NormalizationMethod;
  similarity: number;
  evidence: string;
};

type RawDetectedMark = {
  displayName?: unknown;
  normalizedName?: unknown;
  confidence?: unknown;
  evidence?: unknown;
  matchType?: unknown;
  isGloballyRecognized?: unknown;
  likelyThirdPartyBrand?: unknown;
  candidateRegionId?: unknown;
  similarityScores?: unknown;
  normalizationResults?: unknown;
};

type DetectedMark = {
  displayName: string;
  normalizedName: string;
  confidence: number;
  evidence: string;
  matchType: "wordmark" | "symbol" | "combined" | "trade_dress" | "unknown";
  isGloballyRecognized: boolean;
  likelyThirdPartyBrand: boolean;
  candidateRegionId: string | null;
  source: MarkSource;
  normalizationResults: NormalizationResult[];
  similarityScores: SimilarityScores;
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

const analysisVersion = "brand-er-composite-trademark-v5";
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
const validCandidateTypes = new Set([
  "text",
  "symbol",
  "pattern",
  "combined",
]);
const validNormalizationMethods = new Set([
  "original",
  "rotation",
  "mirror",
  "perspective",
  "wrinkle",
  "low_resolution",
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

const clampScore = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.min(100, Math.max(0, parsed)));
};

const emptySimilarityScores = (): SimilarityScores => ({
  text: 0,
  shape: 0,
  color: 0,
  placement: 0,
  productClass: 0,
  transformation: 0,
  composite: 0,
});

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

const normalizeUuid = (value: unknown) => {
  const normalized = cleanText(value, 40);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(normalized)
    ? normalized
    : null;
};

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

const normalizeCandidateRegions = (value: unknown): CandidateRegion[] => {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 12).map((item, index) => {
    const region = (item || {}) as Record<string, unknown>;
    const box = (region.boundingBox || {}) as Record<string, unknown>;
    const rawType = cleanText(region.candidateType, 30);
    const x = Math.min(99, clampScore(box.x));
    const y = Math.min(99, clampScore(box.y));
    const width = Math.min(100 - x, Math.max(1, clampScore(box.width, 1)));
    const height = Math.min(100 - y, Math.max(1, clampScore(box.height, 1)));

    return {
      id: cleanText(region.id, 50) || `region-${index + 1}`,
      label: cleanText(region.label, 100) || `후보영역 ${index + 1}`,
      candidateType: validCandidateTypes.has(rawType)
        ? rawType as CandidateType
        : "unknown",
      boundingBox: { x, y, width, height },
      confidence: clampConfidence(region.confidence),
      evidence: cleanText(region.evidence, 240),
    };
  });
};

const normalizeSimilarityScores = (value: unknown): SimilarityScores => {
  const scores = (value || {}) as Record<string, unknown>;
  return {
    text: clampScore(scores.text),
    shape: clampScore(scores.shape),
    color: clampScore(scores.color),
    placement: clampScore(scores.placement),
    productClass: clampScore(scores.productClass),
    transformation: clampScore(scores.transformation),
    composite: clampScore(scores.composite),
  };
};

const normalizeTransformations = (value: unknown): NormalizationResult[] => {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 12).map((item) => {
    const result = (item || {}) as Record<string, unknown>;
    const rawMethod = cleanText(result.method, 30);
    return {
      method: validNormalizationMethods.has(rawMethod)
        ? rawMethod as NormalizationMethod
        : "original",
      similarity: clampScore(result.similarity),
      evidence: cleanText(result.evidence, 200),
    };
  });
};

const normalizeMarks = (
  value: unknown,
  candidateRegions: CandidateRegion[],
  source: MarkSource = "visual",
): DetectedMark[] => {
  if (!Array.isArray(value)) return [];

  const regionIds = new Set(candidateRegions.map((region) => region.id));
  return value
    .slice(0, 8)
    .map((item) => {
      const mark = (item || {}) as RawDetectedMark;
      const displayName = cleanText(mark.displayName, 100);
      const normalizedName = normalizeSearchName(mark.normalizedName) ||
        normalizeSearchName(displayName);
      const rawMatchType = cleanText(mark.matchType, 30);
      const rawRegionId = cleanText(mark.candidateRegionId, 50);
      const normalizationResults = normalizeTransformations(
        mark.normalizationResults,
      );
      const similarityScores = normalizeSimilarityScores(mark.similarityScores);
      similarityScores.transformation = Math.max(
        similarityScores.transformation,
        ...normalizationResults.map((result) => result.similarity),
      );

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
        candidateRegionId: regionIds.has(rawRegionId) ? rawRegionId : null,
        source,
        normalizationResults,
        similarityScores,
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
  source: ScreeningSource,
  selectedType: string,
  selectedMaterial: string,
) => {
  const prompt = `
You are a conservative visual brand-safety analyst for a Korean apparel
manufacturing platform. Inspect the supplied ${
    source === "upload" ? "user-uploaded artwork" : "completed apparel design"
  }.
The selected garment category is "${selectedType || "unspecified"}" and the
material is "${selectedMaterial || "unspecified"}".

First locate possible trademark regions inside the image. Then compare each
candidate as originally shown and under plausible normalization hypotheses for
rotation, horizontal mirroring, perspective distortion, fabric wrinkles, and
low resolution. Score text, shape, color, and placement separately. Identify
visible words, wordmarks, symbols, monograms, emblems, signature product
patterns, or trade dress that could identify a brand.

Return JSON only:
{
  "hasBrandIdentifier": true,
  "candidateRegions": [
    {
      "id": "region-1",
      "label": "short Korean label",
      "candidateType": "text | symbol | pattern | combined | unknown",
      "boundingBox": {
        "x": 0,
        "y": 0,
        "width": 0,
        "height": 0
      },
      "confidence": 0.0,
      "evidence": "short Korean reason"
    }
  ],
  "detectedMarks": [
    {
      "displayName": "name shown to a Korean reviewer",
      "normalizedName": "best official brand/search name",
      "confidence": 0.0,
      "evidence": "short Korean visual explanation",
      "matchType": "wordmark | symbol | combined | trade_dress | unknown",
      "isGloballyRecognized": false,
      "likelyThirdPartyBrand": false,
      "candidateRegionId": "region-1",
      "similarityScores": {
        "text": 0,
        "shape": 0,
        "color": 0,
        "placement": 0
      },
      "normalizationResults": [
        {
          "method": "original | rotation | mirror | perspective | wrinkle | low_resolution",
          "similarity": 0,
          "evidence": "short Korean comparison reason"
        }
      ]
    }
  ],
  "recognizedText": ["all legible words"],
  "summary": "short Korean summary"
}

Rules:
- All boundingBox and similarity score values must be integers from 0 to 100.
- Bounding boxes use image-relative percentages from the top-left corner.
- Return candidateRegions for logo-like text, symbols, and repeating patterns
  even when they are ultimately judged original or non-famous.
- For each detected mark, include an "original" normalization result and only
  add other methods when that hypothesis materially affects recognition.
- Score visual similarity to the best identifiable existing mark, not generic
  logo-likeness. Use a low score when no specific comparison target exists.
- Do not call a generic geometric shape, ordinary word, decorative pattern,
  illustration, character, or photograph a known brand without specific visual
  evidence.
- A logo-like appearance alone is never enough to identify a famous brand.
- When the brand identity is uncertain, ambiguous, or hard to analyze, keep the
  candidate region but return an empty detectedMarks array. The platform will
  approve uncertain images.
- Set likelyThirdPartyBrand=true only when the image is likely reproducing or
  closely imitating an identifiable existing brand, not merely because it
  contains a logo-like original design.
- Include a famous-brand wordmark in detectedMarks instead of reporting it only
  in recognizedText.
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
      const candidateRegions = normalizeCandidateRegions(
        parsed?.candidateRegions,
      );
      return {
        candidateRegions,
        marks: normalizeMarks(
          parsed?.detectedMarks,
          candidateRegions,
        ),
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

const hasFamousBrandAlias = (mark: DetectedMark) =>
  blockedFamousBrandAliases.has(comparableName(mark.normalizedName)) ||
  blockedFamousBrandAliases.has(comparableName(mark.displayName));

const addExactFamousWordmarks = (
  marks: DetectedMark[],
  recognizedText: string[],
) => {
  const nextMarks = [...marks];
  recognizedText.forEach((text) => {
    const comparable = comparableName(text);
    if (
      !blockedFamousBrandAliases.has(comparable) ||
      nextMarks.some((mark) =>
        comparableName(mark.normalizedName) === comparable ||
        comparableName(mark.displayName) === comparable
      )
    ) {
      return;
    }
    nextMarks.push({
      displayName: text,
      normalizedName: normalizeSearchName(text),
      confidence: 0.94,
      evidence: "이미지에서 유명 브랜드와 동일한 문자 표기가 선명하게 인식됨",
      matchType: "wordmark",
      isGloballyRecognized: true,
      likelyThirdPartyBrand: true,
      candidateRegionId: null,
      source: "visual",
      normalizationResults: [
        {
          method: "original",
          similarity: 95,
          evidence: "등록·사용 중인 유명 워드마크와 동일한 문자 배열",
        },
      ],
      similarityScores: {
        text: 98,
        shape: 90,
        color: 45,
        placement: 55,
        productClass: 0,
        transformation: 95,
        composite: 0,
      },
    });
  });
  return nextMarks;
};

const mergeUploadPriority = (
  visualMarks: DetectedMark[],
  parentScreening: Record<string, unknown> | null,
) => {
  if (!parentScreening || !Array.isArray(parentScreening.detected_marks)) {
    return { marks: visualMarks, applied: false };
  }

  const uploadMarks = normalizeMarks(
    parentScreening.detected_marks,
    [],
    "upload",
  );
  if (!uploadMarks.length) {
    return { marks: visualMarks, applied: false };
  }

  const merged = [...visualMarks];
  let applied = false;
  uploadMarks.forEach((uploadMark) => {
    const uploadName = comparableName(uploadMark.normalizedName);
    const matchingIndex = merged.findIndex((mark) =>
      uploadName &&
      (
        comparableName(mark.normalizedName) === uploadName ||
        comparableName(mark.displayName) === uploadName
      )
    );
    if (matchingIndex < 0) {
      merged.push(uploadMark);
      applied = true;
      return;
    }

    const visualMark = merged[matchingIndex];
    const mergedScores = emptySimilarityScores();
    (Object.keys(mergedScores) as Array<keyof SimilarityScores>).forEach(
      (key) => {
        mergedScores[key] = Math.max(
          visualMark.similarityScores[key],
          uploadMark.similarityScores[key],
        );
      },
    );
    merged[matchingIndex] = {
      ...visualMark,
      displayName: uploadMark.displayName || visualMark.displayName,
      normalizedName: uploadMark.normalizedName || visualMark.normalizedName,
      confidence: Math.max(visualMark.confidence, uploadMark.confidence),
      evidence: [
        uploadMark.evidence,
        visualMark.evidence,
      ].filter(Boolean).join(" / ").slice(0, 240),
      isGloballyRecognized:
        uploadMark.isGloballyRecognized || visualMark.isGloballyRecognized,
      likelyThirdPartyBrand:
        uploadMark.likelyThirdPartyBrand || visualMark.likelyThirdPartyBrand,
      source: "upload",
      normalizationResults: uploadMark.normalizationResults.length
        ? uploadMark.normalizationResults
        : visualMark.normalizationResults,
      similarityScores: mergedScores,
    };
    applied = true;
  });

  return { marks: merged.slice(0, 8), applied };
};

const scoreMarks = (
  marks: DetectedMark[],
  kiprisMatches: KiprisMatch[],
  selectedType: string,
) =>
  marks.map((mark) => {
    const confidenceScore = Math.round(mark.confidence * 100);
    const markName = comparableName(mark.normalizedName);
    const relatedMatches = kiprisMatches.filter((match) => {
      const query = comparableName(match.query);
      const trademark = comparableName(match.trademarkName || "");
      return Boolean(
        markName &&
        (query === markName || trademark === markName),
      );
    });
    const exactApparelMatch = relatedMatches.some(
      (match) => match.exactNameMatch && match.apparelClassMatch,
    );
    const apparelMatch = relatedMatches.some((match) => match.apparelClassMatch);
    const modelScores = mark.similarityScores;
    const text = modelScores.text || (
      mark.matchType === "wordmark" || mark.matchType === "combined"
        ? confidenceScore
        : Math.round(confidenceScore * 0.25)
    );
    const shape = modelScores.shape || (
      mark.matchType === "symbol" ||
        mark.matchType === "combined" ||
        mark.matchType === "trade_dress"
        ? confidenceScore
        : Math.round(confidenceScore * 0.65)
    );
    const color = modelScores.color || Math.round(confidenceScore * 0.4);
    const placement = modelScores.placement ||
      Math.round(confidenceScore * 0.45);
    const transformation = Math.max(
      modelScores.transformation,
      ...mark.normalizationResults.map((result) => result.similarity),
      Math.round(Math.max(text, shape) * 0.85),
    );
    const productClass = exactApparelMatch
      ? 100
      : apparelMatch
      ? 85
      : selectedType
      ? 55
      : 35;
    const weighted =
      text * 0.25 +
      shape * 0.30 +
      color * 0.08 +
      placement * 0.07 +
      transformation * 0.15 +
      productClass * 0.15;
    const famousBrandBoost =
      hasFamousBrandAlias(mark) || mark.isGloballyRecognized ? 5 : 0;
    const composite = clampScore(
      weighted * (0.85 + mark.confidence * 0.15) + famousBrandBoost,
    );

    return {
      ...mark,
      similarityScores: {
        text,
        shape,
        color,
        placement,
        productClass,
        transformation,
        composite,
      },
    };
  });

const aggregateScores = (marks: DetectedMark[]): SimilarityScores => {
  const aggregated = emptySimilarityScores();
  marks.forEach((mark) => {
    (Object.keys(aggregated) as Array<keyof SimilarityScores>).forEach(
      (key) => {
        aggregated[key] = Math.max(
          aggregated[key],
          mark.similarityScores[key],
        );
      },
    );
  });
  return aggregated;
};

const resolveDecision = (
  marks: DetectedMark[],
  kiprisMatches: KiprisMatch[],
  analysisUnavailable = false,
) => {
  const sortedMarks = [...marks].sort(
    (left, right) =>
      right.similarityScores.composite - left.similarityScores.composite,
  );
  const highestRiskMark = sortedMarks[0] || null;
  const riskScore = highestRiskMark?.similarityScores.composite || 0;
  const exactApparelMatch = kiprisMatches.find(
    (match) => match.exactNameMatch && match.apparelClassMatch,
  );
  const knownBrandMark = sortedMarks.find(
    (mark) =>
      (
        hasFamousBrandAlias(mark) ||
        mark.isGloballyRecognized
      ) &&
      mark.likelyThirdPartyBrand &&
      mark.matchType !== "unknown" &&
      mark.confidence >= 0.85 &&
      mark.similarityScores.composite >= 82,
  );

  if (knownBrandMark) {
    const name = knownBrandMark.displayName || "유명 브랜드 표지";
    return {
      decision: "blocked" as Decision,
      riskLevel: "high" as RiskLevel,
      riskScore,
      reason:
        `${name} 관련 표지가 변형 복원·복합 유사도 분석에서 고위험 기준을 충족해 이미지 적용을 차단했습니다.`,
      factors: [
        `종합 위험점수 ${knownBrandMark.similarityScores.composite}점`,
        `AI 식별 신뢰도 ${Math.round(knownBrandMark.confidence * 100)}%`,
        "국내·해외 유명 브랜드 고위험 기준 충족",
      ],
    };
  }

  if (analysisUnavailable) {
    return {
      decision: "clear" as Decision,
      riskLevel: "low" as RiskLevel,
      riskScore: 0,
      reason:
        "AI가 상표를 확실히 식별하지 못해 우선 승인되었습니다. 감지 실패 기록은 관리자 확인용으로 보관됩니다.",
      factors: ["분석 결과 확정 불가", "불확실 시 우선 승인 정책 적용"],
    };
  }

  const reviewMark = sortedMarks.find(
    (mark) =>
      (
        hasFamousBrandAlias(mark) ||
        mark.isGloballyRecognized
      ) &&
      mark.likelyThirdPartyBrand &&
      mark.confidence >= 0.65 &&
      mark.similarityScores.composite >= 58,
  );
  if (reviewMark) {
    return {
      decision: "review" as Decision,
      riskLevel: "medium" as RiskLevel,
      riskScore,
      reason:
        `${reviewMark.displayName} 관련 유명 브랜드 후보가 감지되었지만 자동 차단 기준에는 미달해 관리자 검토로 전환했습니다.`,
      factors: [
        `종합 위험점수 ${reviewMark.similarityScores.composite}점`,
        `AI 식별 신뢰도 ${Math.round(reviewMark.confidence * 100)}%`,
        "유명 브랜드 후보이나 즉시 차단 기준 미달",
      ],
    };
  }

  if (marks.length > 0 || kiprisMatches.length > 0) {
    const name = exactApparelMatch?.trademarkName ||
      highestRiskMark?.displayName ||
      kiprisMatches[0]?.trademarkName;
    return {
      decision: "clear" as Decision,
      riskLevel: "low" as RiskLevel,
      riskScore,
      reason: `${
        name ? `${name} 관련 ` : ""
      }일반·제3자 표지로 감지되었으나 유명 브랜드 고위험 기준에 해당하지 않아 우선 승인되었습니다.`,
      factors: [
        `종합 위험점수 ${riskScore}점`,
        exactApparelMatch
          ? "의류 상품류 동일·유사 결과 존재"
          : "의류 상품류 확정 결과 없음",
        "유명 브랜드 즉시 차단 기준 미달",
      ],
    };
  }

  return {
    decision: "clear" as Decision,
    riskLevel: "low" as RiskLevel,
    riskScore: 0,
    reason: "식별 가능한 제3자 상표나 브랜드 로고가 감지되지 않았습니다.",
    factors: ["식별 가능한 상표 후보 없음"],
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
    const selectedType = cleanText(requestData?.selectedType, 100);
    const selectedMaterial = cleanText(requestData?.selectedMaterial, 100);
    const parentScreeningId = source === "final_design"
      ? normalizeUuid(requestData?.parentScreeningId)
      : null;
    const previousScreeningId = normalizeUuid(
      requestData?.previousScreeningId,
    );

    let parentScreening: Record<string, unknown> | null = null;
    if (parentScreeningId) {
      const { data } = await adminClient
        .from("trademark_screenings")
        .select("id, user_id, source, detected_marks")
        .eq("id", parentScreeningId)
        .eq("user_id", user.id)
        .eq("source", "upload")
        .maybeSingle();
      parentScreening = data;
    }

    let previousScreening: Record<string, unknown> | null = null;
    if (previousScreeningId) {
      const { data } = await adminClient
        .from("trademark_screenings")
        .select("id, user_id, screening_version")
        .eq("id", previousScreeningId)
        .eq("user_id", user.id)
        .maybeSingle();
      previousScreening = data;
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
    cacheQuery = parentScreening
      ? cacheQuery.eq("parent_screening_id", parentScreening.id)
      : cacheQuery.is("parent_screening_id", null);
    cacheQuery = previousScreening
      ? cacheQuery.eq("supersedes_screening_id", previousScreening.id)
      : cacheQuery.is("supersedes_screening_id", null);
    cacheQuery = imageUrl
      ? cacheQuery.eq("image_url", imageUrl)
      : cacheQuery.is("image_url", null);
    const { data: cached } = await cacheQuery.maybeSingle();
    if (cached) {
      return jsonResponse({
        screening: {
          ...cached,
          disclaimer:
            "자동 분석은 상표권 침해를 확정하지 않으며, 후보영역·복합점수·판정 근거를 관리자 검토용으로 제공합니다.",
        },
        cached: true,
      });
    }

    let analysis: Awaited<ReturnType<typeof analyzeImage>>;
    let analysisUnavailable = false;
    try {
      analysis = await analyzeImage(
        bytes,
        mimeType,
        geminiApiKey,
        source,
        selectedType,
        selectedMaterial,
      );
    } catch (analysisError) {
      analysisUnavailable = true;
      const message = analysisError instanceof Error
        ? analysisError.message
        : "이미지 분석 모델이 결과를 확정하지 못했습니다.";
      console.warn("Trademark analysis unavailable; approving by policy", message);
      analysis = {
        candidateRegions: [],
        marks: [],
        recognizedText: [],
        summary: "AI가 상표를 확실히 식별하지 못해 우선 승인",
        raw: { analysisUnavailable: true, error: message },
      };
    }
    analysis.marks = addExactFamousWordmarks(
      analysis.marks,
      analysis.recognizedText,
    );
    const prioritized = mergeUploadPriority(
      analysis.marks,
      parentScreening,
    );
    analysis.marks = prioritized.marks;
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

    analysis.marks = scoreMarks(
      analysis.marks,
      kiprisMatches,
      selectedType,
    );
    const similarityScores = aggregateScores(analysis.marks);
    const resolved = resolveDecision(
      analysis.marks,
      kiprisMatches,
      analysisUnavailable,
    );
    const { data: saved, error: saveError } = await adminClient
      .from("trademark_screenings")
      .insert({
        user_id: user.id,
        image_sha256: imageSha256,
        image_url: imageUrl,
        source,
        decision: resolved.decision,
        automated_decision: resolved.decision,
        risk_level: resolved.riskLevel,
        analysis_status: analysisUnavailable
          ? "unavailable" as AnalysisStatus
          : "completed" as AnalysisStatus,
        analysis_summary: analysis.summary,
        selected_cloth_type: selectedType || null,
        selected_material: selectedMaterial || null,
        candidate_regions: analysis.candidateRegions,
        similarity_scores: similarityScores,
        composite_risk_score: resolved.riskScore,
        decision_factors: resolved.factors,
        source_priority_applied: prioritized.applied,
        parent_screening_id: parentScreening?.id || null,
        supersedes_screening_id: previousScreening?.id || null,
        screening_version:
          Number(previousScreening?.screening_version || 0) + 1,
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

    const { error: eventError } = await adminClient
      .from("trademark_screening_events")
      .insert({
        screening_id: saved.id,
        from_decision: null,
        to_decision: resolved.decision,
        actor_type: "system",
        reason: resolved.reason,
        metadata: {
          analysisVersion,
          compositeRiskScore: resolved.riskScore,
          sourcePriorityApplied: prioritized.applied,
        },
      });
    if (eventError) {
      console.warn("Trademark screening event save failed", eventError);
    }

    return jsonResponse({
      screening: {
        ...saved,
        disclaimer:
          "자동 분석은 상표권 침해를 확정하지 않으며, 후보영역·복합점수·판정 근거를 관리자 검토용으로 제공합니다.",
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
