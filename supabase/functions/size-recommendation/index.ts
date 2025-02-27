
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { sizeData } from "./size-data.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestParams {
  gender: 'men' | 'women';
  height: number;
  type: string;
  material: string;
  detail: string;
  prompt: string;
}

serve(async (req) => {
  // CORS 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const params: RequestParams = await req.json();
    console.log("Received request params:", params);

    // 1. 성별 기준 필터링
    const genderData = sizeData.filter(item => item.성별 === (params.gender === 'men' ? '남성' : '여성'));
    console.log(`Found ${genderData.length} items for gender: ${params.gender}`);

    // 2. 의류 종류 기준 필터링 (부분 매칭)
    const baseType = params.type.split('_')[0]; // 예: long_pants -> long
    const typeData = genderData.filter(item => {
      // long_pants -> long_pants_regular, long_pants_overfit 등 모두 매칭
      return item.옷_종류.includes(baseType);
    });
    console.log(`Found ${typeData.length} items matching type: ${params.type} (base: ${baseType})`);

    if (typeData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: `No data found for type: ${params.type}`,
          availableTypes: [...new Set(genderData.map(item => item.옷_종류))] 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 3. 키 범위 필터링
    const heightData = typeData.filter(item => {
      // 키 범위를 확장해서 찾기 (±5cm)
      return Math.abs(item.키 - params.height) <= 5;
    });

    // 가장 가까운 키 찾기
    let closestHeightData = typeData[0];
    let minHeightDiff = Math.abs(typeData[0].키 - params.height);

    for (const item of typeData) {
      const diff = Math.abs(item.키 - params.height);
      if (diff < minHeightDiff) {
        minHeightDiff = diff;
        closestHeightData = item;
      }
    }

    const selectedData = heightData.length > 0 ? heightData[0] : closestHeightData;
    console.log("Selected size data:", selectedData);

    // 4. GPT로 사이즈 분석 요청
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `당신은 패션 사이즈 분석 전문가입니다. 
            사용자의 신체 정보와 옷 정보를 바탕으로 적절한 사이즈를 추천해주세요.
            응답은 반드시 JSON 형식으로 {"총장": 숫자, "어깨너비": 숫자, ...} 형태로 해주세요.
            모든 측정치는 cm 단위로 제공해주세요.` 
          },
          { 
            role: 'user', 
            content: `
            성별: ${params.gender === 'men' ? '남성' : '여성'}
            키: ${params.height}cm
            의류 종류: ${params.type}
            원단: ${params.material}
            디테일: ${params.detail}
            의류 설명: ${params.prompt}
            
            기본 사이즈 정보:
            ${JSON.stringify(selectedData.그에_맞는_사이즈_표, null, 2)}
            
            이 정보를 바탕으로 적절한 사이즈 데이터를 JSON 형식으로 제공해주세요.`
          }
        ],
        temperature: 0.3,
      }),
    });

    const gptResponse = await openaiResponse.json();
    const sizeSuggestion = gptResponse.choices[0].message.content;
    console.log("GPT Response:", sizeSuggestion);

    // GPT 응답에서 JSON 추출 (문자열로 반환되었을 가능성이 있음)
    let sizeJSON;
    try {
      // JSON 문자열만 추출
      const jsonMatch = sizeSuggestion.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : sizeSuggestion;
      sizeJSON = JSON.parse(jsonString);
    } catch (e) {
      console.error("Error parsing GPT JSON:", e);
      // 실패할 경우 원본 사이즈 데이터 사용
      sizeJSON = selectedData.그에_맞는_사이즈_표;
    }

    // 5. 최종 응답 데이터 구성
    const response = {
      성별: params.gender === 'men' ? '남성' : '여성',
      키: params.height,
      사이즈: selectedData.사이즈, // XS, S, M, L, XL 등
      옷_종류: selectedData.옷_종류,
      그에_맞는_사이즈_표: sizeJSON,
      원본_사이즈_데이터: selectedData.그에_맞는_사이즈_표,
      원단: params.material,
      디테일: params.detail,
      프롬프트: params.prompt
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
