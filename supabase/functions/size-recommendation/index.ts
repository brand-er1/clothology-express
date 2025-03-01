
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
  type: string;     // 예: "sweatshirt_regular"
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

    // 2) type 기반으로 가능한 카테고리 후보 찾기 (접두사 매칭)
    console.log(`Looking for categories starting with: ${type}`);
    const categoryKeys = Object.keys(sizeDataForGender.categories);
    console.log("Available categories:", categoryKeys);
    
    let subcategories = categoryKeys.filter(
      (catKey) => catKey === type || catKey.startsWith(`${type}_`)
    );
    
    console.log("Matched subcategories:", subcategories);
    
    // 정확한 매치가 없다면 부분 매칭 시도
    if (subcategories.length === 0) {
      const typeParts = type.split('_');
      const baseType = typeParts[0]; // 예: "sweatshirt_regular" -> "sweatshirt"
      
      subcategories = categoryKeys.filter(
        (catKey) => catKey.startsWith(baseType)
      );
      
      console.log(`Trying with base type '${baseType}', found:`, subcategories);
    }
    
    if (subcategories.length === 0) {
      return errorResponse(`${type}에 해당하는 사이즈 카테고리를 찾을 수 없습니다.`, 404);
    }

    // 3) 최적의 subcategory 선택
    let selectedCategory: string;
    
    // 후보가 하나뿐이면 바로 선택
    if (subcategories.length === 1) {
      selectedCategory = subcategories[0];
    } else {
      // 디테일 정보를 기반으로 GPT에게 물어보기
      try {
        const subcategoryChoice = await pickSubcategoryWithGPT({
          gender,
          detail,
          type,
          subcategories,
          material,
          prompt,
        });
        
        if (!subcategoryChoice || !subcategories.includes(subcategoryChoice)) {
          console.log("GPT returned invalid subcategory:", subcategoryChoice);
          selectedCategory = subcategories[0]; // 첫 번째 후보 선택
        } else {
          selectedCategory = subcategoryChoice;
        }
      } catch (err) {
        console.error("GPT error:", err);
        selectedCategory = subcategories[0]; // 오류 시 첫 번째 후보 선택
      }
    }
    
    console.log("Selected category:", selectedCategory);

    // 4) 결정된 subcategory의 사이즈 데이터 가져오기
    const categoryData = sizeDataForGender.categories[selectedCategory];
    if (!categoryData) {
      return errorResponse(`카테고리(${selectedCategory})에 대한 데이터가 없습니다.`, 404);
    }

    let finalSizeTable: Record<string, number> | null = null;
    
    // 바지인 경우 fits 객체를 통해 사이즈 정보를 가져옴
    if (selectedCategory.includes('pants') && categoryData.fits) {
      // 디테일 정보에서 핏 정보 추출 (regular, wide, skinny)
      let selectedFit = 'regular'; // 기본값
      
      if (detail.includes('와이드') || detail.includes('wide')) {
        selectedFit = 'wide';
      } else if (detail.includes('스키니') || detail.includes('skinny')) {
        selectedFit = 'skinny';
      }
      
      console.log(`For pants, selected fit: ${selectedFit}`);
      
      if (categoryData.fits[selectedFit] && categoryData.fits[selectedFit][userSize]) {
        finalSizeTable = categoryData.fits[selectedFit][userSize];
      } else {
        // 선택한 핏이 없으면 regular 사용
        finalSizeTable = categoryData.fits.regular[userSize];
      }
    } else {
      // 일반 의류는 sizes 객체에서 직접 가져옴
      finalSizeTable = categoryData.sizes?.[userSize];
    }

    if (!finalSizeTable) {
      return errorResponse(`사이즈(${userSize})에 대한 데이터가 없습니다.`, 404);
    }

    // 5) 최종 결과 JSON 구성
    const result = {
      성별: gender === "men" ? "남성" : "여성",
      키: height,
      사이즈: userSize,
      의류정보: categoryData.description || selectedCategory,
      사이즈표: finalSizeTable,
    };

    console.log("Returning size recommendation:", result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse(error.message, 500);
  }
});

/**
 * 사용자의 키에 맞는 사이즈를 찾는 함수
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
  
  // 범위에 해당하는 값이 없을 경우 가장 가까운 범위 찾기
  if (recommendedSizes.length > 0) {
    // 키가 최소값보다 작은 경우 가장 작은 사이즈 반환
    const firstRange = recommendedSizes[0].height.split("~");
    const firstMin = parseInt(firstRange[0].trim());
    
    if (height < firstMin) {
      const sizeParts = recommendedSizes[0].size.split(" ");
      return sizeParts[0];
    }
    
    // 키가 최대값보다 큰 경우 가장 큰 사이즈 반환
    const lastRange = recommendedSizes[recommendedSizes.length - 1].height.split("~");
    const lastMax = parseInt(lastRange[1].trim());
    
    if (height > lastMax) {
      const sizeParts = recommendedSizes[recommendedSizes.length - 1].size.split(" ");
      return sizeParts[0];
    }
  }
  
  // 기본값으로 첫 번째 사이즈 반환
  if (recommendedSizes.length > 0) {
    const sizeParts = recommendedSizes[0].size.split(" ");
    return sizeParts[0];
  }
  
  return null;
}

/**
 * GPT API를 통해 적절한 subcategory를 결정하는 함수
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

  try {
    console.log("Calling OpenAI API to select subcategory");
    
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
아래 정보에 따라 가능한 하위 카테고리 중 하나를 골라 단순 JSON 형식으로 반환하세요.
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

디테일이나 추가 설명에서 "루즈", "오버사이즈", "와이드", "레귤러", "스키니", "타이트" 등의 핏 정보를 고려하여 가장 적합한 하위 카테고리를 선택해주세요.
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
    
    console.log("GPT response:", gptMessage);
    
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
  } catch (err) {
    console.error("GPT API 호출 오류:", err);
    return null;
  }
}

function errorResponse(message: string, status: number) {
  console.error(`Error (${status}): ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
