
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SizeData, getSizeData } from "./size-data.ts";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export type SizeRecommendationResult = {
  성별: string;
  키: number;
  카테고리: string;
  핏: string;
  사이즈: string;
  사이즈표: Record<string, any>;
  debugLogs?: {
    steps: Array<{ step: string; data: any }>;
    errors: Array<string>;
    warnings: Array<string>;
  };
  error?: string;
};

export const sizeRecommendation = async (
  gender: string,
  height: number,
  type: string,
  material: string,
  detail: string,
  prompt: string
): Promise<SizeRecommendationResult> => {
  const debugLogs = {
    steps: [] as Array<{ step: string; data: any }>,
    errors: [] as Array<string>,
    warnings: [] as Array<string>,
  };

  try {
    // 사용자 입력 정보 로깅
    debugLogs.steps.push({
      step: "사용자 입력 정보",
      data: { 
        성별: gender,
        키: height,
        의류유형: type,
        소재: material,
        디테일: detail 
      }
    });

    // AI 프롬프트 로깅
    debugLogs.steps.push({
      step: "생성된 프롬프트",
      data: { prompt }
    });

    // 키 데이터 처리 단계 로깅
    debugLogs.steps.push({
      step: "키 데이터 처리",
      data: { height, gender }
    });

    // 의류 타입 처리 단계 로깅
    debugLogs.steps.push({
      step: "의류 타입 처리",
      data: { type, material, detail }
    });

    // size-data.ts에서 사이즈 데이터 가져오기
    const sizeData = getSizeData();
    debugLogs.steps.push({
      step: "사이즈 데이터 검색 완료",
      data: sizeData
    });

    // 성별에 따른 데이터 필터링
    const genderData = sizeData[gender === "남성" ? "men" : "women"];
    if (!genderData) {
      debugLogs.errors.push(`유효하지 않은 성별: ${gender}`);
      throw new Error("유효하지 않은 성별이 지정되었습니다");
    }

    // 키에 따른 사이즈 결정
    let recommendedSize = "";
    let sizeTable = {};

    if (height < 160) {
      recommendedSize = "S";
      sizeTable = genderData.sizes.S;
    } else if (height < 170) {
      recommendedSize = "M";
      sizeTable = genderData.sizes.M;
    } else if (height < 180) {
      recommendedSize = "L";
      sizeTable = genderData.sizes.L;
    } else {
      recommendedSize = "XL";
      sizeTable = genderData.sizes.XL;
    }

    debugLogs.steps.push({
      step: "사이즈 계산 완료",
      data: {
        height,
        recommendedSize,
        sizeTable
      }
    });

    // 최종 응답 생성
    const response = {
      성별: gender,
      키: height,
      카테고리: type,
      핏: detail,
      사이즈: recommendedSize,
      사이즈표: sizeTable,
      debugLogs
    };

    return response;
  } catch (error: any) {
    debugLogs.errors.push(error.message);
    throw { error: error.message, debugLogs };
  }
};

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { gender, height, type, material, detail, prompt } = await req.json();

    console.log("Received size recommendation request:", { gender, height, type, material, detail, prompt });

    if (!gender || !height || !type || !material) {
      throw new Error("필수 매개변수가 누락되었습니다");
    }

    const response = await sizeRecommendation(gender, height, type, material, detail || "", prompt || "");
    console.log("Size recommendation response:", response);

    return new Response(
      JSON.stringify(response),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Size recommendation error:", error);
    return new Response(
      JSON.stringify({ error: error.message, debugLogs: error.debugLogs }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
