import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.31.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ClosetSlot = "top" | "outer" | "bottom" | "skirt" | "dress" | "shoes" | "accessory";
type Gender = "male" | "female";

const validSlots = new Set<ClosetSlot>(["top", "outer", "bottom", "skirt", "dress", "shoes", "accessory"]);
const supportedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const femaleSizes = new Set(["44", "55", "66"]);
const maleSizes = new Set(["l", "xl", "2xl"]);

const bodyDescriptions: Record<string, string> = {
  "female-44": "slimmest female preset with narrow shoulders and a slim chest, waist, hips, arms and legs",
  "female-55": "slim-to-standard female preset close to the average reference silhouette",
  "female-66": "standard-to-fuller female preset with slightly more body volume than size 55",
  "male-l": "standard male preset with average shoulder, chest, waist, arm and leg proportions",
  "male-xl": "slightly fuller male preset with broader shoulders, chest, waist, arms and legs than L",
  "male-2xl": "fuller natural male preset with more upper and lower body volume than XL",
};

const slotDescriptions: Record<ClosetSlot, string> = {
  top: "UPPER BODY ONLY: shoulders, arms, chest and torso; never place it on hips or legs",
  outer: "UPPER BODY OUTER LAYER ONLY: shoulders, arms and torso; never replace lower-body clothing",
  bottom: "LOWER BODY ONLY: waist, hips and legs; never place it on chest, shoulders or arms",
  skirt: "LOWER BODY ONLY: waist and hips down over the legs; never place it on the torso",
  dress: "FULL BODY DRESS: torso and legs as one garment; replaces top, bottom and skirt",
  shoes: "FEET ONLY",
  accessory: "NORMAL ACCESSORY LOCATION ONLY",
};

const stripDataUrl = (value: string) => value.replace(/^data:image\/[^;]+;base64,/, "");

const decodeBase64 = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const extensionForMime = (mimeType: string) => {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
};

interface ImageRef { base64: string; mimeType: string }
interface GarmentInput {
  slot: ClosetSlot;
  label?: string;
  image: ImageRef;
  backImage?: ImageRef;
  fitInfo?: Record<string, unknown>;
}

const generateFastFitting = async (
  apiKey: string,
  parts: Array<Record<string, unknown>>,
): Promise<{ base64: string; mimeType: string; textResponse: string } | null> => {
  // Flash first + 1K output are intentional: virtual fitting is an interactive preview,
  // so latency matters more than producing a 2K master image on every wardrobe change.
  const models = ["gemini-3.1-flash-image", "gemini-2.5-flash-image", "gemini-3-pro-image"];
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.1,
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: {
              aspectRatio: "3:4",
              imageSize: model === "gemini-2.5-flash-image" ? undefined : "1K",
            },
          },
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      console.warn("virtual-fitting model failed", model, response.status, body);
      if (response.status === 404 || response.status >= 500) continue;
      return null;
    }
    const data = await response.json();
    const responseParts = data?.candidates?.[0]?.content?.parts || [];
    let base64 = "";
    let mimeType = "image/png";
    let textResponse = "";
    for (const part of responseParts) {
      if (!base64 && part.inlineData?.data) {
        base64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
      if (part.text) textResponse += part.text;
    }
    if (base64) return { base64, mimeType, textResponse };
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let requestId: string | null = null;
  const fail = async (message: string, status = 400) => {
    if (requestId) {
      await supabase.from("virtual_fitting_requests").delete().eq("request_id", requestId);
    }
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    if (!geminiApiKey) return fail("GEMINI_API_KEY not configured", 500);

    const body = await req.json();
    requestId = typeof body?.requestId === "string" && body.requestId.trim()
      ? body.requestId.trim().slice(0, 128)
      : null;

    if (requestId) {
      const { data: existing } = await supabase
        .from("virtual_fitting_requests")
        .select("status, result")
        .eq("request_id", requestId)
        .maybeSingle();
      if (existing?.status === "done" && existing.result) {
        return new Response(JSON.stringify({ ...existing.result, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing?.status === "processing") {
        return new Response(JSON.stringify({ processing: true, error: "이미 처리 중인 요청입니다." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: claimError } = await supabase
        .from("virtual_fitting_requests")
        .insert({ request_id: requestId, status: "processing" });
      if (claimError) {
        return new Response(JSON.stringify({ processing: true, error: "이미 처리 중인 요청입니다." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const gender: Gender = body?.gender === "female" ? "female" : "male";
    const mannequinSize = String(body?.mannequinSize || "").toLowerCase();
    const validSize = gender === "female" ? femaleSizes.has(mannequinSize) : maleSizes.has(mannequinSize);
    if (!validSize) return fail("유효하지 않은 마네킹 사이즈입니다.");

    const mannequinImage: ImageRef = {
      base64: stripDataUrl(String(body?.mannequinImage?.base64 || "")),
      mimeType: String(body?.mannequinImage?.mimeType || ""),
    };
    const identityImage: ImageRef = {
      base64: stripDataUrl(String(body?.identityImage?.base64 || "")),
      mimeType: String(body?.identityImage?.mimeType || ""),
    };
    if (!mannequinImage.base64 || !supportedMimeTypes.has(mannequinImage.mimeType)) {
      return fail("전신 마네킹 기준 이미지가 필요합니다.");
    }
    if (!identityImage.base64 || !supportedMimeTypes.has(identityImage.mimeType)) {
      return fail("얼굴 기준 이미지가 필요합니다.");
    }

    const garments: GarmentInput[] = Array.isArray(body?.garments)
      ? body.garments.flatMap((raw: Record<string, any>) => {
          const slot = validSlots.has(raw?.slot as ClosetSlot) ? raw.slot as ClosetSlot : "top";
          const image = {
            base64: stripDataUrl(String(raw?.image?.base64 || "")),
            mimeType: String(raw?.image?.mimeType || ""),
          };
          if (!image.base64 || !supportedMimeTypes.has(image.mimeType)) return [];
          const backImage = raw?.backImage?.base64 && supportedMimeTypes.has(String(raw.backImage.mimeType || ""))
            ? { base64: stripDataUrl(String(raw.backImage.base64)), mimeType: String(raw.backImage.mimeType) }
            : undefined;
          return [{ slot, label: typeof raw?.label === "string" ? raw.label.slice(0, 120) : undefined, image, backImage, fitInfo: raw?.fitInfo || {} }];
        })
      : [];

    const changedSlots: ClosetSlot[] = Array.isArray(body?.changedSlots)
      ? body.changedSlots.filter((slot: unknown): slot is ClosetSlot => validSlots.has(slot as ClosetSlot))
      : [];
    if (!garments.length && !changedSlots.length) return fail("변경할 의류가 필요합니다.");
    if (garments.length > 6) return fail("한 번에 입힐 수 있는 의류는 최대 6개입니다.");

    const bodyDescription = bodyDescriptions[`${gender}-${mannequinSize}`];
    const garmentText = garments.map((garment, index) => {
      const fitType = String(garment.fitInfo?.fitType || "regular");
      const measurements = garment.fitInfo?.measurements && typeof garment.fitInfo.measurements === "object"
        ? JSON.stringify(garment.fitInfo.measurements)
        : "none";
      return `Garment ${index + 1}: slot=${garment.slot}, label=${garment.label || "garment"}, fit=${fitType}, measurements=${measurements}. ${slotDescriptions[garment.slot]}.`;
    }).join("\n");

    const prompt = `AI VIRTUAL FITTING IMAGE EDIT. Start from Reference Image 1 and keep the mannequin identity and scene fixed.\n\nHARD LOCKS:\n- Exact face, hair, skin tone and identity from Reference Image 2.\n- Exact ${bodyDescription} body shape, height, pose, camera angle, framing, background and lighting from Reference Image 1.\n- Apply every supplied garment to its declared anatomical slot. TOP/OUTER must never appear on legs. BOTTOM/SKIRT must never appear on torso.\n- Preserve garment color, silhouette, logo, print, pattern, seams, pockets, zippers, buttons, collar, hood and material.\n- Do not invent garments in empty slots. OUTER may layer over TOP. DRESS replaces TOP/BOTTOM/SKIRT.\n- Show realistic drape/tension for the selected mannequin size without scaling or distorting the body.\n- Return exactly one clean 3:4 full-body image with head, hands and feet visible; no caption, watermark, split view or extra person.\n\nChanged slots: ${changedSlots.join(", ") || garments.map(g => g.slot).join(", ")}\n${garmentText}`;

    const parts: Array<Record<string, unknown>> = [
      { text: prompt },
      { text: "Reference Image 1 — canonical full-body mannequin/body/pose/scene." },
      { inlineData: { data: mannequinImage.base64, mimeType: mannequinImage.mimeType } },
      { text: "Reference Image 2 — canonical face identity reference." },
      { inlineData: { data: identityImage.base64, mimeType: identityImage.mimeType } },
    ];
    garments.forEach((garment, index) => {
      parts.push(
        { text: `Garment reference ${index + 1}: ${garment.slot}. ${slotDescriptions[garment.slot]}` },
        { inlineData: { data: garment.image.base64, mimeType: garment.image.mimeType } },
      );
      if (garment.backImage) {
        parts.push(
          { text: `Back view of the same ${garment.slot} garment.` },
          { inlineData: { data: garment.backImage.base64, mimeType: garment.backImage.mimeType } },
        );
      }
    });
    parts.push({ text: "FINAL CHECK: correct body region for every garment; exact face/body/pose/scene; garment design preserved." });

    const generated = await generateFastFitting(geminiApiKey, parts);
    if (!generated) return fail("이미지를 생성하지 못했습니다. 다시 시도해주세요.", 502);

    const bytes = decodeBase64(generated.base64);
    const extension = extensionForMime(generated.mimeType);
    const fileName = `${body?.userId || "anon"}/virtual-fitting/${Date.now()}_${crypto.randomUUID()}.${extension}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("generated_images")
      .upload(fileName, bytes, { contentType: generated.mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from("generated_images").getPublicUrl(uploadData?.path || fileName);
    const responseBody = {
      success: true,
      renderedImageUrl: publicUrlData.publicUrl,
      renderedImagePath: uploadData?.path || fileName,
      textResponse: generated.textResponse || null,
      hasImage: Boolean(publicUrlData.publicUrl),
      gender,
      mannequinSize,
      isSimulated: !garments.some((g) => Boolean(g.fitInfo?.hasMeasurements)),
      requestId,
      faceScore: null,
      preservationApproved: null,
      garmentApplied: null,
      identityRetryApplied: false,
      performanceMode: "fast-1k-single-pass",
    };

    if (requestId) {
      await supabase
        .from("virtual_fitting_requests")
        .update({ status: "done", result: responseBody })
        .eq("request_id", requestId);
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("virtual-fitting fast pipeline error", error);
    if (requestId) {
      await supabase.from("virtual_fitting_requests").delete().eq("request_id", requestId);
    }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
