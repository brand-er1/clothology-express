import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAvailableSizes, getMeasurements, getSizeGuide, recommendSizeByHeight, getBaseSizeByHeight, getDetailedSizeInfo } from "@/lib/size-data";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";

interface SizeStepProps {
  selectedSize: string;
  customMeasurements: Record<string, number>;
  onSizeChange: (size: string) => void;
  onCustomMeasurementChange: (label: string, value: string) => void;
  selectedType: string;
  gender?: string;
}

export const SizeStep = ({
  selectedSize,
  customMeasurements,
  onSizeChange,
  onCustomMeasurementChange,
  selectedType,
  gender = "남성",
}: SizeStepProps) => {
  const [recommendedSize, setRecommendedSize] = useState<string | null>(null);
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [userGender, setUserGender] = useState<string | null>(null);
  const [detailedSizeInfo, setDetailedSizeInfo] = useState<any>(null);

  // 사용자 프로필에서 키와 성별 정보 가져오기
  useEffect(() => {
    const loadUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('height, gender')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserHeight(profile.height);
        setUserGender(profile.gender);
      }
    };

    loadUserProfile();
  }, []);

  // 키, 성별 정보가 있을 때 기본 사이즈 추천
  useEffect(() => {
    if (userHeight && userGender) {
      const baseSize = getBaseSizeByHeight(userGender, userHeight);
      setRecommendedSize(baseSize);
      
      // 의류 종류가 선택되었다면 상세 사이즈 정보도 가져옴
      if (selectedType) {
        const detailed = getDetailedSizeInfo(userGender, userHeight, selectedType);
        setDetailedSizeInfo(detailed);
      }
    }
  }, [userHeight, userGender, selectedType]);

  // 의류 종류에 따른 한글 이름 매핑
  const getKoreanTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      "outer_jacket": "아우터/자켓",
      "short_sleeve": "반팔 티셔츠",
      "long_sleeve_regular": "긴팔 티셔츠 (레귤러핏)",
      "long_sleeve_loose": "긴팔 티셔츠 (루즈핏)",
      "sweatshirt_regular": "맨투맨 (레귤러핏)",
      "sweatshirt_loose": "맨투맨 (루즈핏)",
      "shorts": "반바지",
      "long_pants": "긴바지"
    };
    return typeMap[type] || type;
  };

  return (
    <div className="space-y-8">
      {userHeight && recommendedSize && userGender && (
        <Card className="p-6 bg-brand/5 border-brand">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium mb-1">추천 사이즈</h3>
              <p className="text-sm text-gray-600">
                {userGender}, 키 {userHeight}cm, {getKoreanTypeName(selectedType)} 기준으로{" "}
                <span className="font-semibold text-brand">{recommendedSize}</span> 사이즈를 추천드립니다.
              </p>
            </div>
            <Button
              onClick={() => onSizeChange(recommendedSize)}
              variant="outline"
              className="border-brand text-brand hover:bg-brand hover:text-white"
            >
              추천 사이즈 선택
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {getAvailableSizes(gender, selectedType).map((size) => {
          const sizeData = getMeasurements(gender, selectedType, size);
          
          return (
            <Card
              key={size}
              className={`p-6 cursor-pointer transition-all ${
                selectedSize === size
                  ? "border-brand ring-2 ring-brand/20"
                  : "hover:border-brand/20"
              } ${recommendedSize === size ? "bg-brand/5" : ""}`}
              onClick={() => onSizeChange(size)}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">{size}</h3>
                  {recommendedSize === size && (
                    <span className="text-sm text-brand font-medium">추천</span>
                  )}
                </div>
                <div className="space-y-2">
                  {sizeData && Object.entries(sizeData).map(([label, value]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-gray-600">{label}</span>
                      <span>{value}cm</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}

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
              {getSizeGuide(gender, selectedType).map(({ label, unit }) => (
                <div key={label} className="space-y-2">
                  <Label htmlFor={label}>
                    {label} ({unit})
                  </Label>
                  <Input
                    id={label}
                    type="number"
                    value={customMeasurements[label] || ""}
                    onChange={(e) => onCustomMeasurementChange(label, e.target.value)}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h4 className="font-medium mb-4">사이즈 안내</h4>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
          <li>사이즈는 측정 방법과 위치에 따라 1~3cm 오차가 있을 수 있습니다.</li>
          <li>맞춤 사이즈 선택 시 측정값의 오차 범위를 고려하여 제작됩니다.</li>
          <li>선택하신 사이즈보다 큰 사이즈가 필요한 경우, 맞춤 사이즈를 선택해주세요.</li>
          {userHeight && <li>성별, 키, 의류 종류를 기준으로 한 추천 사이즈는 참고용이며, 체형에 따라 다를 수 있습니다.</li>}
        </ul>
      </Card>
    </div>
  );
};
