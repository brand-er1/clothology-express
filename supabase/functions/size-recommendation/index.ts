import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  SizeData,
  getSizeData,
} from "./size-data.ts";

export const sizeRecommendation = async (
  gender: string,
  height: number,
  type: string,
  material: string,
  detail: string,
  prompt: string
) => {
  const debugLogs = {
    steps: [] as Array<{ step: string; data: any }>,
    errors: [] as Array<string>,
    warnings: [] as Array<string>,
  };

  try {
    // 키 데이터 처리 단계 로깅
    debugLogs.steps.push({
      step: "Height Data Processing",
      data: { height, gender }
    });

    // 의류 타입 처리 단계 로깅
    debugLogs.steps.push({
      step: "Clothing Type Processing",
      data: { type, material, detail }
    });

    // size-data.ts에서 사이즈 데이터 가져오기
    const sizeData = getSizeData();
    debugLogs.steps.push({
      step: "Size Data Retrieved",
      data: sizeData
    });

    // 성별에 따른 데이터 필터링
    const genderData = sizeData[gender === "men" ? "men" : "women"];
    if (!genderData) {
      debugLogs.errors.push(`Invalid gender: ${gender}`);
      throw new Error("Invalid gender specified");
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
      step: "Size Calculation",
      data: {
        height,
        recommendedSize,
        sizeTable
      }
    });

    // 최종 응답 생성
    const response = {
      성별: gender === "men" ? "남성" : "여성",
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

    if (!gender || !height || !type || !material || !detail || !prompt) {
      throw new Error("Missing required parameters");
    }

    const response = await sizeRecommendation(gender, height, type, material, detail, prompt);

    return new Response(
      JSON.stringify(response),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, debugLogs: error.debugLogs }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
