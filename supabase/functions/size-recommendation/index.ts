
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { clothingTypeSizeData } from './size-data.ts'

interface RequestPayload {
  gender: string;
  height: number;
  type: string;
  material?: string;
  detail?: string;
  prompt?: string;
}

interface SizeRecommendation {
  성별: string;
  키: number;
  사이즈: string;
  사이즈표: Record<string, number>;
}

console.log('Size-recommendation function initialized!')

serve(async (req) => {
  console.log('Request received:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    if (req.method !== 'POST') {
      console.error('Invalid method:', req.method)
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse payload
    const payload: RequestPayload = await req.json()
    console.log('Payload received:', JSON.stringify(payload))
    
    if (!payload || !payload.gender || !payload.height || !payload.type) {
      console.error('Missing required fields in payload')
      return new Response(
        JSON.stringify({ error: 'Missing required fields: gender, height, and type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { gender, height, type } = payload
    
    // Translate type to match the keys in size-data.ts
    const translatedType = translateType(type)
    const mappedGender = mapGender(gender)
    
    console.log(`Translated type: ${translatedType}, Mapped gender: ${mappedGender}`)
    
    // Get size data based on clothing type
    const sizeData = clothingTypeSizeData[translatedType]
    if (!sizeData) {
      console.error(`No size data found for type: ${translatedType}`)
      return new Response(
        JSON.stringify({ error: `No size data available for clothing type: ${type}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the appropriate gender-specific size data
    const genderSizeData = mappedGender === 'men' ? sizeData.men : sizeData.women
    if (!genderSizeData) {
      console.error(`No size data found for gender: ${mappedGender} and type: ${translatedType}`)
      return new Response(
        JSON.stringify({ error: `No size data available for gender: ${gender} and clothing type: ${type}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Determine the recommended size based on height
    let recommendedSize = ''
    const sizeRanges = genderSizeData.sizeRanges
    for (const [size, range] of Object.entries(sizeRanges)) {
      if (height >= range.min && height <= range.max) {
        recommendedSize = size
        break
      }
    }
    
    if (!recommendedSize) {
      // If no exact match, use the closest size
      const sizes = Object.entries(sizeRanges)
      if (height < sizes[0][1].min) {
        recommendedSize = sizes[0][0] // Smallest size
      } else {
        recommendedSize = sizes[sizes.length - 1][0] // Largest size
      }
    }
    
    console.log(`Determined recommended size: ${recommendedSize}`)
    
    // Get the size measurements for the recommended size
    const sizeMeasurements = genderSizeData.sizeMeasurements[recommendedSize]
    if (!sizeMeasurements) {
      console.error(`No size measurements found for size: ${recommendedSize}`)
      return new Response(
        JSON.stringify({ error: `No measurements available for size: ${recommendedSize}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Format the response in Korean according to the expected format
    const response: SizeRecommendation = {
      성별: gender,
      키: height,
      사이즈: recommendedSize,
      사이즈표: sizeMeasurements
    }
    
    console.log('Sending response:', JSON.stringify(response))
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
    
  } catch (error) {
    console.error('Error in size recommendation function:', error.message)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper functions
function translateType(type: string): string {
  const typeMap: Record<string, string> = {
    't_shirt': 'tshirt',
    'short_sleeve': 'tshirt',
    'long_sleeve': 'longsleeve',
    'outer_jacket': 'jacket',
    'sweatshirt': 'sweatshirt',
    'short_pants': 'shorts',
    'jeans': 'jeans',
    'pants': 'pants'
  }
  return typeMap[type] || type
}

function mapGender(gender: string): string {
  if (gender === '남성' || gender.toLowerCase().includes('men') || gender.toLowerCase() === 'male') {
    return 'men'
  }
  return 'women'
}
