import { getAppPath } from "@/utils/appUrl";
import type { CharacterGender, FemaleMannequinSize, MaleMannequinSize, MannequinSize } from "@/types/closet";

export const femaleMannequinSizes: FemaleMannequinSize[] = ["44", "55", "66"];
export const maleMannequinSizes: MaleMannequinSize[] = ["l", "xl", "2xl"];

export const mannequinSizesForGender = (gender: CharacterGender): MannequinSize[] =>
  gender === "female" ? femaleMannequinSizes : maleMannequinSizes;

export const defaultMannequinSize = (gender: CharacterGender): MannequinSize =>
  gender === "female" ? "55" : "l";

export const isMannequinSizeForGender = (gender: CharacterGender, size: string): size is MannequinSize =>
  (mannequinSizesForGender(gender) as string[]).includes(size);

export const mannequinSizeLabel: Record<MannequinSize, string> = {
  "44": "44 · 가장 슬림한 체형",
  "55": "55 · 슬림·표준 체형",
  "66": "66 · 표준·볼륨 체형",
  l: "L · 표준 체형",
  xl: "XL · 볼륨 체형",
  "2xl": "2XL · 전체 볼륨 체형",
};

export const mannequinSizeShortLabel: Record<MannequinSize, string> = {
  "44": "44",
  "55": "55",
  "66": "66",
  l: "L",
  xl: "XL",
  "2xl": "2XL",
};

/**
 * English body-shape description embedded verbatim into every virtual-fitting AI prompt for this
 * gender+size — a reviewed, fixed description (not regenerated per request) so the same preset always
 * reads the same way to the model. Deliberately modest, natural Korean-apparel-size language; never
 * exaggerated or unrealistic.
 */
export const mannequinBodyDescription: Record<MannequinSize, string> = {
  "44": "the slimmest female body preset: narrow shoulders, slim chest/waist/hip, slender arms and legs",
  "55": "a slim-to-standard female body preset: close to the average reference silhouette",
  "66": "a standard-to-fuller female body preset: slightly more volume through chest, waist, hip, arms and legs than the 55 preset",
  l: "a standard male body preset: average shoulder, chest, waist, arm and leg proportions",
  xl: "a slightly fuller male body preset: somewhat broader shoulders, chest, waist, arms and legs than the L preset",
  "2xl": "a fuller male body preset: noticeably broader upper and lower body volume than the XL preset, still a natural, realistic body — never exaggerated or unrealistic",
};

export interface MannequinPreset {
  gender: CharacterGender;
  size: MannequinSize;
  label: string;
  /** Reviewed full-body reference shown in the UI and sent to the AI as the canonical body/scene anchor. */
  previewImage: string;
  bodyDescription: string;
}

const mannequinImagePath: Record<MannequinSize, string> = {
  "44": "/mannequins/female/44.webp",
  "55": "/mannequins/female/55.webp",
  "66": "/mannequins/female/66.webp",
  l: "/mannequins/male/l.webp",
  xl: "/mannequins/male/xl.webp",
  "2xl": "/mannequins/male/2xl.webp",
};

const buildPreset = (gender: CharacterGender, size: MannequinSize): MannequinPreset => ({
  gender,
  size,
  label: mannequinSizeLabel[size],
  previewImage: getAppPath(mannequinImagePath[size]),
  bodyDescription: mannequinBodyDescription[size],
});

/**
 * The reviewed, fixed mannequin preset registry — "검수된 고정 마네킹 기준 이미지" per gender+size.
 * Keyed as `${gender}-${size}` (e.g. "female-66", "male-xl") to match the example paths in the spec.
 * Every preset is a fixed, reviewed photoreal reference. The face, pose, camera, background and light
 * stay consistent inside each gender set while the body proportions change naturally by size.
 */
export const mannequinPresets: Record<string, MannequinPreset> = Object.fromEntries(
  ([...femaleMannequinSizes.map((size) => ["female", size] as const), ...maleMannequinSizes.map((size) => ["male", size] as const)]).map(
    ([gender, size]) => [`${gender}-${size}`, buildPreset(gender, size)],
  ),
);

export const getMannequinPreset = (gender: CharacterGender, size: MannequinSize): MannequinPreset =>
  mannequinPresets[`${gender}-${size}`] ?? buildPreset(gender, defaultMannequinSize(gender));

/**
 * Dedicated close-up Face Identity Reference per gender. This remains separate from the full-body
 * preset so size changes can never substitute a different person.
 */
export const getFaceReferenceImage = (gender: CharacterGender): string =>
  getAppPath(`/mannequins/${gender}/face-reference.jpg`);
