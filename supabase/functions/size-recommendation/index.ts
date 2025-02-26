
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
      { height: "160 ~ 165", size: "XS (85)" },
      { height: "165 ~ 170", size: "S (90)" },
      { height: "170 ~ 175", size: "M (95)" },
      { height: "175 ~ 180", size: "L (100)" },
      { height: "180 ~ 185", size: "XL (105)" },
      { height: "185 ~ 190", size: "XXL (110)" },
      { height: "190 ~ 195", size: "XXXL (115)" }
    ],
    categories: {
      outer_jacket: {
        description: "아우터/자켓 (남성)",
        sizes: {
          "XS": { shoulder: 41, chest: 111, waist: 101, sleeve: 82, length: 68 },
          "S": { shoulder: 43, chest: 116, waist: 106, sleeve: 84, length: 70 },
          "M": { shoulder: 45, chest: 121, waist: 111, sleeve: 86.5, length: 72 },
          "L": { shoulder: 47, chest: 126, waist: 116, sleeve: 89, length: 74 },
          "XL": { shoulder: 49, chest: 131, waist: 121, sleeve: 91.5, length: 76 },
          "XXL": { shoulder: 51, chest: 136, waist: 126, sleeve: 94, length: 78 },
          "XXXL": { shoulder: 53, chest: 141, waist: 131, sleeve: 96.5, length: 80 }
        }
      },
      short_sleeve: {
        description: "반팔 티셔츠 (레귤러 핏, 남성)",
        sizes: {
          "XS": { shoulder: 42, chest: 92, waist: 92, sleeve: 19, length: 68 },
          "S": { shoulder: 44, chest: 96, waist: 96, sleeve: 20, length: 70 },
          "M": { shoulder: 47, chest: 101, waist: 101, sleeve: 21, length: 72 },
          "L": { shoulder: 49, chest: 107, waist: 107, sleeve: 22, length: 74 },
          "XL": { shoulder: 52, chest: 113, waist: 113, sleeve: 23, length: 76 },
          "XXL": { shoulder: 54, chest: 120, waist: 120, sleeve: 24, length: 78 },
          "XXXL": { shoulder: 57, chest: 127, waist: 127, sleeve: 25, length: 80 }
        }
      },
      long_sleeve_regular: {
        description: "긴팔 티셔츠 (레귤러 핏, 남성)",
        sizes: {
          "XS": { shoulder: 42, chest: 92, waist: 92, sleeve: 58, length: 68 },
          "S": { shoulder: 44, chest: 96, waist: 96, sleeve: 60, length: 70 },
          "M": { shoulder: 47, chest: 101, waist: 101, sleeve: 61, length: 72 },
          "L": { shoulder: 49, chest: 107, waist: 107, sleeve: 62, length: 74 },
          "XL": { shoulder: 52, chest: 113, waist: 113, sleeve: 63, length: 76 },
          "XXL": { shoulder: 54, chest: 120, waist: 120, sleeve: 64, length: 78 },
          "XXXL": { shoulder: 57, chest: 127, waist: 127, sleeve: 65, length: 80 }
        }
      },
      long_sleeve_loose: {
        description: "긴팔 티셔츠 (루즈 핏, 남성)",
        sizes: {
          "XS": { shoulder: 45, chest: 100, waist: 100, sleeve: 60, length: 70 },
          "S": { shoulder: 47, chest: 104, waist: 104, sleeve: 62, length: 72 },
          "M": { shoulder: 50, chest: 109, waist: 109, sleeve: 63, length: 74 },
          "L": { shoulder: 52, chest: 115, waist: 115, sleeve: 64, length: 76 },
          "XL": { shoulder: 55, chest: 121, waist: 121, sleeve: 65, length: 78 },
          "XXL": { shoulder: 57, chest: 128, waist: 128, sleeve: 66, length: 80 },
          "XXXL": { shoulder: 60, chest: 135, waist: 135, sleeve: 67, length: 82 }
        }
      },
      sweatshirt_regular: {
        description: "맨투맨/스웨트셔츠 (레귤러 핏, 남성)",
        sizes: {
          "XS": { shoulder: 44, chest: 97, waist: 92, sleeve: 59, length: 66 },
          "S": { shoulder: 46, chest: 101, waist: 96, sleeve: 61, length: 68 },
          "M": { shoulder: 49, chest: 106, waist: 101, sleeve: 62, length: 70 },
          "L": { shoulder: 51, chest: 112, waist: 107, sleeve: 63, length: 72 },
          "XL": { shoulder: 54, chest: 118, waist: 113, sleeve: 64, length: 74 },
          "XXL": { shoulder: 56, chest: 125, waist: 120, sleeve: 65, length: 76 },
          "XXXL": { shoulder: 59, chest: 132, waist: 127, sleeve: 66, length: 78 }
        }
      },
      sweatshirt_loose: {
        description: "맨투맨/스웨트셔츠 (루즈 핏, 남성)",
        sizes: {
          "XS": { shoulder: 48, chest: 105, waist: 100, sleeve: 60, length: 68 },
          "S": { shoulder: 50, chest: 109, waist: 104, sleeve: 62, length: 70 },
          "M": { shoulder: 53, chest: 114, waist: 109, sleeve: 63, length: 72 },
          "L": { shoulder: 55, chest: 120, waist: 115, sleeve: 64, length: 74 },
          "XL": { shoulder: 58, chest: 126, waist: 121, sleeve: 65, length: 76 },
          "XXL": { shoulder: 60, chest: 133, waist: 128, sleeve: 66, length: 78 },
          "XXXL": { shoulder: 63, chest: 140, waist: 135, sleeve: 67, length: 80 }
        }
      },
      shorts: {
        description: "반바지 (남성)",
        sizes: {
          "XS": { waist: 73, length: 42 },
          "S": { waist: 77, length: 44 },
          "M": { waist: 81, length: 46 },
          "L": { waist: 85, length: 48 },
          "XL": { waist: 89, length: 50 },
          "XXL": { waist: 93, length: 52 },
          "XXXL": { waist: 97, length: 54 }
        }
      },
      long_pants: {
        description: "긴바지 (남성)",
        fits: {
          regular: {
            "XS": { waist: 70, hip: 91, thigh: 52, inseam: 100, bottom_width: 18 },
            "S": { waist: 75, hip: 96, thigh: 55, inseam: 103, bottom_width: 19 },
            "M": { waist: 80, hip: 101, thigh: 58, inseam: 106, bottom_width: 20 },
            "L": { waist: 85, hip: 106, thigh: 61, inseam: 109, bottom_width: 21 },
            "XL": { waist: 90, hip: 111, thigh: 64, inseam: 112, bottom_width: 22 },
            "XXL": { waist: 95, hip: 116, thigh: 66, inseam: 115, bottom_width: 23 },
            "XXXL": { waist: 100, hip: 121, thigh: 68, inseam: 118, bottom_width: 24 }
          },
          wide: {
            "XS": { waist: 70, hip: 91, thigh: 56, inseam: 100, bottom_width: 22 },
            "S": { waist: 75, hip: 96, thigh: 59, inseam: 103, bottom_width: 23 },
            "M": { waist: 80, hip: 101, thigh: 62, inseam: 106, bottom_width: 24 },
            "L": { waist: 85, hip: 106, thigh: 66, inseam: 109, bottom_width: 25 },
            "XL": { waist: 90, hip: 111, thigh: 70, inseam: 112, bottom_width: 26 },
            "XXL": { waist: 95, hip: 116, thigh: 72, inseam: 115, bottom_width: 27 },
            "XXXL": { waist: 100, hip: 121, thigh: 74, inseam: 118, bottom_width: 28 }
          },
          skinny: {
            "XS": { waist: 70, hip: 91, thigh: 48, inseam: 100, bottom_width: 14 },
            "S": { waist: 75, hip: 96, thigh: 51, inseam: 103, bottom_width: 15 },
            "M": { waist: 80, hip: 101, thigh: 54, inseam: 106, bottom_width: 16 },
            "L": { waist: 85, hip: 106, thigh: 57, inseam: 109, bottom_width: 17 },
            "XL": { waist: 90, hip: 111, thigh: 60, inseam: 112, bottom_width: 18 },
            "XXL": { waist: 95, hip: 116, thigh: 62, inseam: 115, bottom_width: 19 },
            "XXXL": { waist: 100, hip: 121, thigh: 64, inseam: 118, bottom_width: 20 }
          }
        }
      }
    }
  },
  women: {
    recommendedSizes: [
      { height: "150 ~ 155", size: "XS (44)" },
      { height: "155 ~ 160", size: "S (55)" },
      { height: "160 ~ 165", size: "M (66)" },
      { height: "165 ~ 170", size: "L (77)" },
      { height: "170 ~ 175", size: "XL (88)" },
      { height: "175 ~ 180", size: "XXL (99)" },
      { height: "180 ~ 185", size: "XXXL (110)" }
    ],
    categories: {
      outer_jacket: {
        description: "아우터/자켓 (여성)",
        sizes: {
          "XS": { shoulder: 37, bust: 85, waist: 75, sleeve: 56, length: 63 },
          "S": { shoulder: 38, bust: 90, waist: 80, sleeve: 58, length: 65 },
          "M": { shoulder: 40, bust: 95, waist: 85, sleeve: 60, length: 67 },
          "L": { shoulder: 42, bust: 100, waist: 90, sleeve: 62, length: 69 },
          "XL": { shoulder: 44, bust: 105, waist: 95, sleeve: 64, length: 71 },
          "XXL": { shoulder: 46, bust: 110, waist: 100, sleeve: 66, length: 73 },
          "XXXL": { shoulder: 48, bust: 115, waist: 105, sleeve: 68, length: 75 }
        }
      },
      short_sleeve: {
        description: "반팔 티셔츠 (레귤러 핏, 여성)",
        sizes: {
          "XS": { shoulder: 37, bust: 85, waist: 75, sleeve: 15, length: 58 },
          "S": { shoulder: 38, bust: 90, waist: 80, sleeve: 16, length: 60 },
          "M": { shoulder: 40, bust: 95, waist: 85, sleeve: 17, length: 62 },
          "L": { shoulder: 42, bust: 100, waist: 90, sleeve: 18, length: 64 },
          "XL": { shoulder: 44, bust: 105, waist: 95, sleeve: 19, length: 66 },
          "XXL": { shoulder: 46, bust: 110, waist: 100, sleeve: 20, length: 68 },
          "XXXL": { shoulder: 48, bust: 115, waist: 105, sleeve: 21, length: 70 }
        }
      },
      long_sleeve_regular: {
        description: "긴팔 티셔츠 (레귤러 핏, 여성)",
        sizes: {
          "XS": { shoulder: 37, bust: 85, waist: 75, sleeve: 56, length: 58 },
          "S": { shoulder: 38, bust: 90, waist: 80, sleeve: 58, length: 60 },
          "M": { shoulder: 40, bust: 95, waist: 85, sleeve: 60, length: 62 },
          "L": { shoulder: 42, bust: 100, waist: 90, sleeve: 62, length: 64 },
          "XL": { shoulder: 44, bust: 105, waist: 95, sleeve: 64, length: 66 },
          "XXL": { shoulder: 46, bust: 110, waist: 100, sleeve: 66, length: 68 },
          "XXXL": { shoulder: 48, bust: 115, waist: 105, sleeve: 68, length: 70 }
        }
      },
      long_sleeve_loose: {
        description: "긴팔 티셔츠 (루즈 핏, 여성)",
        sizes: {
          "XS": { shoulder: 40, bust: 93, waist: 88, sleeve: 58, length: 60 },
          "S": { shoulder: 41, bust: 98, waist: 93, sleeve: 60, length: 62 },
          "M": { shoulder: 43, bust: 103, waist: 98, sleeve: 62, length: 64 },
          "L": { shoulder: 45, bust: 108, waist: 103, sleeve: 64, length: 66 },
          "XL": { shoulder: 47, bust: 113, waist: 108, sleeve: 66, length: 68 },
          "XXL": { shoulder: 49, bust: 118, waist: 113, sleeve: 68, length: 70 },
          "XXXL": { shoulder: 51, bust: 123, waist: 118, sleeve: 70, length: 72 }
        }
      },
      sweatshirt_regular: {
        description: "맨투맨/스웨트셔츠 (레귤러 핏, 여성)",
        sizes: {
          "XS": { shoulder: 39, bust: 90, waist: 85, sleeve: 57, length: 56 },
          "S": { shoulder: 40, bust: 95, waist: 90, sleeve: 59, length: 58 },
          "M": { shoulder: 42, bust: 100, waist: 95, sleeve: 60, length: 60 },
          "L": { shoulder: 44, bust: 105, waist: 100, sleeve: 62, length: 62 },
          "XL": { shoulder: 46, bust: 110, waist: 105, sleeve: 64, length: 64 },
          "XXL": { shoulder: 48, bust: 115, waist: 110, sleeve: 66, length: 66 },
          "XXXL": { shoulder: 50, bust: 120, waist: 115, sleeve: 68, length: 68 }
        }
      },
      sweatshirt_loose: {
        description: "맨투맨/스웨트셔츠 (루즈 핏, 여성)",
        sizes: {
          "XS": { shoulder: 43, bust: 98, waist: 93, sleeve: 58, length: 58 },
          "S": { shoulder: 44, bust: 103, waist: 98, sleeve: 60, length: 60 },
          "M": { shoulder: 46, bust: 108, waist: 103, sleeve: 62, length: 62 },
          "L": { shoulder: 48, bust: 113, waist: 108, sleeve: 64, length: 64 },
          "XL": { shoulder: 50, bust: 118, waist: 113, sleeve: 66, length: 66 },
          "XXL": { shoulder: 52, bust: 123, waist: 118, sleeve: 68, length: 68 },
          "XXXL": { shoulder: 54, bust: 128, waist: 123, sleeve: 70, length: 70 }
        }
      },
      shorts: {
        description: "반바지 (여성)",
        sizes: {
          "XS": { waist: 61, length: 30 },
          "S": { waist: 66, length: 32 },
          "M": { waist: 71, length: 34 },
          "L": { waist: 76, length: 36 },
          "XL": { waist: 81, length: 38 },
          "XXL": { waist: 86, length: 40 },
          "XXXL": { waist: 91, length: 42 }
        }
      },
      long_pants: {
        description: "긴바지 (여성)",
        fits: {
          regular: {
            "XS": { waist: 60, hip: 80, thigh: 45, inseam: 96, bottom_width: 16 },
            "S": { waist: 65, hip: 85, thigh: 48, inseam: 98, bottom_width: 17 },
            "M": { waist: 70, hip: 90, thigh: 51, inseam: 100, bottom_width: 18 },
            "L": { waist: 75, hip: 95, thigh: 54, inseam: 102, bottom_width: 19 },
            "XL": { waist: 80, hip: 100, thigh: 57, inseam: 104, bottom_width: 20 },
            "XXL": { waist: 85, hip: 105, thigh: 60, inseam: 106, bottom_width: 21 },
            "XXXL": { waist: 90, hip: 110, thigh: 62, inseam: 108, bottom_width: 22 }
          },
          wide: {
            "XS": { waist: 60, hip: 80, thigh: 48, inseam: 96, bottom_width: 20 },
            "S": { waist: 65, hip: 85, thigh: 52, inseam: 98, bottom_width: 21 },
            "M": { waist: 70, hip: 90, thigh: 55, inseam: 100, bottom_width: 22 },
            "L": { waist: 75, hip: 95, thigh: 58, inseam: 102, bottom_width: 23 },
            "XL": { waist: 80, hip: 100, thigh: 61, inseam: 104, bottom_width: 24 },
            "XXL": { waist: 85, hip: 105, thigh: 64, inseam: 106, bottom_width: 25 },
            "XXXL": { waist: 90, hip: 110, thigh: 66, inseam: 108, bottom_width: 26 }
          },
          skinny: {
            "XS": { waist: 60, hip: 80, thigh: 42, inseam: 96, bottom_width: 12 },
            "S": { waist: 65, hip: 85, thigh: 44, inseam: 98, bottom_width: 13 },
            "M": { waist: 70, hip: 90, thigh: 47, inseam: 100, bottom_width: 14 },
            "L": { waist: 75, hip: 95, thigh: 50, inseam: 102, bottom_width: 15 },
            "XL": { waist: 80, hip: 100, thigh: 53, inseam: 104, bottom_width: 16 },
            "XXL": { waist: 85, hip: 105, thigh: 56, inseam: 106, bottom_width: 17 },
            "XXXL": { waist: 90, hip: 110, thigh: 58, inseam: 108, bottom_width: 18 }
          }
        }
      }
    }
  }
} as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { gender, height, type, fit = 'regular' } = await req.json()

    if (!gender || !height || !type) {
      throw new Error('Missing required parameters')
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const genderData = gender === 'men' ? sizeData.men : sizeData.women
    const prompt = `
사용자의 정보:
- 성별: ${gender === 'men' ? '남성' : '여성'}
- 키: ${height}cm
- 의류 종류: ${type}
- 핏: ${fit}

다음의 사이즈 데이터를 기반으로 사용자에게 가장 적합한 사이즈를 추천해주세요:
${JSON.stringify(genderData, null, 2)}

다음 형식으로 응답해주세요:
1. 추천 사이즈
2. 추천 이유
3. 실제 측정값
4. 주의사항이나 팁
`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: '당신은 전문 의류 사이즈 추천 AI입니다. 사용자의 체형과 선호도를 고려하여 가장 적합한 사이즈를 추천해주세요.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    })

    const data = await response.json()
    const recommendation = data.choices[0].message.content

    return new Response(JSON.stringify({ recommendation }), {
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
