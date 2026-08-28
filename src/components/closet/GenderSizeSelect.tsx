import { mannequinSizeShortLabel, mannequinSizesForGender } from "@/lib/mannequin-presets";
import type { CharacterGender, MannequinSize } from "@/types/closet";

interface GenderSizeSelectProps {
  gender: CharacterGender;
  size: MannequinSize;
  onGender: (gender: CharacterGender) => void;
  onSize: (size: MannequinSize) => void;
  /** "full" = onboarding step (bigger touch targets); "compact" = sticky in-flow bar. */
  variant?: "full" | "compact";
}

/** 성별 → 체형 사이즈 선택. 선택 즉시 해당 체형의 마네킹이 표시되도록 부모가 gender/size 변경에 반응한다. */
export const GenderSizeSelect = ({ gender, size, onGender, onSize, variant = "full" }: GenderSizeSelectProps) => {
  const sizes = mannequinSizesForGender(gender);
  const compact = variant === "compact";

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-3"}>
      <div className={`inline-flex rounded-full border border-stone-200 bg-white p-1 ${compact ? "" : "shadow-sm"}`}>
        {(["female", "male"] as CharacterGender[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGender(g)}
            aria-pressed={gender === g}
            className={`rounded-full font-bold transition ${compact ? "px-3.5 py-2 text-xs" : "px-5 py-2.5 text-sm"} ${
              gender === g ? "bg-brand text-white" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {g === "female" ? "♀ 여성" : "♂ 남성"}
          </button>
        ))}
      </div>
      <div className={`inline-flex flex-wrap gap-1.5 rounded-full border border-stone-200 bg-white p-1 ${compact ? "" : "shadow-sm"}`}>
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSize(s)}
            aria-pressed={size === s}
            className={`min-w-[2.75rem] rounded-full font-bold transition ${compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm"} ${
              size === s ? "bg-stone-950 text-white" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {mannequinSizeShortLabel[s]}
          </button>
        ))}
      </div>
    </div>
  );
};
