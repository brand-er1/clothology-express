import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { characterConfig } from "@/lib/closet-character-config";
import type { CharacterGender } from "@/types/closet";

interface CharacterCardProps {
  gender: CharacterGender;
  selected: boolean;
  onSelect: (gender: CharacterGender) => void;
}

export const CharacterCard = ({ gender, selected, onSelect }: CharacterCardProps) => {
  const config = characterConfig[gender];

  return (
    <Card
      className={`flex flex-col items-center overflow-hidden rounded-3xl border-2 p-6 text-center shadow-sm transition ${
        selected ? "border-brand bg-brand/5" : "border-stone-200 bg-white hover:border-brand/40"
      }`}
    >
      <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f4f0ea]">
        <img
          src={config.baseImage}
          alt={config.label}
          className="h-full w-full object-contain p-4"
        />
      </div>
      <h3 className="mt-4 text-xl font-black text-stone-950">
        {gender === "male" ? "♂" : "♀"} {config.label}
      </h3>
      <p className="mt-1 text-xs font-semibold text-stone-500">{config.tagline}</p>
      <Button
        type="button"
        onClick={() => onSelect(gender)}
        className={`mt-5 h-11 w-full rounded-full text-sm font-bold ${
          selected ? "bg-brand hover:bg-brand-dark" : "bg-stone-950 hover:bg-stone-800"
        }`}
      >
        선택하기
      </Button>
    </Card>
  );
};
