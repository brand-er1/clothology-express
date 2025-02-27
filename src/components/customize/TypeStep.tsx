
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clothTypes } from "@/lib/customize-constants";

interface TypeStepProps {
  selectedType: string;
  onSelectType: (type: string) => void;
}

export const TypeStep = ({ selectedType, onSelectType }: TypeStepProps) => {
  // 타입 매핑 - Edge Function에 전달될 타입명과 일치하도록
  const getTypeValue = (typeId: string): string => {
    const typeMapping: { [key: string]: string } = {
      'jacket': 'outer_jacket',
      'long_pants': 'long_pants_regular',
      'short_pants': 'shorts',
      'short_sleeve': 'short_sleeve',
      'long_sleeve': 'long_sleeve_regular',
      'sweatshirt': 'sweatshirt_regular'
    };
    
    return typeMapping[typeId] || typeId;
  };

  return (
    <div className="space-y-8">
      {/* Tops Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">상의</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {clothTypes
            .filter((type) => type.category === "tops")
            .map((type) => (
              <Card
                key={type.id}
                className={`p-6 cursor-pointer transition-all ${
                  selectedType === type.id
                    ? "border-brand ring-2 ring-brand/20"
                    : "hover:border-brand/20"
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-brand/5 rounded-full">
                    {type.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </Card>
            ))}
        </div>
      </div>

      {/* Bottoms Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">하의</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {clothTypes
            .filter((type) => type.category === "bottoms")
            .map((type) => (
              <Card
                key={type.id}
                className={`p-6 cursor-pointer transition-all ${
                  selectedType === type.id
                    ? "border-brand ring-2 ring-brand/20"
                    : "hover:border-brand/20"
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-brand/5 rounded-full">
                    {type.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </Card>
            ))}
        </div>
      </div>

      {/* Custom Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">커스텀</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {clothTypes
            .filter((type) => type.category === "custom")
            .map((type) => (
              <Card
                key={type.id}
                className={`p-6 cursor-pointer transition-all ${
                  selectedType === type.id
                    ? "border-brand ring-2 ring-brand/20"
                    : "hover:border-brand/20"
                }`}
                onClick={() => onSelectType(type.id)}
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-brand/5 rounded-full">
                    {type.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
};
