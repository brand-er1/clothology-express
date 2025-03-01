import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { sizeData } from "./size-data.ts";

// CORS 헤더
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestParams {
  gender: "men" | "women";
  height: number;
  type: string;     // 예: "sweatshirt"
  material: string; // 예: "cotton"
  detail: string;   // 예: "오버핏, 루즈한 느낌 등"
  prompt: string;   // 추가 설명
}

serve(async (req) => {
  // OPTIONS 처리 (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: RequestParams = await req.json();
    console.log("Received request params:", params);

    const { gender, height, type, detail, material, prompt } = params;
    const sizeDataForGender = sizeData[gender];

    if (!sizeDataForGender) {
      return errorResponse(`잘못된 성별(gender) 값: ${gender}`, 400);
    }

    // 1) 사용자의 키에 맞는 사이즈(예: XS, S, M 등)를 결정
    const recommendedSizes = sizeDataForGender.recommendedSizes;
    const userSize = findRecommendedSize(height, recommendedSizes);
    if (!userSize) {
      return errorResponse(`해당 키(${height})에 맞는 사이즈 정보를 찾을 수 없습니다.`, 404);
    }

    // 2) type(예: "sweatshirt") 기반으로 가능한 카테고리 후보 찾기
    const subcategories = Object.keys(sizeDataForGender.categories).filter(
      (catKey) => catKey.startsWith(type)
    );
    if (subcategories.length === 0) {
      return errorResponse(`${type}에 해당하는 사이즈 카테고리를 찾을 수 없습니다.`, 404);
    }

    // 3) GPT를 통해 detail 정보를 참고하여 적절한 subcategory 결정
    const subcategoryChoice = await pickSubcategoryWithGPT({
      gender,
      detail,
      type,
      subcategories,
      material,
      prompt,
    });

    if (!subcategoryChoice) {
      return errorResponse("GPT가 적절한 하위 카테고리를 결정하지 못했습니다.", 500);
    }

    // 4) 결정된 subcategory에서 userSize에 해당하는 사이즈 데이터를 찾기
    const categoryData = sizeDataForGender.categories[subcategoryChoice];
    if (!categoryData) {
      return errorResponse(`카테고리(${subcategoryChoice})에 대한 데이터가 없습니다.`, 404);
    }

    const finalSizeTable = categoryData.sizes?.[userSize];
    if (!finalSizeTable) {
      return errorResponse(`사이즈(${userSize})에 대한 데이터가 없습니다.`, 404);
    }

    // 5) 최종 결과 JSON 구성 (프론트엔드 요구사항: 성별, 키, 사이즈, 사이즈표)
    const result = {
      성별: gender === "men" ? "남성" : "여성",
      키: height,
      사이즈: userSize,
      사이즈표: finalSizeTable,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(error.message, 500);
  }
});

/**
 * 사용자의 키(height)가 recommendedSizes의 어느 범위에 해당하는지 판별하는 함수  
 * recommendedSizes 요소는 { height: "160 ~ 165", size: "XS (85)" } 형태입니다.
 * 여기서 height 문자열을 파싱하여 사용자의 키와 비교하고, size 문자열에서 첫 단어(예:"XS")를 반환합니다.
 */
function findRecommendedSize(
  height: number,
  recommendedSizes: { height: string; size: string }[]
): string | null {
  for (const range of recommendedSizes) {
    const parts = range.height.split("~");
    if (parts.length === 2) {
      const min = parseInt(parts[0].trim());
      const max = parseInt(parts[1].trim());
      if (height >= min && height <= max) {
        // "XS (85)"에서 첫 단어만 추출하여 "XS" 반환
        const sizeParts = range.size.split(" ");
        return sizeParts[0];
      }
    }
  }
  // 범위에 해당하는 값이 없을 경우 가장 첫번째의 size를 반환 (또는 추가 로직 구현 가능)
  if (recommendedSizes.length > 0) {
    const sizeParts = recommendedSizes[0].size.split(" ");
    return sizeParts[0];
  }
  return null;
}

/**
 * GPT API를 통해 detail과 subcategories 후보를 전달하여 적절한 subcategory를 결정하는 함수  
 * 반환 예: "sweatshirt_loose"
 */
async function pickSubcategoryWithGPT(options: {
  gender: string;
  detail: string;
  type: string;
  subcategories: string[];
  material: string;
  prompt: string;
}): Promise<string | null> {
  const { gender, detail, type, subcategories, material, prompt } = options;

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
당신은 패션 전문가입니다.
아래 정보에 따라 가능한 하위 카테고리 중 하나를 골라 단순 JSON 형식으로만 반환하세요.
예시: {"subcategory": "sweatshirt_loose"}
          `,
        },
        {
          role: "user",
          content: `
- 성별: ${gender === "men" ? "남성" : "여성"}
- 의류 종류: ${type}
- 가능한 하위 카테고리: ${subcategories.join(", ")}
- 원단/소재: ${material}
- 디테일: ${detail}
- 추가 설명: ${prompt}
          `,
        },
      ],
    }),
  });

  if (!openaiResponse.ok) {
    console.error("OpenAI API 요청 실패:", await openaiResponse.text());
    return null;
  }

  const gptData = await openaiResponse.json();
  const gptMessage = gptData.choices?.[0]?.message?.content;
  if (!gptMessage) return null;

  try {
    const match = gptMessage.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const json = JSON.parse(match[0]);
    return json.subcategory || null;
  } catch (err) {
    console.error("GPT 응답 JSON 파싱 실패:", err);
    return null;
  }
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
