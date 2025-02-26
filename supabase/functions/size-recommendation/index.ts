
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
      { height: "160 ~ 165", size: "XS" },
      { height: "165 ~ 170", size: "S" },
      { height: "170 ~ 175", size: "M" },
      { height: "175 ~ 180", size: "L" },
      { height: "180 ~ 185", size: "XL" },
      { height: "185 ~ 190", size: "XXL" },
    ],
    categories: {
      outer_jacket: {
        description: "자켓",
        sizes: {
          XS: { shoulder: 43, chest: 111, waist: 101, sleeve: 83.5, length: 68 },
          S: { shoulder: 44, chest: 116, waist: 106, sleeve: 85, length: 70 },
          M: { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 },
          L: { shoulder: 46, chest: 126, waist: 116, sleeve: 88, length: 74 },
          XL: { shoulder: 47, chest: 131, waist: 121, sleeve: 89.5, length: 76 },
          XXL: { shoulder: 48, chest: 136, waist: 126, sleeve: 91, length: 78 },
        },
      },
      long_pants: {
        description: "긴바지",
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
      short_sleeve: {
        description: "반팔 티셔츠",
        sizes: {
          XS: { shoulder: 42, chest: 96, length: 68 },
          S: { shoulder: 43.5, chest: 101, length: 70 },
          M: { shoulder: 45, chest: 106, length: 72 },
          L: { shoulder: 46.5, chest: 111, length: 74 },
          XL: { shoulder: 48, chest: 116, length: 76 },
          XXL: { shoulder: 49.5, chest: 121, length: 78 },
        },
      },
      long_sleeve_regular: {
        description: "긴팔 티셔츠",
        sizes: {
          XS: { shoulder: 42, chest: 96, sleeve: 58, length: 68 },
          S: { shoulder: 43.5, chest: 101, sleeve: 59, length: 70 },
          M: { shoulder: 45, chest: 106, sleeve: 60, length: 72 },
          L: { shoulder: 46.5, chest: 111, sleeve: 61, length: 74 },
          XL: { shoulder: 48, chest: 116, sleeve: 62, length: 76 },
          XXL: { shoulder: 49.5, chest: 121, sleeve: 63, length: 78 },
        },
      },
      sweatshirt_regular: {
        description: "맨투맨",
        sizes: {
          XS: { shoulder: 43, chest: 106, sleeve: 58, length: 65 },
          S: { shoulder: 44.5, chest: 111, sleeve: 59, length: 67 },
          M: { shoulder: 46, chest: 116, sleeve: 60, length: 69 },
          L: { shoulder: 47.5, chest: 121, sleeve: 61, length: 71 },
          XL: { shoulder: 49, chest: 126, sleeve: 62, length: 73 },
          XXL: { shoulder: 50.5, chest: 131, sleeve: 63, length: 75 },
        },
      },
    },
  },
  women: {
    recommendedSizes: [
      { height: "150 ~ 155", size: "XS" },
      { height: "155 ~ 160", size: "S" },
      { height: "160 ~ 165", size: "M" },
      { height: "165 ~ 170", size: "L" },
      { height: "170 ~ 175", size: "XL" },
      { height: "175 ~ 180", size: "XXL" },
    ],
    categories: {
      outer_jacket: {
        description: "자켓",
        sizes: {
          XS: { shoulder: 37, chest: 86, waist: 76, sleeve: 58, length: 58 },
          S: { shoulder: 38, chest: 91, waist: 81, sleeve: 59, length: 60 },
          M: { shoulder: 39, chest: 96, waist: 86, sleeve: 60, length: 62 },
          L: { shoulder: 40, chest: 101, waist: 91, sleeve: 61, length: 64 },
          XL: { shoulder: 41, chest: 106, waist: 96, sleeve: 62, length: 66 },
          XXL: { shoulder: 42, chest: 111, waist: 101, sleeve: 63, length: 68 },
        },
      },
      long_pants: {
        description: "긴바지",
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
      short_sleeve: {
        description: "반팔 티셔츠",
        sizes: {
          XS: { shoulder: 36, chest: 80, length: 56 },
          S: { shoulder: 37, chest: 85, length: 58 },
          M: { shoulder: 38, chest: 90, length: 60 },
          L: { shoulder: 39, chest: 95, length: 62 },
          XL: { shoulder: 40, chest: 100, length: 64 },
          XXL: { shoulder: 41, chest: 105, length: 66 },
        },
      },
      long_sleeve_regular: {
        description: "긴팔 티셔츠",
        sizes: {
          XS: { shoulder: 36, chest: 80, sleeve: 57, length: 56 },
          S: { shoulder: 37, chest: 85, sleeve: 58, length: 58 },
          M: { shoulder: 38, chest: 90, sleeve: 59, length: 60 },
          L: { shoulder: 39, chest: 95, sleeve: 60, length: 62 },
          XL: { shoulder: 40, chest: 100, sleeve: 61, length: 64 },
          XXL: { shoulder: 41, chest: 105, sleeve: 62, length: 66 },
        },
      },
      sweatshirt_regular: {
        description: "맨투맨",
        sizes: {
          XS: { shoulder: 37, chest: 86, sleeve: 57, length: 55 },
          S: { shoulder: 38, chest: 91, sleeve: 58, length: 57 },
          M: { shoulder: 39, chest: 96, sleeve: 59, length: 59 },
          L: { shoulder: 40, chest: 101, sleeve: 60, length: 61 },
          XL: { shoulder: 41, chest: 106, sleeve: 61, length: 63 },
          XXL: { shoulder: 42, chest: 111, sleeve: 62, length: 65 },
        },
      },
    },
  },
};

// 키에 맞는 사이즈를 찾는 함수
function findSizeByHeight(height: number, genderData: any): string | null {
  const sizeRange = genderData.recommendedSizes.find(range => {
    const [min, max] = range.height.split(" ~ ").map(Number);
    return height >= min && height < max;
  });
  
  return sizeRange ? sizeRange.size : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { gender, height, type } = await req.json()
    console.log('Received request:', { gender, height, type });

    if (!gender || !height || !type) {
      throw new Error('Missing required parameters')
    }

    const genderData = gender === 'men' ? sizeData.men : sizeData.women
    const recommendedSize = findSizeByHeight(height, genderData)
    
    if (!recommendedSize) {
      throw new Error('Could not determine appropriate size for given height')
    }

    // 해당 카테고리의 사이즈 데이터 찾기
    const category = genderData.categories[type];
    if (!category) {
      throw new Error(`Invalid type: ${type}`);
    }

    // 사이즈 데이터 추출
    let sizeData;
    if (type === 'long_pants') {
      sizeData = category.fits.regular[recommendedSize];
    } else {
      sizeData = category.sizes[recommendedSize];
    }

    console.log('Category:', category);
    console.log('Size data:', sizeData);

    const response = {
      성별: gender === 'men' ? '남성' : '여성',
      키: height,
      사이즈: recommendedSize,
      옷_종류: category.description,
      그에_맞는_사이즈_표: sizeData
    };

    console.log('Response:', response);

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
