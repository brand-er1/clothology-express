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
        model: 'gpt-4o-mini',
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
