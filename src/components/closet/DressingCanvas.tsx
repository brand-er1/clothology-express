import { characterConfig } from "@/lib/closet-character-config";
import type { CharacterGender } from "@/types/closet";

interface DressingCanvasProps {
  character: CharacterGender;
  /** The latest AI-rendered "character wearing the outfit" image. Falls back to the plain base character. */
  renderedCharacterImage?: string | null;
  className?: string;
}

export const DressingCanvas = ({ character, renderedCharacterImage, className = "" }: DressingCanvasProps) => {
  const config = characterConfig[character];
  const displayImage = renderedCharacterImage || config.baseImage;

  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-[#f4f0ea] to-[#ece5db] ${className}`}>
      <img
        key={displayImage}
        src={displayImage}
        alt={config.label}
        className="absolute inset-0 h-full w-full object-contain p-6"
      />
    </div>
  );
};
