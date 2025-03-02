
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
  prompt: string,
  fit?: string
) => {
  const debugLogs = {
    steps: [] as Array<{ step: string; data: any }>,
    errors: [] as Array<string>,
    warnings: [] as Array<string>,
    clothingType: type,
    gptResults: null,
    inputParams: { gender, height, type, material, detail, prompt, fit },
    intermediateCalculations: {}
  };

  try {
    // 입력 데이터 로깅
    debugLogs.steps.push({
      step: "입력 데이터 처리",
      data: { gender, height, type, material, detail, prompt, fit }
    });

    // 성별 정보 처리
    const mappedGender = gender === "men" ? "남성" : "여성";
    debugLogs.steps.push({
      step: "성별 정보 처리",
      data: { originalGender: gender, mappedGender }
    });

    // 키 데이터 처리
    debugLogs.steps.push({
      step: "키 데이터 처리",
      data: { height }
    });

    // 의류 타입 처리
    let processedType = type.toLowerCase();
    debugLogs.steps.push({
      step: "의류 타입 처리",
      data: { originalType: type, processedType }
    });

    // 핏 스타일 처리
    const fitStyle = fit || "regular";
    debugLogs.steps.push({
      step: "핏 스타일 처리",
      data: { originalFit: fit, processedFit: fitStyle }
    });

    // 소재 정보 처리
    debugLogs.steps.push({
      step: "소재 정보 처리",
      data: { material }
    });

    // GPT 활용 세부 정보 처리 (실제 GPT 호출은 아니지만 디버깅용 더미 데이터)
    const gptAnalysisResults = {
      detailAnalysis: detail,
      promptAnalysis: prompt,
      suggestedAdjustments: {
        shoulderWidth: detail.includes("wide") ? "+2cm" : "+0cm",
        lengthAdjustment: detail.includes("long") ? "+3cm" : "+0cm"
      }
    };
    
    debugLogs.gptResults = gptAnalysisResults;
    debugLogs.steps.push({
      step: "세부 정보 GPT 분석",
      data: gptAnalysisResults
    });

    // size-data.ts에서 사이즈 데이터 가져오기
    const sizeData = getSizeData();
    debugLogs.steps.push({
      step: "사이즈 데이터 조회",
      data: { availableCategories: Object.keys(sizeData) }
    });

    // 성별에 따른 데이터 필터링
    const genderData = sizeData[gender === "men" ? "men" : "women"];
    if (!genderData) {
      const errorMsg = `Invalid gender: ${gender}`;
      debugLogs.errors.push(errorMsg);
      throw new Error(errorMsg);
    }

    debugLogs.steps.push({
      step: "성별에 따른 데이터 필터링",
      data: { 
        gender: gender, 
        availableSizes: Object.keys(genderData.sizes) 
      }
    });

    // 키에 따른 사이즈 결정
    let recommendedSize = "";
    let sizeTable = {};
    let sizeLogic = "";

    if (height < 160) {
      recommendedSize = "S";
      sizeTable = genderData.sizes.S;
      sizeLogic = "height < 160cm";
    } else if (height < 170) {
      recommendedSize = "M";
      sizeTable = genderData.sizes.M;
      sizeLogic = "160cm <= height < 170cm";
    } else if (height < 180) {
      recommendedSize = "L";
      sizeTable = genderData.sizes.L;
      sizeLogic = "170cm <= height < 180cm";
    } else {
      recommendedSize = "XL";
      sizeTable = genderData.sizes.XL;
      sizeLogic = "height >= 180cm";
    }

    // 핏 스타일에 따른 사이즈 조정
    let adjustedSize = recommendedSize;
    let fitAdjustment = null;
    
    if (fitStyle === "loose") {
      // 루즈 핏은 한 사이즈 업
      const sizeOrder = ["S", "M", "L", "XL", "XXL"];
      const currentIndex = sizeOrder.indexOf(recommendedSize);
      if (currentIndex < sizeOrder.length - 1) {
        adjustedSize = sizeOrder[currentIndex + 1];
        fitAdjustment = { from: recommendedSize, to: adjustedSize, reason: "루즈 핏 요청으로 사이즈 업" };
        sizeTable = genderData.sizes[adjustedSize];
      } else {
        fitAdjustment = { kept: recommendedSize, reason: "이미 최대 사이즈" };
        debugLogs.warnings.push("루즈 핏 요청이지만 이미 최대 사이즈입니다.");
      }
    } else if (fitStyle === "skinny") {
      // 스키니 핏은 한 사이즈 다운
      const sizeOrder = ["S", "M", "L", "XL", "XXL"];
      const currentIndex = sizeOrder.indexOf(recommendedSize);
      if (currentIndex > 0) {
        adjustedSize = sizeOrder[currentIndex - 1];
        fitAdjustment = { from: recommendedSize, to: adjustedSize, reason: "스키니 핏 요청으로 사이즈 다운" };
        sizeTable = genderData.sizes[adjustedSize];
      } else {
        fitAdjustment = { kept: recommendedSize, reason: "이미 최소 사이즈" };
        debugLogs.warnings.push("스키니 핏 요청이지만 이미 최소 사이즈입니다.");
      }
    }
    
    // 중간 계산 결과 저장
    debugLogs.intermediateCalculations = {
      heightBasedSize: {
        height: height,
        logic: sizeLogic,
        size: recommendedSize
      },
      fitAdjustment: fitAdjustment,
      finalSize: adjustedSize
    };

    debugLogs.steps.push({
      step: "사이즈 계산",
      data: {
        height,
        sizeLogic,
        initialRecommendedSize: recommendedSize,
        fitStyle,
        fitAdjustment,
        finalSize: adjustedSize,
        finalSizeTable: sizeTable
      }
    });

    // 세부 스타일 분석 및 GPT 결과 기반 조정
    if (gptAnalysisResults.suggestedAdjustments) {
      const adjustments = gptAnalysisResults.suggestedAdjustments;
      const adjustedSizeTable = { ...sizeTable };
      
      // 제안된 조정 적용
      if (adjustments.shoulderWidth && adjustments.shoulderWidth !== "+0cm") {
        const adjustment = parseInt(adjustments.shoulderWidth);
        if (!isNaN(adjustment) && adjustedSizeTable.shoulder) {
          adjustedSizeTable.shoulder += adjustment;
        }
      }
      
      if (adjustments.lengthAdjustment && adjustments.lengthAdjustment !== "+0cm") {
        const adjustment = parseInt(adjustments.lengthAdjustment);
        if (!isNaN(adjustment) && adjustedSizeTable.length) {
          adjustedSizeTable.length += adjustment;
        }
      }
      
      debugLogs.steps.push({
        step: "GPT 세부 스타일 기반 사이즈 조정",
        data: {
          originalSizeTable: sizeTable,
          adjustments: adjustments,
          adjustedSizeTable: adjustedSizeTable
        }
      });
      
      // 조정된 사이즈 테이블 사용
      sizeTable = adjustedSizeTable;
    }

    // 최종 응답 생성
    const response = {
      성별: mappedGender,
      키: height,
      카테고리: type,
      핏: fitStyle,
      사이즈: adjustedSize,
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
    const { gender, height, type, material, detail, prompt, fit } = await req.json();

    console.log("Received request:", { gender, height, type, material, detail, prompt, fit });

    if (!gender || !height || !type) {
      throw new Error("Missing required parameters: gender, height, and type are required");
    }

    const response = await sizeRecommendation(
      gender, 
      height, 
      type, 
      material || "", 
      detail || "", 
      prompt || "",
      fit
    );

    console.log("Sending response:", JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in size-recommendation function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Unknown error", 
        debugLogs: error.debugLogs || {
          steps: [],
          errors: [error.message || "Unknown error"],
          warnings: []
        }
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
