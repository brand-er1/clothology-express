/**
 * 생성된 상세페이지 이미지 자동 검수(얼굴 · 사람 · 글자/로고 · 원본 디자인 일치).
 *
 * 생성 직후 Gemini 비전(텍스트 응답) 모델로 결과 이미지와 원본 디자인을 함께 보고 JSON 으로 판정한다.
 * 얼굴이 보이면 호출부가 더 엄격한 구도로 한 번 다시 생성한다(흐림/가림 처리가 아니라 재구도).
 * 검수 자체가 실패하면 null(이미지 생성은 막지 않는다).
 */

export type ImageQaResult = {
  faceVisible: boolean;
  headVisible: boolean;
  personCount: number;
  bodyPartsVisible: boolean;
  garmentIsMainSubject: boolean;
  visibleText: string[];
  logoOrBrandMark: boolean;
  brandErVisible: boolean;
  matchesReference: boolean;
  designDifferences: string[];
  /** 머리/얼굴이 보일 때 그 영역 [ymin, xmin, ymax, xmax] (0~1000). 재구도(크롭) 판단에 쓴다. */
  headBox: [number, number, number, number] | null;
  model: string;
};

/** full: 의류 전체가 보이는 컷, partial: 디테일 · 원단 클로즈업(전체 디자인 비교 대신 색 · 소재 일관성만). */
export type QaScope = "full" | "partial";

type InlineImage = { data: string; mimeType: string };

const QA_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];

const QA_PROMPT = `You are a strict QA reviewer for fashion e-commerce product images.
IMAGE A is a newly generated product image. IMAGE B is the original garment design it must reproduce (B may show the front on the left half and the back on the right half).
Inspect IMAGE A carefully, including the background, reflections, mirrors, posters and small areas.
Return JSON only:
{
  "faceVisible": false,          // any human face or facial feature (eyes, nose, mouth) visible anywhere in A, even partially or small
  "headVisible": false,          // any part of a human head (incl. chin, hair, ears, back of head) visible in A
  "personCount": 0,              // number of people or human bodies in A (a headless dress form or ghost mannequin is 0)
  "bodyPartsVisible": false,     // any human body part (hands, arms, legs, neck, torso skin) visible in A
  "garmentIsMainSubject": true,  // the garment, not a person, is the clear main subject of A
  "visibleText": [],             // every legible word/letter/number printed or shown anywhere in A
  "logoOrBrandMark": false,      // any logo, emblem, monogram or brand mark visible in A
  "brandErVisible": false,       // the text "BRAND-ER"/"BRANDER" or a similar platform mark visible in A
  "matchesReference": true,      // the garment in A is the same design as B: same garment type, colors, graphics/prints and their placement, pockets, hood, collar, sleeves and length
  "designDifferences": [],       // short list of design differences between the garment in A and B (empty if none)
  "headBox": null                // if any head/face/hair is visible in A: its box [ymin, xmin, ymax, xmax] on a 0-1000 scale (covering every visible head part incl. chin); otherwise null
}`;

const PARTIAL_NOTE = `NOTE: IMAGE A is intentionally a close-up (detail or fabric texture) of the garment, not the whole garment.
For "matchesReference" only check that what A shows is consistent with B (same color and plausible same material/construction); do not report "only a close-up" or texture rendering style as a difference.`;

const parse = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
};

const strList = (value: unknown) =>
  Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 20) : [];

const parseBox = (value: unknown): [number, number, number, number] | null => {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const box = value.map(Number);
  if (box.some((entry) => !Number.isFinite(entry))) return null;
  const [ymin, xmin, ymax, xmax] = box.map((entry) => Math.min(1000, Math.max(0, entry)));
  return ymax > ymin && xmax > xmin ? [ymin, xmin, ymax, xmax] : null;
};

export const inspectGeneratedImage = async (
  apiKey: string,
  generated: InlineImage,
  reference: InlineImage | null,
  scope: QaScope = "full",
  signal?: AbortSignal,
): Promise<ImageQaResult | null> => {
  if (!apiKey) return null;
  const parts: Array<Record<string, unknown>> = [
    { text: scope === "partial" ? `${QA_PROMPT}\n\n${PARTIAL_NOTE}` : QA_PROMPT },
    { text: "IMAGE A (generated):" },
    { inlineData: { data: generated.data, mimeType: generated.mimeType } },
  ];
  if (reference) parts.push({ text: "IMAGE B (original design):" }, { inlineData: { data: reference.data, mimeType: reference.mimeType } });

  for (const model of QA_MODELS) {
    // 응답 시간 예산이 끝났으면 null(호출부가 검수 없이 통과시키지 않고 실패 처리한다).
    if (signal?.aborted) return null;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const text = (data?.candidates?.[0]?.content?.parts ?? []).map((part: { text?: string }) => part.text ?? "").join("");
      const value = parse(text) as Record<string, unknown>;
      const visibleText = strList(value.visibleText);
      return {
        faceVisible: value.faceVisible === true,
        headVisible: value.headVisible === true,
        personCount: Number.isFinite(Number(value.personCount)) ? Number(value.personCount) : 0,
        bodyPartsVisible: value.bodyPartsVisible === true,
        garmentIsMainSubject: value.garmentIsMainSubject !== false,
        visibleText,
        logoOrBrandMark: value.logoOrBrandMark === true,
        brandErVisible: value.brandErVisible === true || visibleText.some((entry) => /brand\s*-?\s*er/i.test(entry)),
        matchesReference: value.matchesReference !== false,
        designDifferences: strList(value.designDifferences),
        headBox: parseBox(value.headBox),
        model,
      };
    } catch {
      // 다음 모델로
    }
  }
  return null;
};

/** 다시 생성해야 하는 결과인지(얼굴 · 머리 노출, 또는 사람이 없어야 하는 컷에 사람). */
export const violatesPeoplePolicy = (qa: ImageQaResult | null, peopleMode: "none" | "faceless_worn") => {
  if (!qa) return false;
  if (qa.faceVisible || qa.headVisible) return true;
  if (peopleMode === "none" && (qa.personCount > 0 || qa.bodyPartsVisible)) return true;
  return qa.personCount > 1;
};

/**
 * 착용 컷 재구도: 머리가 화면 위쪽에 걸쳐 들어온 경우, 카메라 프레임을 머리 아래(어깨선)로 내린 크롭 영역을 계산한다.
 * 같은 화면비를 유지하고 착용자 중심(머리 x 중심)으로 맞춘다. 머리가 위쪽이 아니거나 남는 영역이 너무 작으면 null.
 */
export const reframeBelowHead = (
  width: number,
  height: number,
  headBox: [number, number, number, number] | null,
  minKeep = 0.6,
): { x: number; y: number; width: number; height: number } | null => {
  if (!headBox || width <= 0 || height <= 0) return null;
  const [ymin, xmin, ymax, xmax] = headBox;
  if (ymin > 350) return null; // 머리가 위쪽에 있지 않음(앉은 자세 · 반사 등) → 크롭으로 해결하지 않는다
  const top = Math.ceil((ymax / 1000) * height + height * 0.04);
  const keptHeight = height - top;
  if (keptHeight < height * minKeep) return null;
  const keptWidth = Math.min(width, Math.round((keptHeight * width) / height));
  const centerX = ((xmin + xmax) / 2000) * width;
  const x = Math.round(Math.min(width - keptWidth, Math.max(0, centerX - keptWidth / 2)));
  return { x, y: top, width: keptWidth, height: keptHeight };
};

export const REFRAME_ON_RETRY = [
  "RETRY — the previous attempt violated the people policy (a face/head or extra person was visible).",
  "Recompose from scratch: move the camera lower and closer so the top edge of the frame is clearly below the chin (or show the wearer from behind), keep exactly one anonymous wearer or none, and keep the garment large in the frame. Do not blur or cover anything — the head must simply be outside the frame.",
].join("\n");
