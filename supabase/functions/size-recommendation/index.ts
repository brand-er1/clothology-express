// size-recommendation.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { sizeData } from "./size-data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestParams {
  gender: "men" | "women";
  height: number;
  type: string;     // 예: "short_sleeve", "outer_jacket", "sweatshirt", "short_pants", "long_sleeve"
  material: string; // e.g. "cotton", "polyester"
  detail: string;   // 사용자가 추가적으로 입력한 상세 정보
  prompt: string;   // 다른 텍스트 프롬프트
}

// type -> subcategory 매핑
const synonymMap: Record<string, string> = {
  sweatshirt: "맨투맨",
  short_sleeve: "반팔티셔츠",
  outer_jacket: "자켓",
  long_sleeve: "긴팔티셔츠",
  long_pants: "긴바지",
  short_pants: "반바지",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. 요청 파라미터 수신
    const params: RequestParams = await req.json();
    console.log("[1] Received request params:", params);

    const { gender, height, type, detail, material, prompt } = params;

    // 2. 성별 데이터 가져오기
    const dataForGender = sizeData[gender];
    if (!dataForGender) {
      return errorResponse(`잘못된 성별 값: ${gender}`, 400);
    }

    // 3. 키에 맞는 사이즈 찾기
    const recommendedSizes = dataForGender.recommendedSizes;
    const userSize = findRecommendedSize(height, recommendedSizes);
    if (!userSize) {
      return errorResponse(`해당 키(${height})에 맞는 사이즈를 찾을 수 없습니다.`, 404);
    }
    console.log("[2] 키에 따른 추천 사이즈:", userSize);

    // 4. 입력된 type(예: sweatshirt)을 synonymMap으로 보정하여 subcategory 결정
    const subcategory = synonymMap[type] || type;
    console.log("[3] 최종 subcategory 결정:", subcategory);

    const categoryData = dataForGender.categories[subcategory];
    if (!categoryData) {
      return errorResponse(`카테고리 데이터가 없습니다: '${subcategory}'`, 404);
    }

    // 5. GPT에게 핏만 결정하도록 요청
    const fit = await pickFitWithGPT({
      gender,
      detail,
      type: subcategory,
      material,
      prompt,
    });
    if (!fit) {
      return errorResponse("GPT가 적절한 핏을 결정하지 못했습니다.", 500);
    }
    console.log("[4] GPT가 선택한 핏:", fit);

    // 6. 핏별 사이즈표에서 userSize 데이터를 찾는다
    const fitData = categoryData.fits?.[fit];
    if (!fitData) {
      return errorResponse(
        `'${subcategory}' 카테고리에 '${fit}' 핏 데이터가 없습니다.`,
        404,
      );
    }
    const finalSizeTable = fitData[userSize];
    if (!finalSizeTable) {
      return errorResponse(
        `'${subcategory}'의 '${fit}' 핏에서 '${userSize}' 사이즈 데이터를 찾을 수 없습니다.`,
        404,
      );
    }
    console.log("[5] 최종 사이즈 데이터:", finalSizeTable);

    // 7. 최종 결과
    const result = {
      성별: gender === "men" ? "남성" : "여성",
      키: height,
      카테고리: subcategory,
      핏: fit,
      사이즈: userSize,
      사이즈표: finalSizeTable,
    };
    console.log("[6] 최종 결과:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(error.message, 500);
  }
});

function findRecommendedSize(
  height: number,
  sizes: { height: string; size: string }[],
): string | null {
  for (const range of sizes) {
    const parts = range.height.split("~");
    if (parts.length === 2) {
      const min = parseInt(parts[0].trim());
      const max = parseInt(parts[1].trim());
      if (height >= min && height <= max) {
        // 예: "M (170~175cm)" 형태일 수 있으므로 첫 단어만 사이즈로 파싱
        return range.size.split(" ")[0];
      }
    }
  }
  // 범위에 해당되지 않으면 첫 사이즈라도 반환 (혹은 null)
  return sizes.length > 0 ? sizes[0].size.split(" ")[0] : null;
}

/**
 * GPT에게 'fit'(상의: slim, regular, loose / 하의: skinny, regular, wide) 중 1개를 고르게 함
 */
async function pickFitWithGPT(options: {
  gender: string;
  detail: string;
  type: string;
  material: string;
  prompt: string;
}): Promise<string | null> {
  const { gender, detail, type, material, prompt } = options;

  // 상/하의 구분 - 예시 (단순하게 '바지' 단어 포함 여부로 구분)
  const isBottom = /바지/.test(type) || /pants?/.test(type.toLowerCase());

  // fit 후보
  const fitCandidates = isBottom
    ? ["skinny", "regular", "wide"]
    : ["slim", "regular", "loose"];

  const candidateListText = fitCandidates.map((f) => `- ${f}`).join("\n");

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4", // 또는 gpt-3.5-turbo, gpt-4 등
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are a fashion expert.
You must pick exactly one "fit" from the candidates below:
${candidateListText}

Return your answer in strict JSON format only.
For example: {"fit": "regular"}
        `,
        },
        {
          role: "user",
          content: `
- Gender: ${gender === "men" ? "Male" : "Female"}
- Category (subtype): ${type}
- Material: ${material}
- Detail: ${detail}
- Additional prompt: ${prompt}
        `,
        },
      ],
    }),
  });

  if (!openaiResponse.ok) {
    console.error("OpenAI 요청 실패:", await openaiResponse.text());
    return null;
  }

  const gptData = await openaiResponse.json();
  const content = gptData.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    // 예: {"fit":"regular"}
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    const fit = parsed.fit || null;

    // 만약 GPT가 다른 fit을 반환했다면 null
    if (!fitCandidates.includes(fit)) {
      console.warn("GPT가 fit 목록 외의 값을 반환:", fit);
      return null;
    }
    return fit;
  } catch (err) {
    console.error("GPT 파싱 실패:", err);
    return null;
  }
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
