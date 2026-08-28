import type { CharacterGender, MannequinSize } from "@/types/closet";

/**
 * Parametric BRAND-ER virtual mannequin — a vector "fashion croquis" figure used as both (1) the
 * on-screen base mannequin shown before any AI fitting exists, and (2) the Face Identity Reference /
 * Mannequin Reference image sent to the virtual-fitting AI pipeline. Generating it from fixed
 * geometry (rather than a photo) guarantees the one property the whole feature depends on: the exact
 * same face, hairstyle, skin tone, expression, pose, hands/feet, camera framing, background and
 * lighting for every gender+size combination — only the body-proportion widths below the neck change.
 *
 * This is a v1 placeholder croquis, not a photoreal render. Swap `buildMannequinSvg` for a lookup
 * against real reviewed reference photos/renders (see mannequin-presets.ts) once BRAND-ER supplies
 * them — nothing else in the pipeline needs to change, since every caller only ever asks for "the
 * gender+size reference image" through `getMannequinReferenceDataUrl`.
 */

const CANVAS_W = 600;
const CANVAS_H = 800;
const CENTER_X = CANVAS_W / 2;

// Constant vertical landmarks — identical for every size so height/head size never visibly change.
const Y = {
  headTop: 78,
  headCenter: 140,
  headR: 54,
  neck: 196,
  shoulder: 214,
  chest: 292,
  waist: 378,
  hip: 438,
  crotch: 468,
  knee: 592,
  ankle: 742,
  floor: 758,
};

interface BodyWidths {
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  upperArm: number;
  forearm: number;
  thigh: number;
  calf: number;
}

const FEMALE_BASE: BodyWidths = {
  shoulder: 92,
  chest: 78,
  waist: 60,
  hip: 86,
  upperArm: 21,
  forearm: 16,
  thigh: 40,
  calf: 25,
};

const MALE_BASE: BodyWidths = {
  shoulder: 116,
  chest: 96,
  waist: 80,
  hip: 92,
  upperArm: 28,
  forearm: 20,
  thigh: 46,
  calf: 30,
};

/** Size scale factors — uniform natural growth in line with Korean apparel sizing, never exaggerated. */
const FEMALE_SCALE: Record<string, number> = { "44": 0.90, "55": 1.0, "66": 1.08, "77": 1.18 };
const MALE_SCALE: Record<string, number> = { l: 1.0, xl: 1.10, "2xl": 1.20 };

export const scaleForSize = (gender: CharacterGender, size: MannequinSize): number =>
  gender === "female" ? FEMALE_SCALE[size] ?? 1 : MALE_SCALE[size] ?? 1;

const widthsForSize = (gender: CharacterGender, size: MannequinSize): BodyWidths => {
  const base = gender === "female" ? FEMALE_BASE : MALE_BASE;
  const s = scaleForSize(gender, size);
  return {
    shoulder: base.shoulder * s,
    chest: base.chest * s,
    waist: base.waist * s,
    hip: base.hip * s,
    upperArm: base.upperArm * s,
    forearm: base.forearm * s,
    thigh: base.thigh * s,
    calf: base.calf * s,
  };
};

const SKIN = "#e8b98d";
const SKIN_SHADOW = "#d9a878";
const BG_TOP = "#f4efe6";
const BG_BOTTOM = "#e6ddcf";
const OUTLINE = "#8a6d54";

const torsoPath = (w: BodyWidths) => {
  const cx = CENTER_X;
  const sh = Y.shoulder;
  const ch = Y.chest;
  const wa = Y.waist;
  const hp = Y.hip;
  const cr = Y.crotch;
  return `
    M ${cx - w.shoulder} ${sh}
    C ${cx - w.chest - 6} ${sh + 30}, ${cx - w.chest} ${ch - 20}, ${cx - w.chest} ${ch}
    C ${cx - w.chest} ${ch + 40}, ${cx - w.waist - 4} ${wa - 20}, ${cx - w.waist} ${wa}
    C ${cx - w.waist - 6} ${wa + 24}, ${cx - w.hip} ${hp - 24}, ${cx - w.hip} ${hp}
    C ${cx - w.hip} ${hp + 20}, ${cx - w.hip + 8} ${cr - 6}, ${cx - w.hip * 0.35} ${cr}
    L ${cx + w.hip * 0.35} ${cr}
    C ${cx + w.hip - 8} ${cr - 6}, ${cx + w.hip} ${hp + 20}, ${cx + w.hip} ${hp}
    C ${cx + w.hip} ${hp - 24}, ${cx + w.waist + 6} ${wa + 24}, ${cx + w.waist} ${wa}
    C ${cx + w.waist + 4} ${wa - 20}, ${cx + w.chest} ${ch + 40}, ${cx + w.chest} ${ch}
    C ${cx + w.chest} ${ch - 20}, ${cx + w.chest + 6} ${sh + 30}, ${cx + w.shoulder} ${sh}
    C ${cx + w.shoulder - 10} ${sh - 14}, ${cx + 30} ${Y.neck - 6}, ${cx} ${Y.neck}
    C ${cx - 30} ${Y.neck - 6}, ${cx - w.shoulder + 10} ${sh - 14}, ${cx - w.shoulder} ${sh}
    Z
  `;
};

const armPath = (side: "left" | "right", w: BodyWidths) => {
  const sign = side === "left" ? -1 : 1;
  const shoulderX = CENTER_X + sign * (w.shoulder - w.upperArm * 0.6);
  const elbowX = CENTER_X + sign * (w.shoulder + w.upperArm * 0.5);
  const wristX = CENTER_X + sign * (w.shoulder + w.upperArm * 0.35);
  const elbowY = Y.waist - 10;
  const wristY = Y.hip + 70;
  return `
    M ${shoulderX - sign * w.upperArm} ${Y.shoulder + 6}
    C ${shoulderX - sign * w.upperArm * 1.2} ${Y.chest - 10}, ${elbowX - sign * w.upperArm} ${elbowY - 30}, ${elbowX - sign * w.forearm} ${elbowY}
    C ${elbowX - sign * w.forearm * 1.1} ${elbowY + 45}, ${wristX - sign * w.forearm * 0.8} ${wristY - 30}, ${wristX - sign * w.forearm * 0.7} ${wristY}
    C ${wristX - sign * w.forearm} ${wristY + 14}, ${wristX + sign * w.forearm} ${wristY + 14}, ${wristX + sign * w.forearm * 0.7} ${wristY}
    C ${wristX + sign * w.forearm} ${wristY - 30}, ${elbowX + sign * w.forearm} ${elbowY + 45}, ${elbowX + sign * w.forearm} ${elbowY}
    C ${elbowX + sign * w.upperArm} ${elbowY - 30}, ${shoulderX + sign * w.upperArm * 0.8} ${Y.chest - 10}, ${shoulderX + sign * w.upperArm * 0.6} ${Y.shoulder + 6}
    Z
  `;
};

const legPath = (side: "left" | "right", w: BodyWidths) => {
  const sign = side === "left" ? -1 : 1;
  const hipX = CENTER_X + sign * w.hip * 0.42;
  const kneeX = CENTER_X + sign * w.hip * 0.32;
  const ankleX = CENTER_X + sign * w.hip * 0.3;
  return `
    M ${hipX - sign * w.thigh} ${Y.crotch}
    C ${hipX - sign * w.thigh * 1.1} ${Y.crotch + 60}, ${kneeX - sign * w.thigh} ${Y.knee - 30}, ${kneeX - sign * w.calf} ${Y.knee}
    C ${kneeX - sign * w.calf * 1.1} ${Y.knee + 60}, ${ankleX - sign * w.calf * 0.8} ${Y.ankle - 30}, ${ankleX - sign * w.calf * 0.7} ${Y.ankle}
    L ${ankleX + sign * w.calf * 0.7} ${Y.ankle}
    C ${ankleX + sign * w.calf * 0.8} ${Y.ankle - 30}, ${kneeX + sign * w.calf} ${Y.knee + 60}, ${kneeX + sign * w.calf} ${Y.knee}
    C ${kneeX + sign * w.thigh} ${Y.knee - 30}, ${hipX + sign * w.thigh * 1.1} ${Y.crotch + 60}, ${hipX + sign * w.thigh} ${Y.crotch}
    Z
  `;
};

const hairMarkup = (gender: CharacterGender) => {
  const cx = CENTER_X;
  if (gender === "female") {
    return `
      <path d="M ${cx - 68} ${Y.headCenter - 10} C ${cx - 78} ${Y.headTop + 120}, ${cx - 66} ${Y.neck + 130}, ${cx - 40} ${Y.neck + 150}
               L ${cx - 30} ${Y.neck + 60} C ${cx - 55} ${Y.headCenter + 40}, ${cx - 60} ${Y.headTop + 10}, ${cx} ${Y.headTop - 14}
               C ${cx + 60} ${Y.headTop + 10}, ${cx + 55} ${Y.headCenter + 40}, ${cx + 30} ${Y.neck + 60}
               L ${cx + 40} ${Y.neck + 150} C ${cx + 66} ${Y.neck + 130}, ${cx + 78} ${Y.headTop + 120}, ${cx + 68} ${Y.headCenter - 10}
               C ${cx + 60} ${Y.headTop - 30}, ${cx - 60} ${Y.headTop - 30}, ${cx - 68} ${Y.headCenter - 10} Z"
            fill="#3a2a20" />
    `;
  }
  return `
    <path d="M ${cx - 58} ${Y.headCenter - 20} C ${cx - 60} ${Y.headTop - 6}, ${cx} ${Y.headTop - 26}, ${cx + 60} ${Y.headTop - 6}
             C ${cx + 60} ${Y.headTop - 6}, ${cx + 62} ${Y.headCenter - 20}, ${cx + 58} ${Y.headCenter - 34}
             C ${cx + 30} ${Y.headTop - 22}, ${cx - 30} ${Y.headTop - 22}, ${cx - 58} ${Y.headCenter - 34} Z"
          fill="#241b14" />
  `;
};

const faceMarkup = (gender: CharacterGender) => {
  const cx = CENTER_X;
  const cy = Y.headCenter;
  const eyelash = gender === "female" ? `
    <path d="M ${cx - 33} ${cy - 3} l -6 -5" stroke="#3a2a20" stroke-width="2.4" stroke-linecap="round" />
    <path d="M ${cx + 33} ${cy - 3} l 6 -5" stroke="#3a2a20" stroke-width="2.4" stroke-linecap="round" />
  ` : "";
  return `
    <circle cx="${cx}" cy="${cy}" r="${Y.headR}" fill="${SKIN}" stroke="${OUTLINE}" stroke-width="2" />
    <ellipse cx="${cx - 20}" cy="${cy - 2}" rx="5.5" ry="7" fill="#3a2a20" />
    <ellipse cx="${cx + 20}" cy="${cy - 2}" rx="5.5" ry="7" fill="#3a2a20" />
    ${eyelash}
    <path d="M ${cx - 10} ${cy + 22} q 10 8 20 0" stroke="#8a5a42" stroke-width="2.6" fill="none" stroke-linecap="round" />
    <path d="M ${cx} ${cy + 4} q -3 6 -1 10" stroke="${OUTLINE}" stroke-width="1.6" fill="none" stroke-linecap="round" />
  `;
};

/** Builds the full SVG markup for one gender+size mannequin preset. Pure function of (gender, size). */
export const buildMannequinSvg = (gender: CharacterGender, size: MannequinSize): string => {
  const w = widthsForSize(gender, size);
  const skinParts = `
    <path d="${armPath("left", w)}" fill="${SKIN}" stroke="${OUTLINE}" stroke-width="1.5" />
    <path d="${armPath("right", w)}" fill="${SKIN}" stroke="${OUTLINE}" stroke-width="1.5" />
    <path d="${legPath("left", w)}" fill="${SKIN_SHADOW}" stroke="${OUTLINE}" stroke-width="1.5" />
    <path d="${legPath("right", w)}" fill="${SKIN_SHADOW}" stroke="${OUTLINE}" stroke-width="1.5" />
    <path d="${torsoPath(w)}" fill="${SKIN}" stroke="${OUTLINE}" stroke-width="1.8" />
  `;
  return `
<svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_TOP}" />
      <stop offset="100%" stop-color="${BG_BOTTOM}" />
    </linearGradient>
  </defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="url(#bg)" />
  <ellipse cx="${CENTER_X}" cy="${Y.floor}" rx="150" ry="14" fill="#00000014" />
  ${skinParts}
  <ellipse cx="${CENTER_X - w.hip * 0.3}" cy="${Y.ankle + 10}" rx="30" ry="10" fill="#2b2b2b" />
  <ellipse cx="${CENTER_X + w.hip * 0.3}" cy="${Y.ankle + 10}" rx="30" ry="10" fill="#2b2b2b" />
  ${hairMarkup(gender)}
  ${faceMarkup(gender)}
</svg>`.trim();
};

const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The inline-displayable SVG data URL for a gender+size preset — used directly as an <img src>. */
export const getMannequinSvgDataUrl = (gender: CharacterGender, size: MannequinSize): string =>
  svgToDataUrl(buildMannequinSvg(gender, size));

/**
 * Rasterizes the preset to a PNG data URL at a fixed pixel size — required because the virtual-fitting
 * AI pipeline needs a raster reference image, not vector markup. Browser-only (uses HTMLCanvasElement).
 */
export const rasterizeMannequinToPngDataUrl = (
  gender: CharacterGender,
  size: MannequinSize,
  targetWidth = 768,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const svgUrl = getMannequinSvgDataUrl(gender, size);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = Math.round((targetWidth * CANVAS_H) / CANVAS_W);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("캔버스를 사용할 수 없습니다."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("마네킹 기준 이미지를 생성하지 못했습니다."));
    image.src = svgUrl;
  });
