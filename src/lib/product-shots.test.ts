import { describe, expect, it } from "vitest";
import {
  ANGLE_SHOTS,
  BASIC_SHOT_SET,
  DETAIL_SHOTS,
  buildProductShotPrompt,
  cropRectForBox,
  focusBoxForShot,
  getShotSpec,
  isInferredShot,
  isProductShotType,
  isShotAvailable,
  normalizeRegion,
  parseDesignAnalysis,
  planBasicShotSet,
  regionToBox,
  type DesignAnalysis,
} from "../../supabase/functions/_shared/productShotPrompt";

const hoodieAnalysis = (overrides: Record<string, unknown> = {}): DesignAnalysis =>
  parseDesignAnalysis({
    garmentType: "hoodie",
    layout: "front_back",
    frontBox: [80, 20, 920, 480],
    backBox: [80, 520, 920, 980],
    backVisible: true,
    elements: {
      neckline: { present: true, box: [80, 180, 200, 320], description: "hood with drawcords" },
      sleeve: { present: true, box: [700, 20, 860, 120], description: "rib cuffs" },
      hem: { present: true, box: [850, 60, 920, 440], description: "rib hem band" },
      print: { present: false, box: null, description: "" },
      embroidery: { present: true, box: [300, 300, 380, 400], description: "small chest logo embroidery" },
      closure: { present: false, box: null, description: "" },
      pocket: { present: true, box: [560, 150, 720, 350], description: "kangaroo pocket" },
      logo: { present: true, box: [300, 300, 380, 400], description: "embroidered chest logo" },
    },
    mainDesignDetail: { present: true, kind: "embroidery", box: [300, 300, 380, 400], description: "chest logo" },
    colors: ["burgundy"],
    fabric: "heavy brushed cotton fleece",
    summary: "Burgundy pullover hoodie with a small embroidered chest logo on the left chest and a kangaroo pocket.",
    ...overrides,
  });

describe("product shot catalog", () => {
  it("offers the 7 angle shots and 9 detail shots from the spec", () => {
    expect(ANGLE_SHOTS.map((spec) => spec.label)).toEqual(["정면 컷", "후면 컷", "측면 컷", "45도 컷", "플랫레이 컷", "행거 컷", "마네킹 컷"]);
    expect(DETAIL_SHOTS.map((spec) => spec.label)).toEqual([
      "원단 확대 컷", "봉제 디테일", "넥라인", "소매", "밑단", "프린팅", "자수", "지퍼·단추", "포켓",
    ]);
    expect(isProductShotType("custom_region")).toBe(true);
    expect(isProductShotType("logo_redesign")).toBe(false);
  });

  it("basic set is front, back, side, fabric and a logo/design detail (5 shots)", () => {
    expect(BASIC_SHOT_SET).toEqual(["front", "back", "side", "fabric", "design_detail"]);
  });
});

describe("design element gating (never invent hardware/details)", () => {
  it("disables detail shots whose element is not visible in the original", () => {
    const analysis = hoodieAnalysis();
    expect(isShotAvailable("closure", analysis)).toBe(false);
    expect(isShotAvailable("print", analysis)).toBe(false);
    expect(isShotAvailable("embroidery", analysis)).toBe(true);
    expect(isShotAvailable("pocket", analysis)).toBe(true);
    // 원단 · 봉제 · 각도 컷은 항상 가능
    expect(isShotAvailable("fabric", analysis)).toBe(true);
    expect(isShotAvailable("side", analysis)).toBe(true);
    // 분석이 없으면 서버 단계로 판단을 미룬다
    expect(isShotAvailable("closure", null)).toBe(true);
  });

  it("asks for confirmation when the basic set has no logo/print/embroidery to show", () => {
    expect(planBasicShotSet(hoodieAnalysis())).toEqual({ shots: BASIC_SHOT_SET, missing: [], needsConfirmation: false });
    const plain = hoodieAnalysis({ mainDesignDetail: { present: false, kind: "none", box: null } });
    const plan = planBasicShotSet(plain);
    expect(plan.needsConfirmation).toBe(true);
    expect(plan.missing).toEqual(["design_detail"]);
    expect(plan.shots).toEqual(["front", "back", "side", "fabric"]);
  });

  it("uses the analysed box as the close-up area", () => {
    const analysis = hoodieAnalysis();
    expect(focusBoxForShot("embroidery", analysis)).toEqual([300, 300, 380, 400]);
    expect(focusBoxForShot("design_detail", analysis)).toEqual([300, 300, 380, 400]);
    expect(focusBoxForShot("front", analysis)).toBeNull();
  });
});

describe("parseDesignAnalysis", () => {
  it("accepts fenced JSON text and drops boxes of absent elements", () => {
    const parsed = parseDesignAnalysis('```json\n{"layout":"front_back","backBox":[0,500,1000,1000],"backVisible":true,"elements":{"closure":{"present":false,"box":[1,2,3,4]}},"mainDesignDetail":{"present":true,"kind":"weird"}}\n```');
    expect(parsed.layout).toBe("front_back");
    expect(parsed.backVisible).toBe(true);
    expect(parsed.elements.closure).toEqual({ present: false, box: null, description: "" });
    expect(parsed.elements.pocket.present).toBe(false);
    // 알 수 없는 kind 는 none 으로 → 주요 디테일 없음
    expect(parsed.mainDesignDetail.present).toBe(false);
  });

  it("treats a single-view image as back not visible", () => {
    const parsed = parseDesignAnalysis({ layout: "front_back", backVisible: true, backBox: null });
    expect(parsed.layout).toBe("single");
    expect(parsed.backVisible).toBe(false);
  });
});

describe("reference-image marking", () => {
  it("marks side/45° always, and back only when the original has no back view", () => {
    expect(isInferredShot("side", hoodieAnalysis())).toBe(true);
    expect(isInferredShot("three_quarter", hoodieAnalysis())).toBe(true);
    expect(isInferredShot("back", hoodieAnalysis())).toBe(false);
    expect(isInferredShot("back", hoodieAnalysis({ layout: "single", backBox: null, backVisible: false }))).toBe(true);
    expect(isInferredShot("front", hoodieAnalysis())).toBe(false);
    expect(isInferredShot("embroidery", hoodieAnalysis())).toBe(false);
  });
});

describe("regions", () => {
  it("normalises and clamps user selections, rejecting tiny ones", () => {
    expect(normalizeRegion({ x: 0.9, y: 0.5, width: 0.5, height: 0.2 })).toEqual({ x: 0.9, y: 0.5, width: 0.09999999999999998, height: 0.2 });
    expect(normalizeRegion({ x: 0.1, y: 0.1, width: 0.001, height: 0.3 })).toBeNull();
    expect(normalizeRegion({ x: "a" })).toBeNull();
    expect(regionToBox({ x: 0.25, y: 0.1, width: 0.5, height: 0.2 })).toEqual([100, 250, 300, 750]);
  });

  it("pads the crop and keeps it inside the image", () => {
    const rect = cropRectForBox(1000, 800, [0, 0, 100, 100]);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBeGreaterThanOrEqual(100);
    expect(rect.height).toBeGreaterThanOrEqual(96);
    const edge = cropRectForBox(1000, 800, [900, 900, 1000, 1000]);
    expect(edge.x + edge.width).toBeLessThanOrEqual(1000);
    expect(edge.y + edge.height).toBeLessThanOrEqual(800);
  });
});

describe("buildProductShotPrompt", () => {
  const base = {
    referenceLabels: ["the ORIGINAL garment design", "FRONT VIEW crop"],
    product: { clothType: "후드티", material: "기모 면", color: "버건디", fit: "오버핏" },
  };

  it("locks the original design and forbids invented elements", () => {
    const prompt = buildProductShotPrompt({ ...base, type: "front", analysis: hoodieAnalysis() });
    expect(prompt).toContain("This is NOT a new design");
    expect(prompt).toContain("DESIGN LOCK");
    expect(prompt).toContain("logo position, size and shape");
    expect(prompt).toContain("Never invent hardware, pockets, graphics or text");
    expect(prompt).toContain("NOT present on this garment (must not appear): print, closure.");
    expect(prompt).toContain("REFERENCE IMAGE 2: FRONT VIEW crop");
    expect(prompt).toContain("Burgundy pullover hoodie");
    expect(prompt).toContain("Never write \"BRAND-ER\"");
    expect(prompt).toContain("No people");
  });

  it("keeps an unseen back plain instead of inventing graphics", () => {
    const prompt = buildProductShotPrompt({ ...base, type: "back", analysis: hoodieAnalysis({ layout: "single", backBox: null, backVisible: false }) });
    expect(prompt).toContain("The back is NOT shown in the reference");
    expect(prompt).toContain("Do NOT put any graphic");
    const visible = buildProductShotPrompt({ ...base, type: "back", analysis: hoodieAnalysis() });
    expect(visible).not.toContain("The back is NOT shown");
  });

  it("describes the selected area for custom close-ups and includes the creator note", () => {
    const prompt = buildProductShotPrompt({ ...base, type: "custom_region", analysis: null, region: [100, 250, 300, 750], note: "가슴 로고 자수" });
    expect(prompt).toContain("SELECTED AREA: the user selected the box [ymin 100, xmin 250, ymax 300, xmax 750]");
    expect(prompt).toContain("add nothing that is not there");
    expect(prompt).toContain("가슴 로고 자수");
  });

  it("has a distinct instruction and aspect ratio for every shot", () => {
    for (const spec of [...ANGLE_SHOTS, ...DETAIL_SHOTS]) {
      const prompt = buildProductShotPrompt({ ...base, type: spec.type, analysis: hoodieAnalysis() });
      expect(prompt).toMatch(/SHOT: /);
      expect(getShotSpec(spec.type)?.aspectRatio).toMatch(/^(1:1|4:5)$/);
    }
  });
});
