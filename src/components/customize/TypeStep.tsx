import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shirt, Scissors } from "lucide-react";

type ClothType = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: "tops" | "bottoms" | "custom";
};

const clothTypes: ClothType[] = [
  // Tops
  {
    id: "tshirt-short",
    name: "반팔 티셔츠",
    icon: <Shirt className="w-8 h-8" />,
    description: "시원하고 캐주얼한 반팔 티셔츠",
    category: "tops",
  },
  {
    id: "tshirt-long",
    name: "긴소매 티셔츠",
    icon: <Shirt className="w-8 h-8" />,
    description: "편안하고 실용적인 긴소매 티셔츠",
    category: "tops",
  },
  {
    id: "sweatshirt",
    name: "맨투맨",
    icon: <Shirt className="w-8 h-8" />,
    description: "포근하고 세련된 맨투맨",
    category: "tops",
  },
  {
    id: "jacket",
    name: "자켓",
    icon: <Shirt className="w-8 h-8" />,
    description: "스타일리시한 자켓",
    category: "tops",
  },
  // Bottoms
  {
    id: "shorts",
    name: "반바지",
    icon: <Shirt className="w-8 h-8" />,
    description: "시원하고 활동적인 반바지",
    category: "bottoms",
  },
  {
    id: "pants",
    name: "긴바지",
    icon: <Shirt className="w-8 h-8" />,
    description: "편안하고 세련된 긴바지",
    category: "bottoms",
  },
  // Custom
  {
    id: "custom",
    name: "커스텀",
    icon: <Scissors className="w-8 h-8" />,
    description: "나만의 특별한 의상을 제작해보세요 (※ 상황에 따라 주문이 반려될 수 있습니다)",
    category: "custom",
  },
];

interface TypeStepProps {
  selectedType: string;
  onSelectType: (type: string) => void;
}

export const TypeStep = ({ selectedType, onSelectType }: TypeStepProps) => {
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
