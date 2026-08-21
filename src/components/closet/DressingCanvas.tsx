import { characterConfig, closetSlotOrder } from "@/lib/closet-character-config";
import type { CharacterGender, ClosetOutfit } from "@/types/closet";

interface DressingCanvasProps {
  character: CharacterGender;
  outfit: ClosetOutfit;
  className?: string;
}

export const DressingCanvas = ({ character, outfit, className = "" }: DressingCanvasProps) => {
  const config = characterConfig[character];

  return (
    <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-[#f4f0ea] to-[#ece5db] ${className}`}>
      <img
        src={config.baseImage}
        alt={config.label}
        className="absolute inset-0 h-full w-full object-contain p-6"
        style={{ zIndex: 1 }}
      />
      {closetSlotOrder.map((slot) => {
        const garment = outfit[slot];
        if (!garment) return null;
        const anchor = config.anchors[slot];
        return (
          <img
            key={slot}
            src={garment.imageUrl}
            alt={garment.label}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_8px_16px_rgba(20,10,10,0.25)]"
            style={{
              left: `${anchor.xPercent}%`,
              top: `${anchor.yPercent}%`,
              width: `${anchor.widthPercent}%`,
              zIndex: anchor.zIndex,
              transform: `translate(-50%, -50%) rotate(${anchor.rotationDeg ?? 0}deg)`,
            }}
          />
        );
      })}
    </div>
  );
};
