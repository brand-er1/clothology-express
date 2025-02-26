
import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, Shirt, Scissors, Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type Detail = {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
};

type Step = "type" | "material" | "detail" | "image" | "size";

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

type StyleOption = {
  value: string;
  label: string;
};

type PocketOption = {
  value: string;
  label: string;
};

type ColorOption = {
  value: string;
  label: string;
  hex: string;
};

const styleOptions: StyleOption[] = [
  { value: "casual", label: "캐주얼" },
  { value: "formal", label: "포멀" },
  { value: "street", label: "스트릿" },
  { value: "modern", label: "모던" },
];

const pocketOptions: PocketOption[] = [
  { value: "none", label: "없음" },
  { value: "one-chest", label: "가슴 포켓 1개" },
  { value: "two-side", label: "사이드 포켓 2개" },
  { value: "multiple", label: "멀티 포켓" },
];

const colorOptions: ColorOption[] = [
  { value: "black", label: "검정", hex: "#000000" },
  { value: "white", label: "흰색", hex: "#FFFFFF" },
  { value: "navy", label: "네이비", hex: "#000080" },
  { value: "gray", label: "회색", hex: "#808080" },
];

const steps: Step[] = ["type", "material", "detail", "image", "size"];

import * as fal from '@fal-ai/serverless-client';
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";

fal.config({
  credentials: "fal_key_..." // NOTE: fal.ai API 키가 필요합니다
});

const Customize = () => {
  const [currentStep, setCurrentStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");
  const [selectedDetail, setSelectedDetail] = useState<string>("");
  const [materials, setMaterials] = useState<Material[]>(defaultMaterials);
  const [newMaterialName, setNewMaterialName] = useState("");
  const [detailInput, setDetailInput] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedPocket, setSelectedPocket] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const handleStyleSelect = (value: string) => {
    const style = styleOptions.find(opt => opt.value === value);
    if (style) {
      setSelectedStyle(value);
      const newDetail = `스타일: ${style.label}\n${detailInput}`;
      setDetailInput(newDetail);
    }
  };

  const handlePocketSelect = (value: string) => {
    const pocket = pocketOptions.find(opt => opt.value === value);
    if (pocket) {
      setSelectedPocket(value);
      const newDetail = `포켓: ${pocket.label}\n${detailInput}`;
      setDetailInput(newDetail);
    }
  };

  const handleColorSelect = (value: string) => {
    const color = colorOptions.find(opt => opt.value === value);
    if (color) {
      setSelectedColor(value);
      const newDetail = `색상: ${color.label}\n${detailInput}`;
      setDetailInput(newDetail);
    }
  };

  const handleAddMaterial = () => {
    if (newMaterialName.trim()) {
      const newMaterial: Material = {
        id: `custom-${Date.now()}`,
        name: newMaterialName.trim(),
        description: "사용자 지정 원단",
        isCustom: true,
      };
      setMaterials([...materials, newMaterial]);
      setSelectedMaterial(newMaterial.id); // 새로 추가된 원단 자동 선택
      setNewMaterialName("");
    }
  };

  const handleAddDetail = () => {
    if (detailInput.trim()) {
      setSelectedDetail(detailInput);
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

              {/* Add Custom Material Card */}
              <Card className="p-6 border-dashed">
                <div className="flex items-center space-x-4">
                  <Input
                    value={newMaterialName}
                    onChange={(e) => setNewMaterialName(e.target.value)}
                    placeholder="새로운 원단 이름"
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddMaterial}
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

      case "detail":
        return (
          <div className="space-y-8">
            {/* Detail Input Area */}
            <Card className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    추가적인 디테일을 더 입력하세요. 아래 옵션들을 선택하거나 직접 입력할 수 있습니다.
                  </p>
                  <textarea
                    value={detailInput}
                    onChange={(e) => setDetailInput(e.target.value)}
                    placeholder="추가 디테일을 자유롭게 입력해주세요"
                    className="w-full h-32 p-3 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>
            </Card>

            {/* Detail Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Style Selection */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">스타일</h3>
                <Select value={selectedStyle} onValueChange={handleStyleSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="스타일 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {styleOptions.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>

              {/* Pocket Selection */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">포켓</h3>
                <Select value={selectedPocket} onValueChange={handlePocketSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="포켓 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {pocketOptions.map((pocket) => (
                      <SelectItem key={pocket.value} value={pocket.value}>
                        {pocket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>

              {/* Color Selection */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">색상</h3>
                <Select value={selectedColor} onValueChange={handleColorSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="색상 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-gray-200"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>
            </div>
          </div>
        );

      case "image":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 이미지 생성 영역 */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">이미지 생성</h3>
                <p className="text-sm text-gray-500">
                  선택하신 옵션을 바탕으로 AI가 의상 이미지를 생성합니다.
                </p>
                <div className="flex justify-center items-center h-64 bg-gray-100 rounded-lg">
                  {isLoading ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                      <p className="text-sm text-gray-500">이미지 생성 중...</p>
                    </div>
                  ) : generatedImageUrl ? (
                    <img
                      src={generatedImageUrl}
                      alt="Generated clothing design"
                      className="max-h-full rounded-lg"
                    />
                  ) : (
                    <Button 
                      onClick={handleGenerateImage}
                      className="bg-brand hover:bg-brand-dark"
                    >
                      이미지 생성하기
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* 선택한 옵션 요약 */}
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">선택한 옵션</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">의류 종류:</span>
                    <span className="font-medium">
                      {clothTypes.find(type => type.id === selectedType)?.name || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">소재:</span>
                    <span className="font-medium">
                      {materials.find(material => material.id === selectedMaterial)?.name || "-"}
                    </span>
                  </div>
                  {selectedDetail && selectedDetail.trim() && (
                    <div className="pt-2 border-t">
                      <span className="text-gray-600">추가 디테일:</span>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{selectedDetail}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        );

      case "size":
        return (
          <div className="max-w-md mx-auto">
            <p className="text-center text-gray-600 mb-8">
              사이즈 커스터마이징은 다음 업데이트에서 제공됩니다
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const handleGenerateImage = async () => {
    try {
      setIsLoading(true);
      
      // 선택된 옵션들을 하나의 프롬프트로 조합
      const selectedClothType = clothTypes.find(type => type.id === selectedType)?.name || "";
      const selectedMaterialName = materials.find(material => material.id === selectedMaterial)?.name || "";
      
      const prompt = `${selectedClothType} made of ${selectedMaterialName}. ${selectedDetail || ""}`.trim();

      const { data, error } = await supabase.functions.invoke('generate-optimized-image', {
        body: { prompt }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        toast({
          title: "이미지 생성 완료",
          description: "AI가 생성한 이미지가 준비되었습니다.",
        });
      } else {
        throw new Error("이미지 생성에 실패했습니다");
      }
      
    } catch (err) {
      console.error("Image generation failed:", err);
      toast({
        title: "오류",
        description: "이미지 생성에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentStep === "detail") {
      setSelectedDetail(detailInput); // 항상 현재 detailInput을 저장
    }
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
            {currentStep === "detail" && "Add Details"}
            {currentStep === "image" && "Generate Image"}
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
                (currentStep === "material" && !selectedMaterial)
                // detail 스텝에서는 항상 활성화
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
