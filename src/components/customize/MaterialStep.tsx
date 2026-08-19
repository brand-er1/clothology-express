import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Info, Plus } from "lucide-react";
import type { Material } from "@/types/customize";

interface MaterialStepProps {
  materials: Material[];
  selectedType: string;
  selectedMaterial: string;
  newMaterialName: string;
  onSelectMaterial: (materialId: string) => void;
  onNewMaterialNameChange: (name: string) => void;
  onAddMaterial: () => void;
}

export const MaterialStep = ({
  materials,
  selectedType,
  selectedMaterial,
  newMaterialName,
  onSelectMaterial,
  onNewMaterialNameChange,
  onAddMaterial,
}: MaterialStepProps) => {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand/15 bg-brand/5 px-4 py-3.5 sm:px-5">
        <p className="flex items-center gap-2 text-sm font-extrabold text-stone-900">
          <Info className="h-4 w-4 text-brand" /> 카테고리에서 자주 쓰는 추천 원단
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-600">
          생산성·착용감·계절성을 기준으로 많이 사용하는 원단을 먼저 보여드립니다.
          {selectedType === "knit" &&
            " 니트 평균 원단비는 장당 13,000원이며, 로고·이미지는 패치 방식만 가능합니다."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2" data-tutorial="customize-material">
        {materials.map((material) => {
          const isSelected = selectedMaterial === material.id;
          return (
            <Card
              key={material.id}
              role="button"
              tabIndex={0}
              className={`relative cursor-pointer overflow-hidden rounded-2xl transition-all ${
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
                <span className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white shadow-md">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              {material.imageUrl && (
                <div className="aspect-[16/9] overflow-hidden bg-stone-100">
                  <img
                    src={material.imageUrl}
                    alt={`${material.name} 원단 질감 예시`}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2 pr-8">
                  <h3 className="text-[17px] font-bold sm:text-lg">{material.name}</h3>
                  {material.badge && (
                    <Badge className="border-0 bg-brand/10 text-[10px] font-bold text-brand hover:bg-brand/10">
                      {material.badge}
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-[14px] leading-6 text-stone-500 sm:text-sm">
                  {material.description}
                </p>
                {material.characteristics && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {material.characteristics.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-4 sm:p-6">
        <div className="mb-3">
          <p className="text-[15px] font-bold sm:text-sm">원하는 원단이 목록에 없나요?</p>
          <p className="mt-1 text-[13px] text-stone-500 sm:text-xs">알고 있는 원단명을 직접 추가할 수 있어요.</p>
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
