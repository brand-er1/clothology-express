
import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSizeRecommendation, SizeRecommendationResult } from "@/services/sizeRecommendation";
import { materials, clothTypes } from "@/lib/customize-constants";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SizeStepProps {
  selectedSize: string;
  customMeasurements: Record<string, number>;
  onSizeChange: (size: string) => void;
  onCustomMeasurementChange: (label: string, value: string) => void;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  generatedPrompt: string;
  gender?: string;
  height?: number | null;
}

export const SizeStep = ({
  selectedSize,
  customMeasurements,
  onSizeChange,
  onCustomMeasurementChange,
  selectedType,
  selectedMaterial,
  selectedDetail,
  generatedPrompt,
  gender = "남성",
  height = null,
}: SizeStepProps) => {
  const [loading, setLoading] = useState(false);
  const [recommendedSize, setRecommendedSize] = useState<SizeRecommendationResult | null>(null);
  const [debugData, setDebugData] = useState<any>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  const measurementLabels = {
    tops: ["가슴 둘레", "어깨 너비", "소매 길이", "총장"],
    bottoms: ["허리 둘레", "엉덩이 둘레", "허벅지 둘레", "인심"],
    all: ["가슴 둘레", "어깨 너비", "소매 길이", "총장", "허리 둘레", "엉덩이 둘레", "허벅지 둘레", "인심"],
  };

  const getRelevantMeasurements = () => {
    const selectedTypeData = clothTypes.find(type => type.id === selectedType);
    if (selectedTypeData?.category === "tops") {
      return measurementLabels.tops;
    } else if (selectedTypeData?.category === "bottoms") {
      return measurementLabels.bottoms;
    }
    return measurementLabels.all;
  };

  const sizeOptions = ["S", "M", "L", "XL"];

  const handleGetRecommendation = async () => {
    if (!height) {
      alert("사이즈 추천을 위해 키 정보가 필요합니다. 프로필에서 키를 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const result = await getSizeRecommendation(
        gender,
        height,
        selectedType,
        selectedMaterial,
        selectedDetail,
        generatedPrompt
      );
      
      setRecommendedSize(result);
      
      // 디버그 데이터 저장
      setDebugData({
        requestData: {
          gender,
          height,
          type: selectedType,
          material: selectedMaterial,
          detail: selectedDetail,
          prompt: generatedPrompt
        },
        response: result
      });
      
      if (result.사이즈) {
        onSizeChange(result.사이즈);
      }
    } catch (error) {
      console.error("Failed to get size recommendation:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset recommendedSize when any of the dependencies change
    setRecommendedSize(null);
  }, [selectedType, selectedMaterial, selectedDetail, gender, height]);

  const renderJSON = (json: any) => {
    return (
      <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-[300px]">
        {JSON.stringify(json, null, 2)}
      </pre>
    );
  };

  const renderDebugSteps = () => {
    if (!recommendedSize?.debugLogs?.steps) return null;

    return (
      <div className="space-y-4">
        {recommendedSize.debugLogs.steps.map((step, index) => (
          <div key={index} className="border rounded p-3">
            <h4 className="font-semibold">{step.step}</h4>
            {renderJSON(step.data)}
          </div>
        ))}
      </div>
    );
  };

  const renderDebugErrors = () => {
    if (!recommendedSize?.debugLogs?.errors?.length) return null;

    return (
      <div className="border border-red-200 bg-red-50 p-3 rounded">
        <h4 className="font-semibold text-red-700">오류</h4>
        <ul className="list-disc pl-5">
          {recommendedSize.debugLogs.errors.map((error, index) => (
            <li key={index} className="text-red-600">{error}</li>
          ))}
        </ul>
      </div>
    );
  };

  const renderDebugWarnings = () => {
    if (!recommendedSize?.debugLogs?.warnings?.length) return null;

    return (
      <div className="border border-yellow-200 bg-yellow-50 p-3 rounded">
        <h4 className="font-semibold text-yellow-700">경고</h4>
        <ul className="list-disc pl-5">
          {recommendedSize.debugLogs.warnings.map((warning, index) => (
            <li key={index} className="text-yellow-600">{warning}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-center mb-6">사이즈 선택</h2>

      {/* Size Recommendation */}
      <Card className="p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">사이즈 추천</h3>
            <Button 
              onClick={handleGetRecommendation} 
              disabled={loading || !height}
              variant="outline"
            >
              {loading ? "추천 중..." : "추천 받기"}
            </Button>
          </div>

          {!height && (
            <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-yellow-800">
              <p>프로필에 키 정보를 추가하면 사이즈 추천을 받을 수 있습니다.</p>
            </div>
          )}

          {recommendedSize && !recommendedSize.error && (
            <div className="bg-green-50 p-4 rounded border border-green-200">
              <p className="text-lg font-medium">
                <span className="font-bold">추천 사이즈:</span> {recommendedSize.사이즈}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                성별: {recommendedSize.성별}, 키: {recommendedSize.키}cm
              </p>
              {recommendedSize.사이즈표 && (
                <div className="mt-3">
                  <h4 className="font-medium mb-1">사이즈 상세 정보:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(recommendedSize.사이즈표).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-600">{key}:</span>
                        <span>{value}cm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {recommendedSize?.error && (
            <div className="bg-red-50 p-4 rounded border border-red-200 text-red-800">
              <p className="font-medium">오류: {recommendedSize.error}</p>
            </div>
          )}

          {/* 디버그 정보 아코디언 */}
          {debugData && (
            <Accordion
              type="single"
              collapsible
              className="mt-4"
              value={isDebugOpen ? "debug" : undefined}
              onValueChange={(val) => setIsDebugOpen(val === "debug")}
            >
              <AccordionItem value="debug">
                <AccordionTrigger className="text-gray-500 hover:text-gray-800">
                  디버그 정보 {isDebugOpen ? "숨기기" : "보기"}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <h4 className="font-medium">요청 정보</h4>
                    {renderJSON(debugData.requestData)}

                    <h4 className="font-medium">처리 단계</h4>
                    {renderDebugSteps()}

                    {renderDebugErrors()}
                    {renderDebugWarnings()}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </Card>

      {/* Size Selection */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">사이즈 선택</h3>
        <RadioGroup
          value={selectedSize}
          onValueChange={onSizeChange}
          className="grid grid-cols-4 gap-4"
        >
          {sizeOptions.map((size) => (
            <div key={size} className="flex items-center space-x-2">
              <RadioGroupItem value={size} id={`size-${size}`} />
              <Label htmlFor={`size-${size}`} className="cursor-pointer">
                {size}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Card>

      {/* Custom Measurements */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-4">맞춤 측정 (선택사항)</h3>
        <p className="text-sm text-gray-500 mb-4">
          정확한 맞춤을 위해 원하는 치수를 센티미터(cm) 단위로 입력해주세요.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getRelevantMeasurements().map((label) => (
            <div key={label} className="flex flex-col space-y-1">
              <Label htmlFor={`measurement-${label}`}>{label} (cm)</Label>
              <Input
                id={`measurement-${label}`}
                type="number"
                placeholder="0"
                value={customMeasurements[label] || ""}
                onChange={(e) => onCustomMeasurementChange(label, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
