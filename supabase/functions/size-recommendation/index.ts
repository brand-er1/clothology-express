
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sizeData, sizeRanges, clothingTypeTranslation, genderTranslation } from "./size-data.ts";

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const debug = { 
      steps: [],
      errors: [],
      warnings: []
    };

    // Parse the request body
    const requestData = await req.json();
    debug.steps.push({ step: "Request received", data: requestData });

    // Extract request parameters with defaults
    const { 
      gender = "men", 
      height = 175, 
      type = "shirts", 
      material = "cotton", 
      detail = "",
      prompt = "",
      fit = "regular" 
    } = requestData;

    // Validate required parameters
    if (!gender || !type) {
      debug.errors.push("Missing required parameters: gender or type");
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameters",
          debugLogs: debug
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    debug.steps.push({ step: "Processing request", data: { gender, height, type, material, detail, fit } });
    
    // Translate type to clothingType for the size data
    const clothingTypeEn = clothingTypeTranslation[type] || type;
    debug.steps.push({ step: "Translated clothing type", data: { from: type, to: clothingTypeEn } });

    // Translate gender
    const genderEn = genderTranslation[gender] || gender;
    debug.steps.push({ step: "Translated gender", data: { from: gender, to: genderEn } });

    // Get size data for this clothing type and gender
    const clothingSizeData = sizeData[clothingTypeEn]?.[genderEn];
    
    if (!clothingSizeData) {
      debug.errors.push(`Size data not found for ${clothingTypeEn} and ${genderEn}`);
      return new Response(
        JSON.stringify({
          error: `Size data not found for this clothing type and gender`,
          debugLogs: debug
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    debug.steps.push({ step: "Retrieved size data", data: clothingSizeData });

    // Determine recommended size based on height
    let recommendedSize = "m"; // Default
    
    // Get size ranges for this clothing type
    const ranges = sizeRanges[clothingTypeEn]?.[genderEn];
    
    if (ranges) {
      for (const [size, range] of Object.entries(ranges)) {
        if (height >= range.min && height <= range.max) {
          recommendedSize = size;
          break;
        }
      }
      debug.steps.push({ step: "Determined size from height", data: { height, recommendedSize, ranges } });
    } else {
      debug.warnings.push(`No size ranges found for ${clothingTypeEn} and ${genderEn}, using default size ${recommendedSize}`);
    }

    // Get measurements for recommended size
    const measurements = clothingSizeData[recommendedSize] || {};
    debug.steps.push({ step: "Retrieved measurements", data: measurements });

    // Prepare and return the response
    const response = {
      성별: genderEn === "men" ? "남성" : "여성",
      키: height,
      카테고리: type,
      핏: fit,
      사이즈: recommendedSize.toUpperCase(),
      사이즈표: measurements,
      debugLogs: debug
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in size recommendation:", error);
    
    return new Response(
      JSON.stringify({
        error: "Failed to process size recommendation",
        message: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
