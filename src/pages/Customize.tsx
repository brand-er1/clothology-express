import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, Shirt, Scissors, Plus } from "lucide-react";

type ClothType = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: "tops" | "bottoms" | "custom";
};

type Material = {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
};

type Step = "type" | "material" | "style" | "size";

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

const defaultMaterials: Material[] = [
  { 
    id: "cotton", 
    name: "면", 
    description: "부드럽고 통기성이 좋은 천연 소재" 
  },
  { 
    id: "denim", 
    name: "데님", 
    description: "튼튼하고 클래식한 청바지 소재" 
  },
  { 
    id: "poly", 
    name: "폴리", 
    description: "구김이 적고 관리가 쉬운 소재" 
  },
  { 
    id: "linen", 
    name: "린넨", 
    description: "시원하고 자연스러운 질감의 소재" 
  },
];

const styles = [
  { id: "casual", name: "Casual", description: "Perfect for everyday wear" },
  { id: "formal", name: "Formal", description: "Elegant and sophisticated" },
  { id: "business", name: "Business", description: "Professional attire" },
  { id: "vintage", name: "Vintage", description: "Classic and timeless" },
];

const Customize = () => {
  const [currentStep, setCurrentStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [materials, setMaterials] = useState<Material[]>(defaultMaterials);
  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialDescription, setNewMaterialDescription] = useState("");

  const steps: Step[] = ["type", "material", "style", "size"];

  const handleAddMaterial = () => {
    if (newMaterialName.trim()) {
      const newMaterial: Material = {
        id: `custom-${Date.now()}`,
        name: newMaterialName.trim(),
        description: newMaterialDescription.trim() || "사용자 지정 원단",
        isCustom: true,
      };
      setMaterials([...materials, newMaterial]);
      setNewMaterialName("");
      setNewMaterialDescription("");
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "type":
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
                      onClick={() => setSelectedType(type.id)}
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
                      onClick={() => setSelectedType(type.id)}
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
                      onClick={() => setSelectedType(type.id)}
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

      case "material":
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
                  onClick={() => setSelectedMaterial(material.id)}
                >
                  <div className="flex flex-col space-y-2">
                    <h3 className="text-lg font-semibold">{material.name}</h3>
                    <p className="text-sm text-gray-500">{material.description}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Add Custom Material Section */}
            <Card className="p-6 border-dashed">
              <h3 className="text-lg font-semibold mb-4">새로운 원단 추가</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    원단 이름
                  </label>
                  <Input
                    value={newMaterialName}
                    onChange={(e) => setNewMaterialName(e.target.value)}
                    placeholder="원단 이름을 입력하세요"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    원단 설명
                  </label>
                  <Input
                    value={newMaterialDescription}
                    onChange={(e) => setNewMaterialDescription(e.target.value)}
                    placeholder="원단에 대한 설명을 입력하세요"
                    className="w-full"
                  />
                </div>
                <Button
                  onClick={handleAddMaterial}
                  disabled={!newMaterialName.trim()}
                  className="w-full flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  새로운 원단 추가하기
                </Button>
              </div>
            </Card>
          </div>
        );

      case "style":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {styles.map((style) => (
              <Card
                key={style.id}
                className={`p-6 cursor-pointer transition-all ${
                  selectedStyle === style.id
                    ? "border-brand ring-2 ring-brand/20"
                    : "hover:border-brand/20"
                }`}
                onClick={() => setSelectedStyle(style.id)}
              >
                <div className="flex flex-col space-y-2">
                  <h3 className="text-lg font-semibold">{style.name}</h3>
                  <p className="text-sm text-gray-500">{style.description}</p>
                </div>
              </Card>
            ))}
          </div>
        );

      case "size":
        return (
          <div className="max-w-md mx-auto">
            <p className="text-center text-gray-600 mb-8">
              Size customization coming in the next update
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const handleNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-12">
            <div className="flex items-center justify-center space-x-8">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="flex items-center"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      currentStep === step
                        ? "bg-brand text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-24 h-0.5 bg-gray-200 mx-2" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Title */}
          <h1 className="text-3xl font-bold text-center mb-8">
            {currentStep === "type" && "Choose Your Garment"}
            {currentStep === "material" && "Select Material"}
            {currentStep === "style" && "Pick Your Style"}
            {currentStep === "size" && "Specify Your Size"}
          </h1>

          {/* Step Content */}
          <div className="mb-12">{renderStepContent()}</div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === "type"}
              className="flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={
                (currentStep === "type" && !selectedType) ||
                (currentStep === "material" && !selectedMaterial) ||
                (currentStep === "style" && !selectedStyle)
              }
              className="flex items-center bg-brand hover:bg-brand-dark"
            >
              {currentStep === "size" ? "Submit" : "Next"}{" "}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customize;
