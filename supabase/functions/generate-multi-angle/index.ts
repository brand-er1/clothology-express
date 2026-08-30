import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedAngles = new Set([0, 45, 90, 135, 180, 225, 270, 315]);
const angleLabels: Record<number, string> = {
  0: "정면",
  45: "좌측 사선",
  90: "좌측면",
  135: "후면 좌측 사선",
  180: "후면",
  225: "후면 우측 사선",
  270: "우측면",
  315: "우측 사선",
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
};

const decodeBase64 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const extensionForMime = (mime: string) => mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";

const promptForAngle = (mode: "garment" | "fitting", angle: number) => {
  const cameraInstruction = angle === 0
    ? "camera directly in front of the subject"
    : angle === 45
      ? "camera orbited 45 degrees toward the subject's left-front side"
      : angle === 90
        ? "camera directly at the subject's left side"
        : angle === 135
          ? "camera at the subject's left-rear three-quarter view"
          : angle === 180
            ? "camera directly behind the subject"
            : angle === 225
              ? "camera at the subject's right-rear three-quarter view"
              : angle === 270
                ? "camera directly at the subject's right side"
                : "camera at the subject's right-front three-quarter view";

  if (mode === "fitting") {
    return `Create one photorealistic alternate camera view of the EXACT SAME virtual fitting shown in the reference image. ${cameraInstruction}. Orbit the CAMERA around the fixed person/mannequin; do not rotate or redesign the subject. Preserve the exact same person identity, face, hairstyle, body proportions, body size, pose family, skin tone, outfit layers, garment colors, prints, logos, trims, seam placement, fabric character, hem lengths and fit. Do not add or remove garments or accessories. Keep neutral premium studio lighting and the same clean background. Full body must remain completely visible and centered, with no crop. This is a product visualization frame, not a fashion redesign. For geometry not directly visible in the reference, infer conservatively and symmetrically; never invent decoration, branding or construction details.`;
  }

  return `Create one photorealistic ecommerce product view of the EXACT SAME garment/design shown in the reference image. ${cameraInstruction}. Treat the reference as the immutable garment identity. Preserve garment type, silhouette, proportions, fabric, color, pattern, logo, graphic placement, pockets, zippers, buttons, seams, hems, cuffs, collar, hood and every visible construction detail. Do not redesign, restyle or add details. Show only the garment, no person or mannequin, on a clean neutral studio background with soft fixed lighting and subtle contact shadow. Keep the complete garment inside frame and centered. The source may contain front and back views side-by-side; use both as identity references but output only ONE garment at the requested camera angle. For geometry not visible in the source, infer the simplest construction consistent with the shown front/back design and never invent branding or decoration.`;
};

const generateOne = async (
  apiKey: string,
  sourceBase64: string,
  sourceMime: string,
  mode: "garment" | "fitting",
  angle: number,
) => {
  const models = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];
  let lastError = "no_image_returned";

  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: model === "gemini-2.5-flash-image"
        ? { aspectRatio: mode === "fitting" ? "3:4" : "4:3" }
        : { aspectRatio: mode === "fitting" ? "3:4" : "4:3", imageSize: "1K" },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { inlineData: { data: sourceBase64, mimeType: sourceMime } },
              { text: promptForAngle(mode, angle) },
            ],
          }],
          generationConfig,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      lastError = `model=${model} status=${response.status}: ${errorBody.slice(0, 500)}`;
      console.error("generate-multi-angle Gemini error", lastError);
      if (![403, 404, 429].includes(response.status) && response.status < 500) break;
      continue;
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data);
    if (imagePart?.inlineData?.data) {
      return {
        base64: imagePart.inlineData.data as string,
        mimeType: (imagePart.inlineData.mimeType || "image/png") as string,
        model,
      };
    }
    lastError = `model=${model} returned no image`;
  }

  throw new Error(lastError);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      return new Response(JSON.stringify({ error: "Server AI configuration is incomplete." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const sourceImageUrl = String(body?.sourceImageUrl || "").trim();
    const mode = body?.mode === "fitting" ? "fitting" : "garment";
    const requestedAngles = Array.isArray(body?.angles) ? body.angles : [...allowedAngles];
    const angles = [...new Set(requestedAngles.map(Number).filter((angle) => allowedAngles.has(angle)))].slice(0, 8);

    if (!sourceImageUrl || angles.length < 4) {
      return new Response(JSON.stringify({ error: "sourceImageUrl and at least four supported angles are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sourceUrl: URL;
    let projectUrl: URL;
    try {
      sourceUrl = new URL(sourceImageUrl);
      projectUrl = new URL(supabaseUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid source image URL." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent this server-side image fetch from becoming a generic SSRF proxy. Generated/fitting
    // images used by BRAND-ER live in the current Supabase project's public storage domain.
    if (sourceUrl.hostname !== projectUrl.hostname || !sourceUrl.pathname.includes("/storage/v1/object/public/")) {
      return new Response(JSON.stringify({ error: "Only BRAND-ER stored images can be used for multi-angle generation." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceResponse = await fetch(sourceImageUrl);
    if (!sourceResponse.ok) {
      return new Response(JSON.stringify({ error: "Could not load the source image." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sourceMime = sourceResponse.headers.get("content-type")?.split(";")[0] || "image/png";
    if (!sourceMime.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Source URL is not an image." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sourceBytes = new Uint8Array(await sourceResponse.arrayBuffer());
    if (sourceBytes.byteLength > 12 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Source image is too large." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sourceBase64 = bytesToBase64(sourceBytes);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const requestId = crypto.randomUUID();
    const frames: Array<{ angle: number; label: string; imageUrl: string; imagePath: string; model: string }> = [];
    const failures: Array<{ angle: number; error: string }> = [];

    // Keep concurrency bounded. Eight simultaneous image generations can easily hit Gemini rate limits;
    // groups of four preserve reasonable latency while allowing partial success.
    for (let offset = 0; offset < angles.length; offset += 4) {
      const batch = angles.slice(offset, offset + 4);
      const results = await Promise.allSettled(
        batch.map(async (angle) => {
          const generated = await generateOne(apiKey, sourceBase64, sourceMime, mode, angle);
          const bytes = decodeBase64(generated.base64);
          const extension = extensionForMime(generated.mimeType);
          const imagePath = `multiview/${mode}/${requestId}-${angle}.${extension}`;
          const { data: upload, error: uploadError } = await supabase.storage
            .from("generated_images")
            .upload(imagePath, bytes, { contentType: generated.mimeType, upsert: false });
          if (uploadError) throw uploadError;
          const { data: publicData } = supabase.storage.from("generated_images").getPublicUrl(upload.path);
          return {
            angle,
            label: angleLabels[angle] || `${angle}°`,
            imageUrl: publicData.publicUrl,
            imagePath: upload.path,
            model: generated.model,
          };
        }),
      );

      results.forEach((result, index) => {
        const angle = batch[index];
        if (result.status === "fulfilled") frames.push(result.value);
        else failures.push({ angle, error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
      });
    }

    frames.sort((a, b) => a.angle - b.angle);
    if (frames.length < 4) {
      console.error("generate-multi-angle insufficient frames", { requestId, failures });
      return new Response(JSON.stringify({
        error: "충분한 각도의 이미지를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
        frames,
        failures,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      requestId,
      sourceImageUrl,
      mode,
      frames,
      partial: failures.length > 0,
      failures: failures.length ? failures : undefined,
      representation: "ai-multiview",
      upgradePath: "3dgs",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-multi-angle unexpected error", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
