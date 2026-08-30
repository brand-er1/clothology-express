import type { CharacterGender, MannequinSize } from "@/types/closet";

/**
 * Non-uniform body-region morph targets for the procedural 3D mannequin, keyed by gender+size.
 * Every field scales a *different* body region independently (never a single whole-body factor) —
 * this is the "Body Morph 또는 이에 준하는 구조" the 3D mannequin spec requires instead of resizing
 * the whole model. `1` is that gender's baseline preset (female "55", male "l"); every other size is
 * expressed as a delta from that baseline, mirroring the natural-language deltas already reviewed
 * and shipped in `mannequin-presets.ts` (`mannequinBodyDescription`) for the AI photoreal pipeline —
 * so the 3D silhouette and the AI-generated photo agree on which preset is "slimmer"/"fuller".
 */
export interface BodyMorphParams {
  /** Shoulder joint-to-joint width. */
  shoulderWidth: number;
  /** Chest/bust circumference (front-back + side-side). */
  chest: number;
  /** Waist circumference. */
  waist: number;
  /** Hip/pelvis circumference. */
  hip: number;
  /** Upper arm + forearm radius. */
  armWidth: number;
  /** Thigh radius. */
  thighWidth: number;
  /** Calf/lower-leg radius (leg silhouette). */
  calfWidth: number;
  /** Torso (shoulder-to-hip) length share of total height — upper/lower body ratio. */
  torsoLengthRatio: number;
  /** Leg length share of total height — the complement of torsoLengthRatio's effect. */
  legLengthRatio: number;
}

const baseline = (): BodyMorphParams => ({
  shoulderWidth: 1,
  chest: 1,
  waist: 1,
  hip: 1,
  armWidth: 1,
  thighWidth: 1,
  calfWidth: 1,
  torsoLengthRatio: 1,
  legLengthRatio: 1,
});

export const bodyMorphPresets: Record<MannequinSize, BodyMorphParams> = {
  // Female — baseline is "55".
  "44": {
    shoulderWidth: 0.93,
    chest: 0.9,
    waist: 0.87,
    hip: 0.9,
    armWidth: 0.9,
    thighWidth: 0.9,
    calfWidth: 0.93,
    torsoLengthRatio: 0.99,
    legLengthRatio: 1.01,
  },
  "55": baseline(),
  "66": {
    shoulderWidth: 1.06,
    chest: 1.1,
    waist: 1.13,
    hip: 1.12,
    armWidth: 1.09,
    thighWidth: 1.1,
    calfWidth: 1.07,
    torsoLengthRatio: 1.01,
    legLengthRatio: 0.99,
  },
  // Male — baseline is "l".
  l: baseline(),
  xl: {
    shoulderWidth: 1.08,
    chest: 1.12,
    waist: 1.14,
    hip: 1.07,
    armWidth: 1.11,
    thighWidth: 1.09,
    calfWidth: 1.07,
    torsoLengthRatio: 1.01,
    legLengthRatio: 0.99,
  },
  "2xl": {
    shoulderWidth: 1.15,
    chest: 1.24,
    waist: 1.28,
    hip: 1.14,
    armWidth: 1.22,
    thighWidth: 1.17,
    calfWidth: 1.12,
    torsoLengthRatio: 1.02,
    legLengthRatio: 0.98,
  },
};

export const getBodyMorphParams = (size: MannequinSize): BodyMorphParams => bodyMorphPresets[size] ?? baseline();

/** Base skeleton proportions that make the two genders read as different (but internally fixed) identities. */
export interface BodySkeletonProportions {
  totalHeight: number;
  headRadius: number;
  neckLength: number;
  shoulderWidthBase: number;
  hipWidthBase: number;
  torsoLengthBase: number;
  legLengthBase: number;
  armLengthBase: number;
  skinTone: string;
  outfitTone: string;
}

/**
 * Fixed per-gender base identity — never varies with size, only with `bodyMorphPresets` scale
 * factors above. Keeps "the same mannequin" feeling across every size/garment change (spec §3).
 */
export const genderSkeletonBase: Record<CharacterGender, BodySkeletonProportions> = {
  female: {
    totalHeight: 1.62,
    headRadius: 0.1,
    neckLength: 0.06,
    shoulderWidthBase: 0.34,
    hipWidthBase: 0.32,
    torsoLengthBase: 0.52,
    legLengthBase: 0.86,
    armLengthBase: 0.62,
    skinTone: "#e7c9ab",
    outfitTone: "#efe6d8",
  },
  male: {
    totalHeight: 1.75,
    headRadius: 0.11,
    neckLength: 0.07,
    shoulderWidthBase: 0.42,
    hipWidthBase: 0.34,
    torsoLengthBase: 0.56,
    legLengthBase: 0.92,
    armLengthBase: 0.68,
    skinTone: "#dcb392",
    outfitTone: "#e4ddd0",
  },
};
