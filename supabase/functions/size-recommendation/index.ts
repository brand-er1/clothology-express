
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { sizeCharts, typeMapping, categoryMapping, heightRanges } from "./size-data.ts"
import { corsHeaders } from "../_shared/cors.ts"

// Interface for size recommendation request
interface SizeRecommendationRequest {
  gender: string;       // 남성 or 여성
  height: number;       // in cm
  type: string;         // 의류 유형 (e.g., 티셔츠, 셔츠, 바지)
  material?: string;    // 옵션: 소재
  detail?: string;      // 옵션: 세부 사항
  prompt?: string;      // 옵션: 생성된 프롬프트
}

serve(async (req) => {
  console.log("Size recommendation function called")
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse request body
    const requestData: SizeRecommendationRequest = await req.json()
    console.log("Request data:", JSON.stringify(requestData))

    // Validate required fields
    if (!requestData.gender || !requestData.height || !requestData.type) {
      console.error("Missing required fields in request")
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Transform Korean type to English type
    const engType = typeMapping[requestData.type] || requestData.type
    
    // Get the category based on the type
    const category = categoryMapping[engType]
    
    if (!category) {
      console.error("Invalid clothing type:", requestData.type)
      return new Response(
        JSON.stringify({ error: "Invalid clothing type" }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      )
    }

    // Get appropriate size chart based on gender and category
    const gender = requestData.gender === "남성" ? "남성" : "여성"
    const sizeChart = sizeCharts[gender][category]
    
    if (!sizeChart) {
      console.error("Size chart not found for:", gender, category)
      return new Response(
        JSON.stringify({ error: "Size chart not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Determine size based on height
    const heightRangeKey = gender === "남성" ? "men" : "women"
    const heights = heightRanges[heightRangeKey]
    
    let recommendedSize = "M" // Default to M if no match
    
    for (const [size, range] of Object.entries(heights)) {
      if (requestData.height >= range.min && requestData.height <= range.max) {
        recommendedSize = size
        break
      }
    }
    
    // If height is outside all ranges, pick the closest
    if (requestData.height < heights.XS.min) {
      recommendedSize = "XS"
    } else if (requestData.height > heights.XXL.max) {
      recommendedSize = "XXL"
    }
    
    // Get the measurements for the recommended size
    const measurements = sizeChart[recommendedSize]
    
    if (!measurements) {
      console.error("Measurements not found for size:", recommendedSize)
      return new Response(
        JSON.stringify({ error: "Measurements not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }
    
    // Prepare response data
    const response = {
      성별: gender,
      키: requestData.height,
      사이즈: recommendedSize,
      사이즈표: measurements
    }
    
    console.log("Response data:", JSON.stringify(response))
    
    // Return successful response
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
    
  } catch (error) {
    console.error("Error in size recommendation function:", error.message)
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})
