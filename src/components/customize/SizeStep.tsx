
// SizeStep.tsx

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SizeStepProps {
  selectedType: string;      // 예: "short_sleeve", "outer_jacket", "long_sleeve", "sweatshirt", "short_pants", 등
  selectedMaterial: string;
  selectedDetail: string;
  generatedPrompt?: string;
  gender?: string;
  // Add the missing props
  selectedSize?: string;
  customMeasurements?: Record<string, number>;
  onSizeChange?: (size: string) => void;
  onCustomMeasurementChange?: (label: string, value: string) => void;
}

interface SizeRecommendation {
  성별: string;
  키: number;
  사이즈: string;
  사이즈표: Record<string, number>;
}

export const SizeStep = ({
  selectedType,
  selectedMaterial,
  selectedDetail,
  generatedPrompt = "",
  gender = "남성",
  selectedSize,
  customMeasurements,
  onSizeChange,
  onCustomMeasurementChange,
}: SizeStepProps) => {
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [userGender, setUserGender] = useState<string>("남성");
  const [isLoading, setIsLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("사이즈 추천을 위해 로그인이 필요합니다.");
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("height, gender")
          .eq("id", user.id)
          .single();
        if (profileError || !profile) {
          setError("프로필 정보를 불러오는데 실패했습니다.");
          return;
        }
        setUserHeight(profile.height);
        setUserGender(profile.gender || "남성");
        if (profile.height) {
          await requestSizeRecommendation(
            profile.height,
            profile.gender || "남성",
            selectedType,
            selectedMaterial,
            selectedDetail,
            generatedPrompt
          );
        }
      } catch (err: any) {
        setError("프로필 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    loadUserProfile();
  }, [selectedType, selectedMaterial, selectedDetail, generatedPrompt]);

  const requestSizeRecommendation = async (
    height: number,
    gender: string,
    type: string,
    material: string,
    detail: string,
    prompt: string
  ) => {
    try {
      setIsLoading(true);
      const mappedGender = gender === "남성" ? "men" : "women";
      const payload = {
        gender: mappedGender,
        height,
        type,
        material,
        detail,
        prompt,
      };
      
      // Use the supabase client's functions.invoke method instead of direct fetch
      const { data, error } = await supabase.functions.invoke("size-recommendation", {
        body: payload
      });
      
      if (error) {
        throw new Error(error.message || "Size recommendation request failed");
      }
      
      console.log(data)
      setRecommendation(data as SizeRecommendation);
      if (onSizeChange && data && data.사이즈) {
        onSizeChange(data.사이즈);
      }
      setError(null);
    } catch (err: any) {
      console.error("Size recommendation error:", err);
      setError(err.message || "사이즈 추천 요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const translateKey = (key: string): string => {
    const map: Record<string, string> = {
      shoulder: "어깨너비",
      chest: "가슴둘레",
      bust: "가슴둘레",
      waist: "허리둘레",
      sleeve: "소매길이",
      length: "총장",
      hip: "엉덩이둘레",
      thigh: "허벅지둘레",
      bottom_width: "밑단 너비",
      inseam: "인심"
    };
    return map[key] || key;
  };

  // Handle selecting a size manually (for when the user wants to override the recommendation)
  const handleSizeSelect = (size: string) => {
    if (onSizeChange) {
      onSizeChange(size);
    }
  };

  // Handle custom measurement changes
  const handleMeasurementChange = (label: string, value: string) => {
    if (onCustomMeasurementChange) {
      onCustomMeasurementChange(label, value);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-4"></div>
        <p className="text-gray-600">사이즈 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 px-4">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <h3 className="text-lg font-medium text-red-700">사이즈 추천 오류</h3>
              <p className="text-gray-600">{error}</p>
              <Button
                onClick={() =>
                  userHeight &&
                  requestSizeRecommendation(
                    userHeight,
                    userGender,
                    selectedType,
                    selectedMaterial,
                    selectedDetail,
                    generatedPrompt
                  )
                }
                className="mt-4"
              >
                다시 시도
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="text-center py-8">
        <p>사이즈 추천 데이터가 없습니다. 다시 시도해주세요.</p>
        <Button
          onClick={() =>
            userHeight &&
            requestSizeRecommendation(
              userHeight,
              userGender,
              selectedType,
              selectedMaterial,
              selectedDetail,
              generatedPrompt
            )
          }
          className="mt-4"
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4">
      <Card className="border-2 border-gray-100 shadow-sm">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  추천 사이즈: <Badge className="ml-2 text-lg">{recommendation.사이즈}</Badge>
                </h3>
                <p className="text-gray-500 mt-1">
                  {recommendation.성별}, 키 {recommendation.키}cm
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">사이즈 세부 정보</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>측정 부위</TableHead>
                    <TableHead className="text-right">값 (cm)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(recommendation.사이즈표).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{translateKey(key)}</TableCell>
                      <TableCell className="text-right">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SizeStep;
