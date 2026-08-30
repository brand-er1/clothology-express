import { genderSkeletonBase, getBodyMorphParams } from "@/lib/body-morph-presets";
import type { CharacterGender, MannequinSize } from "@/types/closet";

/**
 * Concrete geometry dimensions (meters) for the procedural mannequin, derived from the fixed
 * per-gender skeleton (`genderSkeletonBase` — identity, never changes with size) plus the
 * per-size, per-region `BodyMorphParams` multipliers. Every region below is sized independently —
 * this is what "renders" the body-morph structure; nothing here is a single whole-model scale.
 */
export interface BodyMetrics {
  totalHeight: number;
  headRadius: number;
  neckRadius: number;
  neckLength: number;
  shoulderHalfWidth: number;
  chestRadius: number;
  chestLength: number;
  waistRadius: number;
  waistLength: number;
  hipRadius: number;
  hipHalfWidth: number;
  hipLength: number;
  upperArmRadius: number;
  upperArmLength: number;
  forearmRadius: number;
  forearmLength: number;
  handRadius: number;
  thighRadius: number;
  thighLength: number;
  calfRadius: number;
  calfLength: number;
  footLength: number;
  footHeight: number;
  footWidth: number;
  skinTone: string;
  outfitTone: string;
  /** Anchor points (world-space, local to the mannequin group) used to place garment-slot labels. */
  anchors: {
    top: [number, number, number];
    bottom: [number, number, number];
    outer: [number, number, number];
    dress: [number, number, number];
    accessory: [number, number, number];
  };
}

/** Approximate mid-chest world height for a given metrics set — used as the camera/orbit focus point. */
export const getFocusHeight = (metrics: BodyMetrics): number => {
  const legsHeight = metrics.footHeight + metrics.calfLength + metrics.thighLength;
  return legsHeight + metrics.hipLength + metrics.waistLength + metrics.chestLength * 0.5;
};

export const computeBodyMetrics = (gender: CharacterGender, size: MannequinSize): BodyMetrics => {
  const base = genderSkeletonBase[gender];
  const morph = getBodyMorphParams(size);

  const legLength = base.legLengthBase * morph.legLengthRatio;
  const torsoLength = base.torsoLengthBase * morph.torsoLengthRatio;

  const thighLength = legLength * 0.5;
  const calfLength = legLength * 0.42;
  const footHeight = 0.06;
  const footLength = 0.22;
  const footWidth = 0.09;

  const hipLength = torsoLength * 0.28;
  const waistLength = torsoLength * 0.26;
  const chestLength = torsoLength * 0.46;

  const upperArmLength = base.armLengthBase * 0.47;
  const forearmLength = base.armLengthBase * 0.4;

  const hipHalfWidth = (base.hipWidthBase / 2) * Math.sqrt(morph.hip);

  const legsHeight = footHeight + calfLength + thighLength;

  return {
    totalHeight: base.totalHeight,
    headRadius: base.headRadius,
    neckRadius: 0.045,
    neckLength: base.neckLength,
    shoulderHalfWidth: (base.shoulderWidthBase / 2) * morph.shoulderWidth,
    chestRadius: 0.15 * morph.chest,
    chestLength,
    waistRadius: 0.115 * morph.waist,
    waistLength,
    hipRadius: 0.135 * morph.hip,
    hipHalfWidth,
    hipLength,
    upperArmRadius: 0.05 * morph.armWidth,
    upperArmLength,
    forearmRadius: 0.042 * morph.armWidth,
    forearmLength,
    handRadius: 0.035,
    thighRadius: 0.09 * morph.thighWidth,
    thighLength,
    calfRadius: 0.065 * morph.calfWidth,
    calfLength,
    footLength,
    footHeight,
    footWidth,
    skinTone: base.skinTone,
    outfitTone: base.outfitTone,
    anchors: {
      top: [0, legsHeight + hipLength + waistLength + chestLength * 0.55, 0.2],
      bottom: [0, legsHeight * 0.5, 0.22],
      outer: [0, legsHeight + hipLength + waistLength + chestLength * 0.8, 0.24],
      dress: [0, legsHeight + hipLength * 0.6, 0.22],
      accessory: [0, legsHeight + hipLength + waistLength + chestLength + base.neckLength, 0.18],
    },
  };
};
