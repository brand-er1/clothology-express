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

import { PEOPLE_MODE, isBottomsGarment } from "../../supabase/functions/_shared/detailImagePrompt";
import { designRetryNote, reframeBelowHead, textPolicyIssue, violatesPeoplePolicy } from "../../supabase/functions/_shared/imageQa";
import { SCENE_TEXT_RULE } from "../../supabase/functions/_shared/detailImagePrompt";

describe("detail-page people / face policy", () => {
  const types = ["hero", "product_front", "product_back", "detail", "editorial", "lifestyle", "fabric", "mood", "flat_lay"] as const;
  const build = (imageType: (typeof types)[number], clothType = "후드티", userInstruction?: string) =>
    buildProductImagePrompt({ product: { ...product, clothType }, referenceImages: ["garment design"], imageType, detailPageStyle: "lookbook", userInstruction });

  it("only fit/lookbook shots may show a wearer; everything else is product-only", () => {
    expect(types.filter((type) => PEOPLE_MODE[type] === "faceless_worn")).toEqual(["editorial", "lifestyle"]);
    for (const type of types.filter((entry) => PEOPLE_MODE[entry] === "none")) {
      const prompt = build(type);
      expect(prompt).toMatch(/contains NO person/);
      expect(prompt).not.toMatch(/person naturally wearing|model shot/i);
    }
  });

  it("worn shots fix the camera framing so the head is outside the frame (not blurred)", () => {
    const top = build("lifestyle");
    expect(top).toMatch(/CAMERA FRAMING \(mandatory, decide it before anything else\): TORSO CROP/);
    expect(top.startsWith("CAMERA FRAMING")).toBe(true);
    expect(build("hero").startsWith("CAMERA FRAMING")).toBe(false);
    expect(top).toMatch(/head is completely outside the frame/);
    expect(top).toMatch(/Do not render a face and then blur, crop, cover or hide it/);
    const pants = build("lifestyle", "와이드 팬츠");
    expect(pants).toMatch(/waist-down shot/);
    expect(build("editorial")).toMatch(/back view/);
    expect(isBottomsGarment("데님 스커트")).toBe(true);
    expect(isBottomsGarment("후드티")).toBe(false);
  });

  it("people and branding rules apply together and creator instructions cannot bring faces in", () => {
    const prompt = build("lifestyle", "후드티", "모델 얼굴이 정면으로 보이게");
    expect(prompt).toContain(NO_BRANDING_RULES);
    expect(prompt).toMatch(/never in a way that brings a face or extra people into the frame/);
    expect(prompt.indexOf("PEOPLE POLICY")).toBeGreaterThan(prompt.indexOf("Creator's change request"));
  });

  it("QA decides when to reframe and regenerate", () => {
    const qa = { faceVisible: false, headVisible: false, personCount: 0, bodyPartsVisible: false, garmentIsMainSubject: true, visibleText: [], extraText: [], logoOrBrandMark: false, brandErVisible: false, matchesReference: true, designDifferences: [], headBox: null, model: "m" };
    expect(violatesPeoplePolicy(qa, "none")).toBe(false);
    expect(violatesPeoplePolicy({ ...qa, faceVisible: true }, "faceless_worn")).toBe(true);
    expect(violatesPeoplePolicy({ ...qa, headVisible: true }, "faceless_worn")).toBe(true);
    expect(violatesPeoplePolicy({ ...qa, personCount: 1, bodyPartsVisible: true }, "faceless_worn")).toBe(false);
    expect(violatesPeoplePolicy({ ...qa, personCount: 1 }, "none")).toBe(true);
    expect(violatesPeoplePolicy(null, "none")).toBe(false);
  });

  it("reframes a worn shot below the head keeping the aspect ratio, or refuses", () => {
    const box = reframeBelowHead(900, 1200, [0, 400, 200, 600])!;
    expect(box.y).toBeGreaterThanOrEqual(240);
    expect(box.y + box.height).toBe(1200);
    expect(box.width / box.height).toBeCloseTo(900 / 1200, 2);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(900);
    expect(reframeBelowHead(900, 1200, [0, 400, 500, 600])).toBeNull(); // too little garment left
    expect(reframeBelowHead(900, 1200, [600, 400, 700, 600])).toBeNull(); // head not at the top
    expect(reframeBelowHead(900, 1200, null)).toBeNull();
  });

  // 운영 E2E(2026-10-02): 룩북 컷에 잡지 글자("Art Home"), 플랫레이 컷에 자 눈금(1~16)이 생성됐다.
  it("keeps readable text out of the set: no magazine page layout, no printed props", () => {
    for (const type of types) expect(build(type)).toContain(SCENE_TEXT_RULE);
    expect(build("editorial")).not.toMatch(/magazine editorial page/);
    expect(build("editorial")).toMatch(/a photograph only — no page layout, titles, captions or magazine text/);
    expect(build("flat_lay")).toMatch(/no rulers, measuring tapes, tags, cards, books, packaging or anything printed/);
    expect(build("flat_lay")).not.toMatch(/Minimal styling props are allowed/);
  });

  it("text policy: BRAND-ER never saved, extra (non-design) text triggers a retry, creator brand allowed", () => {
    const qa = { faceVisible: false, headVisible: false, personCount: 0, bodyPartsVisible: false, garmentIsMainSubject: true, visibleText: [], extraText: [] as string[], logoOrBrandMark: false, brandErVisible: false, matchesReference: true, designDifferences: [], headBox: null, model: "m" };
    expect(textPolicyIssue(qa)).toBeNull();
    expect(textPolicyIssue({ ...qa, visibleText: ["NYC 1994"] })).toBeNull(); // 디자인 자체의 레터링
    expect(textPolicyIssue({ ...qa, extraText: ["Art Home", "Hideo Matsushita"] })).toBe("extra_text");
    expect(textPolicyIssue({ ...qa, extraText: ["1", "2", "3"] })).toBe("extra_text");
    expect(textPolicyIssue({ ...qa, brandErVisible: true })).toBe("brand_er");
    expect(textPolicyIssue({ ...qa, extraText: ["MOONLIGHT"] }, "Moonlight")).toBeNull();
    expect(textPolicyIssue(null)).toBeNull();
  });

  // 운영 E2E(2026-10-02 2차): 룩북 컷에 원본에 없는 스트링이 추가됐다 → 차이를 되돌리는 재생성 지시.
  it("design retry names the differences to undo", () => {
    const note = designRetryNote(["Added drawstrings not present in original design"]);
    expect(note).toMatch(/Differences to undo: Added drawstrings not present in original design/);
    expect(note).toMatch(/do not add drawstrings/);
    expect(designRetryNote([])).not.toMatch(/Differences to undo/);
  });
});
