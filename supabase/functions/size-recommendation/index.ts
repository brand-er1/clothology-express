
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sizeData, tolerances, sizeRanges, measurementCategories, clothingTypeTranslation, genderTranslation } from "./size-data.ts";

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
      input: {},
      processing: [],
      result: {},
      errors: [],
      warnings: [],
      intermediateSteps: {}
    };

    // Parse the request body
    const requestData = await req.json();
    debug.input = requestData;
    debug.processing.push("Request received and parsed");

    const { gender, clothingType, customMeasurements, prompt } = requestData;

    // Validate required parameters
    if (!gender || !clothingType) {
      debug.errors.push("Missing required parameters: gender or clothingType");
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameters",
          debug
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    debug.processing.push(`Processing request for gender: ${gender}, clothing type: ${clothingType}`);
    
    // Translate Korean clothing type to English
    const clothingTypeEn = clothingTypeTranslation[clothingType] || clothingType;
    debug.intermediateSteps.translatedClothingType = clothingTypeEn;
    debug.processing.push(`Translated clothing type from "${clothingType}" to "${clothingTypeEn}"`);

    // Translate Korean gender to English
    const genderEn = genderTranslation[gender] || gender;
    debug.intermediateSteps.translatedGender = genderEn;
    debug.processing.push(`Translated gender from "${gender}" to "${genderEn}"`);

    // Check if the clothing type is valid for the gender
    if (clothingTypeEn === "dresses" && genderEn === "men") {
      debug.errors.push("Dresses are not available for men in our dataset");
      return new Response(
        JSON.stringify({
          error: "This clothing type is not available for the selected gender",
          debug
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Initialize results
    let recommendedSize = null;
    let recommendedMeasurements = null;

    // If we have custom measurements, calculate recommended size
    if (customMeasurements && Object.keys(customMeasurements).length > 0) {
      debug.processing.push("Custom measurements provided, calculating recommended size");
      debug.intermediateSteps.customMeasurements = customMeasurements;
      
      // Get relevant measurement categories for this clothing type
      const relevantMeasurements = measurementCategories[clothingType] || [];
      debug.intermediateSteps.relevantMeasurements = relevantMeasurements;
      debug.processing.push(`Relevant measurements for ${clothingType}: ${relevantMeasurements.join(", ")}`);

      // Get size data for this clothing type and gender
      const clothingSizeData = sizeData[clothingTypeEn]?.[genderEn];
      debug.intermediateSteps.clothingSizeData = clothingSizeData;
      
      if (!clothingSizeData) {
        debug.errors.push(`Size data not found for ${clothingTypeEn} and ${genderEn}`);
        return new Response(
          JSON.stringify({
            error: `Size data not found for this clothing type and gender`,
            debug
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      // Calculate score for each size based on how well measurements match
      const sizeScores = {};
      const sizeDistances = {};
      
      // Process each standard size
      Object.entries(clothingSizeData).forEach(([size, measurements]) => {
        let score = 0;
        let totalWeight = 0;
        const distances = {};
        
        // Check each relevant measurement
        Object.entries(measurements).forEach(([measurement, standardValue]) => {
          if (
            relevantMeasurements.includes(measurement) && 
            customMeasurements[measurement] !== undefined
          ) {
            const userValue = customMeasurements[measurement];
            const tolerance = tolerances[measurement] || 2;
            const distance = Math.abs(userValue - standardValue);
            distances[measurement] = distance;
            
            // Calculate weighted score (lower is better)
            // Weight is inversely proportional to tolerance
            const weight = 1 / tolerance;
            score += distance * weight;
            totalWeight += weight;
          }
        });
        
        // Normalize score
        if (totalWeight > 0) {
          sizeScores[size] = score / totalWeight;
          sizeDistances[size] = distances;
        }
      });
      
      debug.intermediateSteps.sizeScores = sizeScores;
      debug.intermediateSteps.sizeDistances = sizeDistances;
      debug.processing.push("Calculated size scores based on custom measurements");

      // Find the size with the lowest score (best fit)
      if (Object.keys(sizeScores).length > 0) {
        recommendedSize = Object.entries(sizeScores).sort((a, b) => a[1] - b[1])[0][0];
        recommendedMeasurements = clothingSizeData[recommendedSize];
        
        debug.processing.push(`Recommended size based on measurements: ${recommendedSize}`);
        debug.intermediateSteps.recommendedSizeFromMeasurements = recommendedSize;
      } else {
        debug.warnings.push("Could not calculate size based on provided measurements");
      }
    }

    // If we have a prompt, we could analyze it for size information
    // This would be a good place to integrate with an AI model for more advanced analysis
    if (prompt) {
      debug.processing.push("Prompt provided, analyzing for additional context");
      debug.intermediateSteps.prompt = prompt;
      
      // For now, we'll just log the prompt. In a real implementation,
      // you would send this to an AI service and process the results.
      console.log("User provided prompt:", prompt);
    }

    // If no size was recommended through measurements, fallback to a default
    if (!recommendedSize) {
      recommendedSize = "m"; // Default to medium
      recommendedMeasurements = sizeData[clothingTypeEn]?.[genderEn]?.[recommendedSize] || null;
      debug.warnings.push("Using default size 'M' as fallback");
    }

    // Prepare response
    const response = {
      recommendedSize: recommendedSize.toUpperCase(),
      measurements: recommendedMeasurements,
      clothingType: clothingTypeEn,
      gender: genderEn,
      debug
    };

    debug.result = {
      recommendedSize: recommendedSize.toUpperCase(),
      measurements: recommendedMeasurements
    };
    debug.processing.push("Size recommendation complete");

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in size recommendation:", error);
    
    return new Response(
      JSON.stringify({
        error: "Failed to process size recommendation",
        message: error.message,
        debug: {
          error: error.message,
          stack: error.stack
        }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
