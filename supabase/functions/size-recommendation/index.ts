import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sizeData = {
  men: {
    recommendedSizes: [
      { height: "160 ~ 165", size: "XS (90)" },
      { height: "165 ~ 170", size: "S (95)" },
      { height: "170 ~ 175", size: "M (100)" },
      { height: "175 ~ 180", size: "L (105)" },
      { height: "180 ~ 185", size: "XL (110)" },
      { height: "185 ~ 190", size: "XXL (115)" },
    ],
    categories: {
      outer_jacket: {
        description: "아우터/자켓 (남성)",
        sizes: {
          XS: { shoulder: 43, chest: 111, waist: 101, sleeve: 83.5, length: 68 },
          S: { shoulder: 44, chest: 116, waist: 106, sleeve: 85, length: 70 },
          M: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 },
          L: { shoulder: 46, chest: 126, waist: 116, sleeve: 88, length: 74 },
          XL: { shoulder: 47, chest: 131, waist: 121, sleeve: 89.5, length: 76 },
          XXL: { shoulder: 48, chest: 136, waist: 126, sleeve: 91, length: 78 },
        },
      },
      shirts: {
        description: "셔츠 (남성)",
        sizes: {
          XS: { neck: 36, chest: 102, waist: 94, sleeve: 82, length: 74 },
          S: { neck: 37, chest: 107, waist: 99, sleeve: 83.5, length: 76 },
          M: { neck: 38, chest: 112, waist: 104, sleeve: 85, length: 78 },
          L: { neck: 39, chest: 117, waist: 109, sleeve: 86.5, length: 80 },
          XL: { neck: 40, chest: 122, waist: 114, sleeve: 88, length: 82 },
          XXL: { neck: 41, chest: 127, waist: 119, sleeve: 89.5, length: 84 },
        },
      },
      t_shirts: {
        description: "티셔츠 (남성)",
        sizes: {
          XS: { shoulder: 42, chest: 96, length: 68 },
          S: { shoulder: 43.5, chest: 101, length: 70 },
          M: { shoulder: 45, chest: 106, length: 72 },
          L: { shoulder: 46.5, chest: 111, length: 74 },
          XL: { shoulder: 48, chest: 116, length: 76 },
          XXL: { shoulder: 49.5, chest: 121, length: 78 },
        },
      },
      long_pants: {
        description: "긴바지 (남성)",
        fits: {
          regular: {
            XS: { waist: 76, hip: 96, thigh: 58, hem: 38, length: 104 },
            S: { waist: 81, hip: 101, thigh: 61, hem: 39, length: 106 },
            M: { waist: 86, hip: 106, thigh: 64, hem: 40, length: 108 },
            L: { waist: 91, hip: 111, thigh: 67, hem: 41, length: 110 },
            XL: { waist: 96, hip: 116, thigh: 70, hem: 42, length: 112 },
            XXL: { waist: 101, hip: 121, thigh: 73, hem: 43, length: 114 },
          },
        },
      },
    },
  },
  women: {
    recommendedSizes: [
      { height: "150 ~ 155", size: "XS (44)" },
      { height: "155 ~ 160", size: "S (55)" },
      { height: "160 ~ 165", size: "M (66)" },
      { height: "165 ~ 170", size: "L (77)" },
      { height: "170 ~ 175", size: "XL (88)" },
      { height: "175 ~ 180", size: "XXL (99)" },
    ],
    categories: {
      outer_jacket: {
        description: "아우터/자켓 (여성)",
        sizes: {
          XS: { shoulder: 37, chest: 86, waist: 76, sleeve: 58, length: 58 },
          S: { shoulder: 38, chest: 91, waist: 81, sleeve: 59, length: 60 },
          M: { shoulder: 39, chest: 96, waist: 86, sleeve: 60, length: 62 },
          L: { shoulder: 40, chest: 101, waist: 91, sleeve: 61, length: 64 },
          XL: { shoulder: 41, chest: 106, waist: 96, sleeve: 62, length: 66 },
          XXL: { shoulder: 42, chest: 111, waist: 101, sleeve: 63, length: 68 },
        },
      },
      shirts: {
        description: "셔츠 (여성)",
        sizes: {
          XS: { neck: 32, chest: 82, waist: 72, sleeve: 57, length: 60 },
          S: { neck: 33, chest: 87, waist: 77, sleeve: 58, length: 62 },
          M: { neck: 34, chest: 92, waist: 82, sleeve: 59, length: 64 },
          L: { neck: 35, chest: 97, waist: 87, sleeve: 60, length: 66 },
          XL: { neck: 36, chest: 102, waist: 92, sleeve: 61, length: 68 },
          XXL: { neck: 37, chest: 107, waist: 97, sleeve: 62, length: 70 },
        },
      },
      t_shirts: {
        description: "티셔츠 (여성)",
        sizes: {
          XS: { shoulder: 36, chest: 80, length: 56 },
          S: { shoulder: 37, chest: 85, length: 58 },
          M: { shoulder: 38, chest: 90, length: 60 },
          L: { shoulder: 39, chest: 95, length: 62 },
          XL: { shoulder: 40, chest: 100, length: 64 },
          XXL: { shoulder: 41, chest: 105, length: 66 },
        },
      },
      long_pants: {
        description: "긴바지 (여성)",
        fits: {
          regular: {
            XS: { waist: 61, hip: 86, thigh: 50, hem: 30, length: 99 },
            S: { waist: 66, hip: 91, thigh: 53, hem: 31, length: 101 },
            M: { waist: 71, hip: 96, thigh: 56, hem: 32, length: 103 },
            L: { waist: 76, hip: 101, thigh: 59, hem: 33, length: 105 },
            XL: { waist: 81, hip: 106, thigh: 62, hem: 34, length: 107 },
            XXL: { waist: 86, hip: 111, thigh: 65, hem: 35, length: 109 },
          },
        },
      },
    },
  },
};

// 의류 타입에 따른 한글 이름 매핑
const typeToKorean: Record<string, string> = {
  outer_jacket: "자켓",
  short_sleeve: "반팔 티셔츠",
  long_sleeve_regular: "긴팔 티셔츠",
  long_sleeve_loose: "루즈핏 긴팔 티셔츠",
  sweatshirt_regular: "맨투맨",
  sweatshirt_loose: "루즈핏 맨투맨",
  shorts: "반바지",
  long_pants: "긴바지"
};

// 측정값을 한글 키로 변환하는 함수
function translateMeasurementsToKorean(measurements: any, type: string): any {
  const translation: Record<string, string> = {
    shoulder: "어깨너비",
    chest: "가슴둘레",
    bust: "가슴둘레",
    waist: "허리둘레",
    sleeve: "소매길이",
    length: "총장",
    hip: "엉덩이둘레",
    thigh: "허벅지둘레",
    hem: "밑단 너비"
  };

  const koreanMeasurements: Record<string, number> = {};
  
  for (const [key, value] of Object.entries(measurements)) {
    if (translation[key]) {
      koreanMeasurements[translation[key]] = value as number;
    }
  }

  return koreanMeasurements;
}

// 키에 맞는 사이즈를 찾는 함수
function findSizeByHeight(height: number, genderData: any): string | null {
  const sizeRange = genderData.recommendedSizes.find(range => {
    const [min, max] = range.height.split(" ~ ").map(Number);
    return height >= min && height < max;
  });
  
  return sizeRange ? sizeRange.size.split(" ")[0] : null;
}

// 특정 사이즈의 의류 데이터를 추출하는 함수
function extractSizeData(size: string, genderData: any, type: string) {
  const category = Object.entries(genderData.categories).find(([key, _]) => key === type);
  
  if (!category) return null;
  
  const [_, data] = category;
  
  if (type === 'long_pants') {
    // 긴바지의 경우 fits 객체에서 regular fit의 데이터만 사용
    return translateMeasurementsToKorean(data.fits.regular[size], type);
  } else {
    return translateMeasurementsToKorean(data.sizes[size], type);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { gender, height, type } = await req.json()

    if (!gender || !height || !type) {
      throw new Error('Missing required parameters')
    }

    const genderData = gender === 'men' ? sizeData.men : sizeData.women
    const recommendedSize = findSizeByHeight(height, genderData)
    
    if (!recommendedSize) {
      throw new Error('Could not determine appropriate size for given height')
    }

    const sizeTable = extractSizeData(recommendedSize, genderData, type);

    const response = {
      성별: gender === 'men' ? '남성' : '여성',
      키: height,
      사이즈: recommendedSize,
      옷_종류: typeToKorean[type] || type,
      그에_맞는_사이즈_표: sizeTable
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
