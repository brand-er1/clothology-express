
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sizeData } from "./size-data.ts";

// Define CORS headers for browser compatibility
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  console.log("Size recommendation function called");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Parse request body
    const requestData = await req.json();
    const { gender, height, type, material, detail, prompt } = requestData;

    if (!gender || !height || !type) {
      return new Response(
        JSON.stringify({ error: "Required parameters missing: gender, height, or type" }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders,
            "Content-Type": "application/json" 
          } 
        }
      );
    }

    console.log(`Request data: gender=${gender}, height=${height}, type=${type}, material=${material}, detail=${detail}`);

    // Get size data
    const genderKey = gender === "남성" ? "men" : "women";
    const typeKey = type.toLowerCase();

    // Find proper size recommendation using the sizeData
    let sizeFit = null;
    let sizeTableData = null;

    for (const range of sizeData[genderKey].heightRanges) {
      const [min, max] = range.range.split("~").map(Number);
      if (height >= min && height <= max) {
        const baseSize = range.baseSize.split(" ")[0]; // Extract size like "XS", "S"
        
        // Look for matching clothing type
        if (range.clothingTypes[typeKey]) {
          const clothing = range.clothingTypes[typeKey];
          const sizeInfo = clothing.sizes.find(s => s.size === baseSize);
          
          if (sizeInfo) {
            sizeFit = sizeInfo.size;
            sizeTableData = sizeInfo.measurements;
          }
        } else {
          // Fallback to a default clothing type
          sizeFit = baseSize;
        }
        
        break;
      }
    }

    if (!sizeFit) {
      // Default fallback size based on height ranges
      if (height < 165) sizeFit = "XS";
      else if (height < 170) sizeFit = "S";
      else if (height < 175) sizeFit = "M";
      else if (height < 180) sizeFit = "L";
      else if (height < 185) sizeFit = "XL";
      else if (height < 190) sizeFit = "XXL";
      else sizeFit = "XXXL";
    }

    // Construct the response with the size recommendation and measurement details
    const response = {
      성별: gender,
      키: height,
      사이즈: sizeFit,
      옷_종류: type,
      그에_맞는_사이즈_표: sizeTableData || {
        총장: 70, // Default values if specific measurements not found
        어깨너비: 45,
        가슴둘레: 100,
        허리둘레: 90,
        소매길이: 60
      },
      원단: material || "",
      디테일: detail || "",
      프롬프트: prompt || ""
    };

    // Return the response
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );
  } catch (error) {
    console.error("Error processing size recommendation:", error.message);
    
    return new Response(
      JSON.stringify({ error: `Failed to process size recommendation: ${error.message}` }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});
