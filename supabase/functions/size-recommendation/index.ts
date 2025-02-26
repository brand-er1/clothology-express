
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sizeData = {
  men: {
    // ... 남성 사이즈 데이터
  },
  women: {
    // ... 여성 사이즈 데이터
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
