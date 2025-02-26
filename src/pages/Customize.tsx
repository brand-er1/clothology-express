
import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Size = {
  id: string;
  category: "tops" | "bottoms";
  name: string;
  measurements: {
    label: string;
    min: number;
    max: number;
    unit: string;
  }[];
};

// 상의 사이즈 정의
const topSizes: Size[] = [
  {
    id: "top-s",
    category: "tops",
    name: "S",
    measurements: [
      { label: "총장", min: 65, max: 67, unit: "cm" },
      { label: "어깨넓이", min: 43, max: 45, unit: "cm" },
      { label: "가슴둘레", min: 48, max: 50, unit: "cm" },
      { label: "밑단둘레", min: 46, max: 48, unit: "cm" },
      { label: "소매길이", min: 59, max: 61, unit: "cm" },
    ],
  },
  {
    id: "top-m",
    category: "tops",
    name: "M",
    measurements: [
      { label: "총장", min: 67, max: 69, unit: "cm" },
      { label: "어깨넓이", min: 45, max: 47, unit: "cm" },
      { label: "가슴둘레", min: 50, max: 52, unit: "cm" },
      { label: "밑단둘레", min: 48, max: 50, unit: "cm" },
      { label: "소매길이", min: 61, max: 63, unit: "cm" },
    ],
  },
  {
    id: "top-l",
    category: "tops",
    name: "L",
    measurements: [
      { label: "총장", min: 69, max: 71, unit: "cm" },
      { label: "어깨넓이", min: 47, max: 49, unit: "cm" },
      { label: "가슴둘레", min: 52, max: 54, unit: "cm" },
      { label: "밑단둘레", min: 50, max: 52, unit: "cm" },
      { label: "소매길이", min: 63, max: 65, unit: "cm" },
    ],
  },
];

// 하의 사이즈 정의
const bottomSizes: Size[] = [
  {
    id: "bottom-s",
    category: "bottoms",
    name: "S",
    measurements: [
      { label: "총장", min: 95, max: 97, unit: "cm" },
      { label: "허리둘레", min: 35, max: 37, unit: "cm" },
      { label: "엉덩이단면", min: 47, max: 49, unit: "cm" },
      { label: "허벅지단면", min: 28, max: 30, unit: "cm" },
    ],
  },
  {
    id: "bottom-m",
    category: "bottoms",
    name: "M",
    measurements: [
      { label: "총장", min: 97, max: 99, unit: "cm" },
      { label: "허리둘레", min: 37, max: 39, unit: "cm" },
      { label: "엉덩이단면", min: 49, max: 51, unit: "cm" },
      { label: "허벅지단면", min: 30, max: 32, unit: "cm" },
    ],
  },
  {
    id: "bottom-l",
    category: "bottoms",
    name: "L",
    measurements: [
      { label: "총장", min: 99, max: 101, unit: "cm" },
      { label: "허리둘레", min: 39, max: 41, unit: "cm" },
      { label: "엉덩이단면", min: 51, max: 53, unit: "cm" },
      { label: "허벅지단면", min: 32, max: 34, unit: "cm" },
    ],
  },
];

const Customize = () => {
  const [selectedType, setSelectedType] = useState<"tops" | "bottoms">("tops");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [customMeasurements, setCustomMeasurements] = useState<Record<string, number>>({});

  const handleSizeChange = (sizeId: string) => {
    setSelectedSize(sizeId);
    // 사이즈 선택 시 기본 측정값 초기화
    const size = [...topSizes, ...bottomSizes].find(s => s.id === sizeId);
    if (size) {
      const measurements: Record<string, number> = {};
      size.measurements.forEach(m => {
        measurements[m.label] = m.min;
      });
      setCustomMeasurements(measurements);
    }
  };

  const handleCustomMeasurementChange = (label: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setCustomMeasurements(prev => ({
        ...prev,
        [label]: numValue
      }));
    }
  };

  const handleNext = () => {
    if (!selectedSize) {
      toast({
        title: "사이즈 필요",
        description: "사이즈를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    // TODO: 다음 단계로 진행하는 로직 구현
    toast({
      title: "사이즈 저장 완료",
      description: "선택하신 사이즈가 저장되었습니다.",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">
            옷 사이즈 선택
          </h1>

          {/* 옷 종류 선택 */}
          <div className="mb-8">
            <div className="flex justify-center gap-4">
              <Button
                variant={selectedType === "tops" ? "default" : "outline"}
                onClick={() => setSelectedType("tops")}
              >
                상의
              </Button>
              <Button
                variant={selectedType === "bottoms" ? "default" : "outline"}
                onClick={() => setSelectedType("bottoms")}
              >
                하의
              </Button>
            </div>
          </div>

          {/* 사이즈 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {(selectedType === "tops" ? topSizes : bottomSizes).map((size) => (
              <Card
                key={size.id}
                className={`p-6 cursor-pointer transition-all ${
                  selectedSize === size.id
                    ? "border-brand ring-2 ring-brand/20"
                    : "hover:border-brand/20"
                }`}
                onClick={() => handleSizeChange(size.id)}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold">{size.name}</h3>
                  </div>
                  <div className="space-y-2">
                    {size.measurements.map((measurement) => (
                      <div key={measurement.label} className="flex justify-between text-sm">
                        <span className="text-gray-600">{measurement.label}</span>
                        <span>
                          {measurement.min}~{measurement.max}{measurement.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            {/* 맞춤 사이즈 카드 */}
            <Card 
              className={`p-6 cursor-pointer transition-all border-dashed hover:border-brand/20 ${
                selectedSize === "custom"
                  ? "border-brand ring-2 ring-brand/20"
                  : ""
              }`}
              onClick={() => handleSizeChange("custom")}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">맞춤 사이즈</h3>
                </div>
                <div className="space-y-4">
                  {(selectedType === "tops" ? topSizes[0] : bottomSizes[0]).measurements.map((measurement) => (
                    <div key={measurement.label} className="space-y-2">
                      <Label htmlFor={measurement.label}>{measurement.label} ({measurement.unit})</Label>
                      <Input
                        id={measurement.label}
                        type="number"
                        min={measurement.min - 5}
                        max={measurement.max + 5}
                        value={customMeasurements[measurement.label] || ""}
                        onChange={(e) => handleCustomMeasurementChange(measurement.label, e.target.value)}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* 사이즈 안내 */}
          <Card className="p-6 mb-8">
            <h4 className="font-medium mb-4">사이즈 안내</h4>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
              <li>사이즈는 측정 방법과 위치에 따라 1~3cm 오차가 있을 수 있습니다.</li>
              <li>맞춤 사이즈 선택 시 측정값의 오차 범위를 고려하여 제작됩니다.</li>
              <li>선택하신 사이즈보다 큰 사이즈가 필요한 경우, 맞춤 사이즈를 선택해주세요.</li>
            </ul>
          </Card>

          {/* 하단 버튼 */}
          <div className="flex justify-end">
            <Button
              onClick={handleNext}
              className="bg-brand hover:bg-brand-dark"
              disabled={!selectedSize}
            >
              선택 완료
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Customize;
