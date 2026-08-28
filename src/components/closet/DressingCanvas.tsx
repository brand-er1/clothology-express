import { getMannequinPreset } from "@/lib/mannequin-presets";
import type { CharacterGender, MannequinSize } from "@/types/closet";

interface DressingCanvasProps {
  character: CharacterGender;
  mannequinSize: MannequinSize;
  /** The latest AI-rendered "mannequin wearing the outfit" image. Falls back to the base preset. */
  renderedCharacterImage?: string | null;
  /** Shown as a small badge when the current render has no real garment measurements behind it. */
  isSimulated?: boolean;
  className?: string;
}

/**
 * The virtual mannequin canvas. `object-contain` guarantees the full body and every garment stays
 * visible and uncropped at any viewport size — never force-cropped or force-zoomed (mobile requirement).
 */
export const DressingCanvas = ({
  character,
  mannequinSize,
  renderedCharacterImage,
  isSimulated,
  className = "",
}: DressingCanvasProps) => {
  const preset = getMannequinPreset(character, mannequinSize);
  const displayImage = renderedCharacterImage || preset.previewImage;

  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-[#f4f0ea] to-[#ece5db] ${className}`}>
      <img
        key={displayImage}
        src={displayImage}
        alt={preset.label}
        className="absolute inset-0 h-full w-full object-contain p-6"
      />
      {renderedCharacterImage && isSimulated && (
        <span className="absolute bottom-3 left-3 right-3 rounded-xl bg-stone-950/80 px-3 py-2 text-center text-[11px] font-semibold leading-4 text-white">
          본 이미지는 선택한 체형과 핏 정보를 기반으로 생성된 AI 시뮬레이션이며, 실제 착용 결과와 차이가 있을 수 있습니다.
        </span>
      )}
    </div>
  );
};
