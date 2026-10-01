import { describe, expect, it } from "vitest";
import {
  NO_BRANDING_RULES,
  buildImageEditPrompt,
  creatorLogoRules,
  parseBrandLogoMode,
  sanitizeBrandingInstructions,
} from "../../supabase/functions/_shared/brandingPolicy";
import { buildColorVariantPrompt } from "../../supabase/functions/_shared/colorVariantPrompt";
import { buildProductImagePrompt } from "../../supabase/functions/_shared/detailImagePrompt";
import { nearestAspectRatio } from "@/services/aiImageEdit";

const product = {
  clothType: "후드티", color: "블랙", material: "코튼", fit: "오버핏", designDescription: "", decorations: [],
  accessories: [], constructionFeatures: [], isFrontBackComposite: true,
};

describe("AI image branding policy", () => {
  it("defaults to no logo unless the creator explicitly opts in", () => {
    expect(parseBrandLogoMode(undefined)).toBe("none");
    expect(parseBrandLogoMode("brand-er")).toBe("none");
    expect(parseBrandLogoMode("creator")).toBe("creator");
  });

  it("forbids BRAND-ER, invented logos, text and watermarks", () => {
    expect(NO_BRANDING_RULES).toMatch(/Never write "BRAND-ER"/);
    expect(NO_BRANDING_RULES).toMatch(/logo, brand name, wordmark/);
    expect(NO_BRANDING_RULES).toMatch(/watermark/);
    expect(NO_BRANDING_RULES).toMatch(/Never invent a brand name/);
  });

  it("strips platform-branding and logo-insertion instructions from admin system prompts", () => {
    const cleaned = sanitizeBrandingInstructions(
      "Keep it photorealistic. Add the BRAND-ER logo on the chest. Always include a small brand logo on the sleeve.\n가슴에 브랜더 로고를 넣어주세요. 원단 질감을 살려주세요.",
    );
    expect(cleaned).toContain("Keep it photorealistic.");
    expect(cleaned).toContain("원단 질감을 살려주세요.");
    expect(cleaned).not.toMatch(/BRAND-ER|브랜더|brand logo/i);
    // 로고를 "넣지 말라"는 지시는 남는다(삽입 동사 없이 금지만 말하는 문장)
    expect(sanitizeBrandingInstructions("Avoid logos and text overlays.")).toBe("Avoid logos and text overlays.");
  });

  it("creator logo rules point to the creator's own logo, never the platform", () => {
    const rules = creatorLogoRules("NOON STUDIO");
    expect(rules).toContain("NOON STUDIO");
    expect(rules).toContain("NOT the platform logo");
    expect(rules).toMatch(/never use BRAND-ER branding/);
  });

  it("detail-page image prompts always carry the policy; the creator logo only when chosen", () => {
    const base = { product, referenceImages: ["garment design"], imageType: "hero" as const, detailPageStyle: "minimal" as const };
    const plain = buildProductImagePrompt(base);
    expect(plain).toContain(NO_BRANDING_RULES);
    expect(plain).not.toContain("CREATOR BRAND LOGO");
    const withLogo = buildProductImagePrompt({ ...base, creatorLogo: { brandName: "NOON STUDIO" } });
    expect(withLogo).toContain("CREATOR BRAND LOGO");
    expect(withLogo).toContain(NO_BRANDING_RULES);
  });

  it("color variant prompts carry the policy", () => {
    const prompt = buildColorVariantPrompt({ targetColorName: "NAVY", view: "front", referenceLayout: "composite", clothType: "후드티" });
    expect(prompt).toContain(NO_BRANDING_RULES);
  });

  it("edit prompts keep everything except the requested change", () => {
    const removal = buildImageEditPrompt("remove_logo");
    expect(removal).toMatch(/Remove every logo/);
    expect(removal).toMatch(/KEEP EXACTLY THE SAME/);
    expect(buildImageEditPrompt("color", "몸판을 네이비로")).toContain('"몸판을 네이비로"');
    expect(buildImageEditPrompt("custom", "x".repeat(400)).length).toBeLessThan(5000);
  });

  it("maps image size to the nearest supported aspect ratio", () => {
    expect(nearestAspectRatio(1024, 768)).toBe("4:3");
    expect(nearestAspectRatio(800, 1000)).toBe("4:5");
    expect(nearestAspectRatio(0, 0)).toBe("1:1");
  });
});
