// deno test supabase/functions/_shared/detailImagePrompt_test.ts
import { DETAIL_IMAGE_TYPES, DETAIL_PAGE_STYLES, IMAGE_ASPECT_RATIO, buildProductImagePrompt, type PromptProduct } from "./detailImagePrompt.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const product: PromptProduct = {
  clothType: "hoodie",
  color: "heather gray",
  material: "",
  fit: "",
  designDescription: "",
  decorations: [{ kind: "print", label: "silkscreen print", location: "back" }],
  accessories: [],
  constructionFeatures: [],
  isFrontBackComposite: true,
  parts: ["hood", "print"],
};

Deno.test("every image type and style builds a prompt with identity lock and realism rules", () => {
  for (const imageType of DETAIL_IMAGE_TYPES) {
    assert(Boolean(IMAGE_ASPECT_RATIO[imageType]), `ratio for ${imageType}`);
    for (const style of DETAIL_PAGE_STYLES) {
      const prompt = buildProductImagePrompt({ product, referenceImages: ["design"], imageType, detailPageStyle: style });
      assert(prompt.includes("PRODUCT IDENTITY LOCK"), `${imageType}/${style}: identity lock`);
      assert(prompt.includes("NO HDR look"), `${imageType}/${style}: realism`);
      assert(prompt.includes("NEVER invent construction"), `${imageType}/${style}: no invented details`);
    }
  }
});

Deno.test("confirmed parts are listed and the art-direction ratio is honoured", () => {
  const prompt = buildProductImagePrompt({ product, referenceImages: ["design"], imageType: "detail_neck", detailPageStyle: "editorial", aspectRatio: "21:9" });
  assert(prompt.includes("HOOD opening"), "neck close-up follows the confirmed hood");
  assert(prompt.includes("Details confirmed to exist on this garment: hood, print"), "parts listed");
  assert(prompt.includes("aspect ratio 21:9"), "requested ratio");
  const fallback = buildProductImagePrompt({ product, referenceImages: ["design"], imageType: "hero", detailPageStyle: "minimal", aspectRatio: "7:1" });
  assert(fallback.includes(`aspect ratio ${IMAGE_ASPECT_RATIO.hero}`), "unsupported ratio falls back");
});
