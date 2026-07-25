import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Difficulty = "easy" | "medium" | "hard";
type DecorationKind =
  | "screen_print_1_color"
  | "screen_print_multi_color"
  | "dtf"
  | "dtg"
  | "pu"
  | "silicone_print"
  | "embroidery"
  | "patch"
  | "transfer"
  | "unknown_print";
type DecorationLocation =
  | "front"
  | "back"
  | "left_sleeve"
  | "right_sleeve"
  | "neck"
  | "other";

type GarmentPriceRow = {
  category_key: string;
  category_label: string;
  production_min: number | null;
  production_max: number | null;
  production_is_starting_from: boolean;
  pattern_cost: number;
  sample_cost: number;
  moq: number;
  pricing_note: string | null;
  source_file: string;
  source_version: string;
};

type DecorationPriceRow = {
  price_key: string;
  price_label: string;
  analysis_kinds: string[];
  unit_min: number;
  unit_max: number;
  is_starting_from: boolean;
  pricing_note: string | null;
  source_file: string;
  source_version: string;
};

type RawDecoration = {
  kind?: string;
  locations?: string[];
  colorCount?: number;
  confidence?: number;
};

type RawAnalysis = {
  categoryKey?: string;
  categoryConfidence?: number;
  hasLining?: boolean;
  difficulty?: string;
  difficultyReason?: string;
  decorations?: RawDecoration[];
};

const validDecorationKinds = new Set<DecorationKind>([
  "screen_print_1_color",
  "screen_print_multi_color",
  "dtf",
  "dtg",
  "pu",
  "silicone_print",
  "embroidery",
  "patch",
  "transfer",
  "unknown_print",
]);

const validLocations = new Set<DecorationLocation>([
  "front",
  "back",
  "left_sleeve",
  "right_sleeve",
  "neck",
  "other",
]);

const locationLabels: Record<DecorationLocation, string> = {
  front: "앞",
  back: "뒤",
  left_sleeve: "왼쪽 소매",
  right_sleeve: "오른쪽 소매",
  neck: "목",
  other: "기타 위치",
};

const selectedTypeAliases: Record<string, string> = {
  long_pants: "pants",
};

const parseJsonResponse = (text: string): RawAnalysis => {
  const normalized = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
  return JSON.parse(normalized);
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
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

const clampConfidence = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.5;
  return Math.min(1, Math.max(0, parsed));
};

const normalizeDifficulty = (value: unknown): Difficulty =>
  value === "easy" || value === "hard" ? value : "medium";

const resolveGarmentKey = (
  rawAnalysis: RawAnalysis,
  selectedType: string,
  availableKeys: Set<string>,
) => {
  let categoryKey = String(rawAnalysis.categoryKey || "");
  const fallbackKey = selectedTypeAliases[selectedType] || selectedType;

  if (!availableKeys.has(categoryKey)) {
    categoryKey = availableKeys.has(fallbackKey) ? fallbackKey : "";
  }

  if (
    rawAnalysis.hasLining &&
    (categoryKey === "jacket" || categoryKey === "jumper") &&
    availableKeys.has(`${categoryKey}_lined`)
  ) {
    categoryKey = `${categoryKey}_lined`;
  }

  return categoryKey;
};

const normalizeDecorations = (rawDecorations: RawDecoration[] | undefined) => {
  const normalized: Array<{
    kind: DecorationKind;
    location: DecorationLocation;
  }> = [];
  const seen = new Set<string>();

  for (const rawDecoration of rawDecorations || []) {
    let kind = String(rawDecoration.kind || "") as DecorationKind;
    if (!validDecorationKinds.has(kind)) continue;
    if (clampConfidence(rawDecoration.confidence) < 0.45) continue;

    if (
      kind === "screen_print_1_color" &&
      Number(rawDecoration.colorCount) > 1
    ) {
      kind = "screen_print_multi_color";
    }

    const locations = (rawDecoration.locations || [])
      .map((location) => String(location) as DecorationLocation)
      .filter((location) => validLocations.has(location));
    const safeLocations = locations.length > 0 ? locations : ["other" as const];

    for (const location of safeLocations) {
      const key = `${kind}:${location}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ kind, location });
    }
  }

  return normalized;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, selectedType, designContext = "" } = await req.json();
    if (!imageUrl || !selectedType) {
      return new Response(
        JSON.stringify({ error: "imageUrl과 selectedType이 필요합니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
      throw new Error("자동 견적 서비스 환경변수가 설정되지 않았습니다.");
    }

    const parsedImageUrl = new URL(imageUrl);
    const storageHostname = new URL(supabaseUrl).hostname;
    if (
      parsedImageUrl.protocol !== "https:" ||
      parsedImageUrl.hostname !== storageHostname
    ) {
      throw new Error("분석할 수 없는 이미지 주소입니다.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const [garmentResult, decorationResult, imageResponse] = await Promise.all([
      supabase
        .from("quote_garment_prices")
        .select(
          "category_key,category_label,production_min,production_max,production_is_starting_from,pattern_cost,sample_cost,moq,pricing_note,source_file,source_version",
        )
        .eq("active", true),
      supabase
        .from("quote_decoration_prices")
        .select(
          "price_key,price_label,analysis_kinds,unit_min,unit_max,is_starting_from,pricing_note,source_file,source_version",
        )
        .eq("active", true),
      fetch(parsedImageUrl.toString()),
    ]);

    if (garmentResult.error) throw garmentResult.error;
    if (decorationResult.error) throw decorationResult.error;
    if (!imageResponse.ok) {
      throw new Error(`이미지를 불러오지 못했습니다: ${imageResponse.status}`);
    }

    const contentLength = Number(imageResponse.headers.get("content-length") || 0);
    if (contentLength > 10 * 1024 * 1024) {
      throw new Error("10MB 이하 이미지만 분석할 수 있습니다.");
    }

    const garmentRows = (garmentResult.data || []) as GarmentPriceRow[];
    const decorationRows = (decorationResult.data || []) as DecorationPriceRow[];
    if (garmentRows.length === 0) {
      throw new Error("의류 단가 데이터가 없습니다.");
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > 10 * 1024 * 1024) {
      throw new Error("10MB 이하 이미지만 분석할 수 있습니다.");
    }

    const availableCategories = garmentRows
      .map((row) => `${row.category_key}: ${row.category_label}`)
      .join("\n");
    const analysisPrompt = `
You are a Korean apparel production specialist. Inspect the supplied ecommerce
garment image. It may show front and back views in one frame.

Return JSON only, with this exact shape:
{
  "categoryKey": "one allowed category key",
  "categoryConfidence": 0.0,
  "hasLining": false,
  "difficulty": "easy | medium | hard",
  "difficultyReason": "short Korean reason",
  "decorations": [
    {
      "kind": "screen_print_1_color | screen_print_multi_color | dtf | dtg | pu | silicone_print | embroidery | patch | transfer | unknown_print",
      "locations": ["front | back | left_sleeve | right_sleeve | neck | other"],
      "colorCount": 1,
      "confidence": 0.0
    }
  ]
}

Allowed garment categories:
${availableCategories}

Rules:
- The image is authoritative. Use the selected type only as a fallback hint.
- Count every visibly separate front, back, sleeve, and neck decoration.
- A visible graphic, logo, lettering, or motif is a decoration even when the
  exact technique is uncertain. Use unknown_print in that case.
- If the design context explicitly names a printing technique or location, use
  it to distinguish visually similar methods unless the image contradicts it.
- Do not mark fabric texture, seams, pockets, buttons, or zippers as printing.
- Use hard for complex paneling, lining, tailoring, padding, layered
  construction, numerous pockets, unusual cut lines, or difficult sewing.
- If front and back garments appear side by side, inspect both.

Selected type hint: ${selectedType}
Design context:
${String(designContext).slice(0, 3000)}
`.trim();

    const geminiModels = [
      "gemini-3-flash-preview",
      "gemini-3-pro-preview",
      "gemini-3-pro-image-preview",
    ];
    const geminiRequestBody = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: analysisPrompt },
            {
              inlineData: {
                data: arrayBufferToBase64(imageBuffer),
                mimeType:
                  imageResponse.headers.get("content-type") || "image/png",
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    let geminiResponse: Response | null = null;
    const modelErrors: string[] = [];

    for (const model of geminiModels) {
      const candidateResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: geminiRequestBody,
        },
      );

      if (candidateResponse.ok) {
        geminiResponse = candidateResponse;
        break;
      }

      const responseBody = await candidateResponse.text();
      modelErrors.push(`${model}: ${candidateResponse.status} ${responseBody}`);

      if (![400, 404].includes(candidateResponse.status)) {
        break;
      }
    }

    if (!geminiResponse) {
      throw new Error(`AI 이미지 분석 실패: ${modelErrors.join(" | ")}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = (geminiData?.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();
    if (!responseText) {
      throw new Error("AI가 이미지 분석 결과를 반환하지 않았습니다.");
    }

    const rawAnalysis = parseJsonResponse(responseText);
    const availableKeys = new Set(
      garmentRows.map((row) => row.category_key),
    );
    const resolvedGarmentKey = resolveGarmentKey(
      rawAnalysis,
      selectedType,
      availableKeys,
    );
    const garment = garmentRows.find(
      (row) => row.category_key === resolvedGarmentKey,
    );
    if (!garment) {
      throw new Error("분석된 의류 종류의 단가를 찾지 못했습니다.");
    }

    const normalizedDecorations = normalizeDecorations(
      rawAnalysis.decorations,
    );
    const decorationLines = normalizedDecorations.flatMap((decoration) => {
      const price = decorationRows.find((row) =>
        row.analysis_kinds.includes(decoration.kind)
      );
      if (!price) return [];

      return [{
        kind: decoration.kind,
        label: price.price_label,
        location: decoration.location,
        locationLabel: locationLabels[decoration.location],
        unitMin: price.unit_min,
        unitMax: price.unit_max,
        lineMin: price.unit_min,
        lineMax: price.unit_max,
        isStartingFrom: price.is_starting_from,
        note: price.pricing_note,
      }];
    });

    const decorationMin = decorationLines.reduce(
      (sum, line) => sum + line.lineMin,
      0,
    );
    const decorationMax = decorationLines.reduce(
      (sum, line) => sum + line.lineMax,
      0,
    );
    const productionMin = garment.production_min;
    const productionMax = garment.production_max;
    const knownProductionMin = productionMin ?? 0;
    const knownProductionMax = productionMax ?? 0;
    const quantity = 20;
    const productionTotalMin = knownProductionMin * quantity;
    const productionTotalMax = knownProductionMax * quantity;
    const decorationTotalMin = decorationMin * quantity;
    const decorationTotalMax = decorationMax * quantity;
    const directUnitMin = knownProductionMin + decorationMin;
    const directUnitMax = knownProductionMax + decorationMax;
    const developmentTotal = garment.pattern_cost + garment.sample_cost;
    const totalMin =
      productionTotalMin + decorationTotalMin + developmentTotal;
    const totalMax =
      productionTotalMax + decorationTotalMax + developmentTotal;
    const effectiveUnitMin = Math.ceil(totalMin / quantity);
    const effectiveUnitMax = Math.ceil(totalMax / quantity);
    const categoryConfidence = clampConfidence(
      rawAnalysis.categoryConfidence,
    );
    const manualReviewReasons: string[] = [];

    if (productionMin === null || productionMax === null) {
      manualReviewReasons.push(
        "엑셀 단가표에 생산공임이 없어 해당 공임은 상담 후 추가됩니다.",
      );
    }
    if (categoryConfidence < 0.6) {
      manualReviewReasons.push(
        "의류 종류 판단 신뢰도가 낮아 상담 시 카테고리를 확인합니다.",
      );
    }
    if (
      normalizedDecorations.some(
        (decoration) => decoration.kind === "unknown_print",
      )
    ) {
      manualReviewReasons.push(
        "기법이 불분명한 프린팅은 실크스크린 1도 기준으로 계산했습니다.",
      );
    }

    const hasPrinting = normalizedDecorations.some(
      (decoration) =>
        decoration.kind !== "embroidery" && decoration.kind !== "patch",
    );
    const hasEmbroidery = normalizedDecorations.some(
      (decoration) => decoration.kind === "embroidery",
    );
    const sourceRow = garment || decorationRows[0];
    const totalIsStartingFrom =
      garment.production_is_starting_from ||
      decorationLines.some((line) => line.isStartingFrom);

    const estimate = {
      sourceFile: sourceRow.source_file,
      sourceVersion: sourceRow.source_version,
      generatedAt: new Date().toISOString(),
      currency: "KRW",
      analysis: {
        categoryKey: garment.category_key,
        categoryLabel: garment.category_label,
        categoryConfidence,
        hasLining: Boolean(rawAnalysis.hasLining),
        difficulty: normalizeDifficulty(rawAnalysis.difficulty),
        difficultyReason:
          String(rawAnalysis.difficultyReason || "").trim() ||
          "기본 봉제 난이도로 판단했습니다.",
        hasPrinting,
        hasEmbroidery,
        detectedDecorationCount: decorationLines.length,
      },
      garment: {
        key: garment.category_key,
        label: garment.category_label,
        moq: garment.moq,
        note: garment.pricing_note,
      },
      decorations: decorationLines,
      totals: {
        quantity,
        productionMin,
        productionMax,
        productionIsStartingFrom: garment.production_is_starting_from,
        productionTotalMin,
        productionTotalMax,
        patternCost: garment.pattern_cost,
        sampleCost: garment.sample_cost,
        developmentTotal,
        decorationMin,
        decorationMax,
        decorationTotalMin,
        decorationTotalMax,
        directUnitMin,
        directUnitMax,
        totalMin,
        totalMax,
        effectiveUnitMin,
        effectiveUnitMax,
        totalIsStartingFrom,
      },
      isPartial: productionMin === null || productionMax === null,
      manualReviewReasons,
    };

    return new Response(JSON.stringify({ estimate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-production-estimate error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "자동 견적 분석 중 오류가 발생했습니다.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
