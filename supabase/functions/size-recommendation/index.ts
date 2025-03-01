// size-recommendation.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { sizeData } from "./size-data.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestParams {
  gender: "men" | "women";
  height: number;
  type: string;     // 예: "short_sleeve", "outer_jacket", "sweatshirt", "short_pants", "long_sleeve"
  material: string;
  detail: string;
  prompt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: RequestParams = await req.json();
    console.log("Received request params:", params);

    const { gender, height, type, detail, material, prompt } = params;
    const dataForGender = sizeData[gender];
    if (!dataForGender) {
      return errorResponse(`잘못된 성별 값: ${gender}`, 400);
    }

    // 1. 추천 사이즈 결정 (recommendedSizes의 height 문자열을 파싱)
    const recommendedSizes = dataForGender.recommendedSizes;
    const userSize = findRecommendedSize(height, recommendedSizes);
    if (!userSize) {
      return errorResponse(`해당 키(${height})에 맞는 사이즈를 찾을 수 없습니다.`, 404);
    }

    // 2. 해당 의류 종류(type) 하위 카테고리 후보 추출
    const subcategories = Object.keys(dataForGender.categories).filter(catKey =>
      catKey.startsWith(type)
    );
    // 후보 목록을 콘솔에 출력
    console.log("Subcategory candidates:", subcategories);

    if (subcategories.length === 0) {
      return errorResponse(`${type}에 해당하는 사이즈 카테고리가 없습니다.`, 404);
    }

    // 3. GPT API를 통해 detail을 반영하여 subcategory 결정
    const chosenSubcategory = await pickSubcategoryWithGPT({
      gender,
      detail,
      type,
      subcategories,
      material,
      prompt,
    });
    if (!chosenSubcategory) {
      return errorResponse("GPT가 적절한 하위 카테고리를 결정하지 못했습니다.", 500);
    }

    const categoryData = dataForGender.categories[chosenSubcategory];
    if (!categoryData) {
      return errorResponse(`카테고리 데이터가 없습니다: ${chosenSubcategory}`, 404);
    }

    // 4. 결정된 카테고리의 핏별 사이즈 중 Regular 핏(기본값)에서 userSize를 선택
    // (필요시 핏 정보는 추가로 프론트엔드에서 detail로 선택할 수 있음)
    const finalSizeTable = categoryData.fits?.regular?.[userSize];
    if (!finalSizeTable) {
      return errorResponse(`사이즈 데이터가 없습니다: ${userSize}`, 404);
    }

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

function findRecommendedSize(
  height: number,
  sizes: { height: string; size: string }[]
): string | null {
  for (const range of sizes) {
    const parts = range.height.split("~");
    if (parts.length === 2) {
      const min = parseInt(parts[0].trim());
      const max = parseInt(parts[1].trim());
      if (height >= min && height <= max) {
        return range.size.split(" ")[0];
      }
    }
  }
  return sizes.length > 0 ? sizes[0].size.split(" ")[0] : null;
}

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
You are a fashion expert.
Based on the information provided, please choose one and only one subcategory from the candidate list below.
Do not return any value outside the candidate list.
Return your answer strictly in JSON format with no extra text.
Example:
{"subcategory": "short_sleeve"}
Candidate list:
- ${subcategories.join("\n- ")}
          `,
        },
        {
          role: "user",
          content: `
- Gender: ${gender === "men" ? "Male" : "Female"}
- Garment Type: ${type}
- Material: ${material}
- Detail: ${detail}
- Additional description: ${prompt}
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
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const json = JSON.parse(match[0]);
    return json.subcategory || null;
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
