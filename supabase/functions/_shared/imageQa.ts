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
  model: string;
};

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
  "designDifferences": []        // short list of design differences between the garment in A and B (empty if none)
}`;

const parse = (text: string) => {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
};

const strList = (value: unknown) =>
  Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean).slice(0, 20) : [];

export const inspectGeneratedImage = async (
  apiKey: string,
  generated: InlineImage,
  reference: InlineImage | null,
): Promise<ImageQaResult | null> => {
  if (!apiKey) return null;
  const parts: Array<Record<string, unknown>> = [
    { text: QA_PROMPT },
    { text: "IMAGE A (generated):" },
    { inlineData: { data: generated.data, mimeType: generated.mimeType } },
  ];
  if (reference) parts.push({ text: "IMAGE B (original design):" }, { inlineData: { data: reference.data, mimeType: reference.mimeType } });

  for (const model of QA_MODELS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
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

export const REFRAME_ON_RETRY = [
  "RETRY — the previous attempt violated the people policy (a face/head or extra person was visible).",
  "Recompose from scratch: move the camera lower and closer so the top edge of the frame is clearly below the chin (or show the wearer from behind), keep exactly one anonymous wearer or none, and keep the garment large in the frame. Do not blur or cover anything — the head must simply be outside the frame.",
].join("\n");
