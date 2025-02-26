
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

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
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {materials.map((material) => (
          <Card
            key={material.id}
            className={`p-6 cursor-pointer transition-all ${
              selectedMaterial === material.id
                ? "border-brand ring-2 ring-brand/20"
                : "hover:border-brand/20"
            } ${material.isCustom ? "border-dashed" : ""}`}
            onClick={() => onSelectMaterial(material.id)}
          >
            <div className="flex flex-col space-y-2">
              <h3 className="text-lg font-semibold">{material.name}</h3>
              <p className="text-sm text-gray-500">{material.description}</p>
            </div>
          </Card>
        ))}

        {/* Add Custom Material Card */}
        <Card className="p-6 border-dashed">
          <div className="flex items-center space-x-4">
            <Input
              value={newMaterialName}
              onChange={(e) => onNewMaterialNameChange(e.target.value)}
              placeholder="새로운 원단 이름"
              className="flex-1"
            />
            <Button
              onClick={onAddMaterial}
              disabled={!newMaterialName.trim()}
              size="sm"
              className="flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
