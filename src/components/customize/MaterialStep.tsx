import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Plus } from "lucide-react";

interface MaterialStepProps {
  materials: Material[];
  selectedMaterial: string;
  newMaterialName: string;
  onSelectMaterial: (materialId: string) => void;
  onNewMaterialNameChange: (name: string) => void;
  onAddMaterial: () => void;
}

type Material = {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
};

export const MaterialStep = ({
  materials,
  selectedMaterial,
  newMaterialName,
  onSelectMaterial,
  onNewMaterialNameChange,
  onAddMaterial,
}: MaterialStepProps) => {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {materials.map((material) => {
          const isSelected = selectedMaterial === material.id;
          return (
            <Card
              key={material.id}
              role="button"
              tabIndex={0}
              className={`relative cursor-pointer rounded-2xl p-6 transition-all ${
                isSelected
                  ? "border-brand bg-[#fff9f7] shadow-[0_12px_35px_rgba(113,16,17,0.08)] ring-1 ring-brand"
                  : "border-stone-200 bg-white hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-lg"
              } ${material.isCustom ? "border-dashed" : ""}`}
              onClick={() => onSelectMaterial(material.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelectMaterial(material.id);
              }}
            >
              {isSelected && (
                <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <h3 className="pr-8 text-lg font-bold">{material.name}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">{material.description}</p>
            </Card>
          );
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6">
        <div className="mb-3">
          <p className="text-sm font-bold">원하는 원단이 목록에 없나요?</p>
          <p className="mt-1 text-xs text-stone-500">알고 있는 원단명을 직접 추가할 수 있어요.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newMaterialName}
            onChange={(event) => onNewMaterialNameChange(event.target.value)}
            placeholder="예: 스웨이드, 울 혼방"
            className="h-12 flex-1 rounded-xl bg-[#fbfaf8]"
          />
          <Button
            type="button"
            onClick={onAddMaterial}
            disabled={!newMaterialName.trim()}
            className="h-12 rounded-xl bg-stone-950 px-6 hover:bg-brand"
          >
            <Plus className="mr-1.5 h-4 w-4" /> 원단 추가
          </Button>
        </div>
      </div>
    </div>
  );
};
