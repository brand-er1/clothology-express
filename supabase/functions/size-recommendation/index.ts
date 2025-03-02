
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
  material: string; // e.g. "cotton", "polyester"
  detail: string;   // 사용자가 추가적으로 입력한 상세 정보
  prompt: string;   // 다른 텍스트 프롬프트
}

// 이 맵을 통해 type이 일치하지 않을 경우(예: sweatshirt -> 맨투맨),
// 혹은 원하는 키워드로 변경하여 subcategory 검색 가능하도록 처리
const synonymMap: Record<string, string> = {
  "sweatshirt": "맨투맨",
  "short_sleeve":"반팔티셔츠",
  "outer_jacket":"자켓",
  "long_sleeve":"긴팔티셔츠",
  "long_pants":"긴바지",
  "short_pants":"반바지"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 디버그 로그 객체 초기화
  const debugLogs = {
    steps: [] as { step: string; data: any }[],
    errors: [] as string[],
    warnings: [] as string[]
  };

  const addDebugLog = (step: string, data: any) => {
    console.log(`Debug: ${step}`, data);
    debugLogs.steps.push({ step, data });
  };

  const addWarning = (message: string) => {
    console.warn(message);
    debugLogs.warnings.push(message);
  };

  try {
    const params: RequestParams = await req.json();
    addDebugLog("Received request params", params);

    const { gender, height, type, detail, material, prompt } = params;

    // 1. 성별 데이터 가져오기
    const dataForGender = sizeData[gender];
    addDebugLog("Gender data found", { gender, dataAvailable: !!dataForGender });
    
    if (!dataForGender) {
      const error = `잘못된 성별 값: ${gender}`;
      debugLogs.errors.push(error);
      return errorResponse(error, 400, debugLogs);
    }

    // 2. 키에 맞는 사이즈 찾기
    const recommendedSizes = dataForGender.recommendedSizes;
    addDebugLog("Available recommended sizes", recommendedSizes);
    
    const userSize = findRecommendedSize(height, recommendedSizes);
    addDebugLog("Found user size", { height, userSize });
    
    if (!userSize) {
      const error = `해당 키(${height})에 맞는 사이즈를 찾을 수 없습니다.`;
      debugLogs.errors.push(error);
      return errorResponse(error, 404, debugLogs);
    }

    // 3. 입력된 type(예: sweatshirt)을 synonymMap으로 보정하여 subcategory 결정
    const subcategory = synonymMap[type] || type; // 데이터 내 카테고리와 일치하도록
    addDebugLog("Mapped subcategory", { originalType: type, mappedSubcategory: subcategory });
    
    const categoryData = dataForGender.categories[subcategory];
    addDebugLog("Category data available", { 
      subcategory, 
      available: !!categoryData,
      availableCategories: Object.keys(dataForGender.categories)
    });
    
    if (!categoryData) {
      const error = `카테고리 데이터가 없습니다: '${subcategory}'`;
      debugLogs.errors.push(error);
      return errorResponse(error, 404, debugLogs);
    }

    // 4. GPT에게 fit만 결정하도록 요청
    addDebugLog("Requesting fit from GPT", { gender, detail, type: subcategory, material, prompt });
    
    const fit = await pickFitWithGPT({
      gender,
      detail,
      type: subcategory, // 최종 결정된 subcategory
      material,
      prompt,
    });
    
    addDebugLog("GPT fit response", { fit });
    
    if (!fit) {
      const error = "GPT가 적절한 핏을 결정하지 못했습니다.";
      debugLogs.errors.push(error);
      return errorResponse(error, 500, debugLogs);
    }

    // 5. 핏별 사이즈표에서 userSize 데이터를 찾는다
    const fitData = categoryData.fits?.[fit];
    addDebugLog("Fit data available", { 
      fit, 
      available: !!fitData,
      availableFits: Object.keys(categoryData.fits || {})
    });
    
    if (!fitData) {
      const error = `'${subcategory}' 카테고리에 '${fit}' 핏 데이터가 없습니다.`;
      debugLogs.errors.push(error);
      return errorResponse(error, 404, debugLogs);
    }
    
    const finalSizeTable = fitData[userSize];
    addDebugLog("Final size table available", { 
      userSize, 
      available: !!finalSizeTable,
      availableSizes: Object.keys(fitData)
    });
    
    if (!finalSizeTable) {
      const error = `'${subcategory}'의 '${fit}' 핏에서 '${userSize}' 사이즈 데이터를 찾을 수 없습니다.`;
      debugLogs.errors.push(error);
      return errorResponse(error, 404, debugLogs);
    }

    // 6. 최종 결과
    const result = {
      성별: gender === "men" ? "남성" : "여성",
      키: height,
      카테고리: subcategory,
      핏: fit,
      사이즈: userSize,
      사이즈표: finalSizeTable,
      debugLogs // 디버그 로그 포함
    };

    addDebugLog("Final result", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    debugLogs.errors.push(error.message || "알 수 없는 오류");
    return errorResponse(error.message, 500, debugLogs);
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
        return range.size.split(" ")[0];
      }
    }
  }
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

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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

    const responseText = await openaiResponse.text();
    if (!openaiResponse.ok) {
      console.error("OpenAI 요청 실패:", responseText);
      return null;
    }
    
    try {
      const gptData = JSON.parse(responseText);
      const content = gptData.choices?.[0]?.message?.content;
      if (!content) return null;

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
      console.error("GPT 응답 파싱 실패:", responseText, err);
      return null;
    }
  } catch (error) {
    console.error("GPT 요청 중 오류 발생:", error);
    return null;
  }
}

function errorResponse(message: string, status: number, debugLogs?: any) {
  return new Response(JSON.stringify({ error: message, debugLogs }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
