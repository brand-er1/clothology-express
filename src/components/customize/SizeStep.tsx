
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { topSizes, bottomSizes, type Size } from "@/lib/size-constants";

interface SizeStepProps {
  selectedType: "tops" | "bottoms";
  selectedSize: string;
  customMeasurements: Record<string, number>;
  onTypeChange: (type: "tops" | "bottoms") => void;
  onSizeChange: (sizeId: string) => void;
  onCustomMeasurementChange: (label: string, value: string) => void;
}

export const SizeStep = ({
  selectedType,
  selectedSize,
  customMeasurements,
  onTypeChange,
  onSizeChange,
  onCustomMeasurementChange,
}: SizeStepProps) => {
  return (
    <>
      <h1 className="text-3xl font-bold text-center mb-8">
        옷 사이즈 선택
      </h1>

      {/* 옷 종류 선택 */}
      <div className="mb-8">
        <div className="flex justify-center gap-4">
          <Button
            variant={selectedType === "tops" ? "default" : "outline"}
            onClick={() => onTypeChange("tops")}
          >
            상의
          </Button>
          <Button
            variant={selectedType === "bottoms" ? "default" : "outline"}
            onClick={() => onTypeChange("bottoms")}
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
            onClick={() => onSizeChange(size.id)}
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
          onClick={() => onSizeChange("custom")}
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
                    onChange={(e) => onCustomMeasurementChange(measurement.label, e.target.value)}
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
    </>
  );
};
