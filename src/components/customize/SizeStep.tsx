
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface SizeStepProps {
  selectedSize: string;
  customMeasurements: Record<string, number>;
  onSizeChange: (size: string) => void;
  onCustomMeasurementChange: (label: string, value: string) => void;
  selectedType: string;
  gender?: string;
}

interface SizeRecommendation {
  성별: string;
  키: number;
  사이즈: string;
  옷_종류: string;
  그에_맞는_사이즈_표: {
    어깨너비?: number;
    가슴둘레?: number;
    허리둘레?: number;
    소매길이?: number;
    총장: number;
    엉덩이둘레?: number;
    허벅지둘레?: number;
    밑단_너비?: number;
  };
}

export const SizeStep = ({
  selectedSize,
  customMeasurements,
  onSizeChange,
  onCustomMeasurementChange,
  selectedType,
  gender = "남성",
}: SizeStepProps) => {
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [userGender, setUserGender] = useState<string>("남성");
  const [isLoading, setIsLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<SizeRecommendation | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log("사용자가 로그인하지 않았습니다.");
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('height, gender')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("프로필 로드 오류:", error);
          return;
        }

        if (profile) {
          setUserHeight(profile.height);
          setUserGender(profile.gender || "남성");
          // 프로필 로드 후 바로 사이즈 추천 요청
          if (profile.height && selectedType) {
            await requestSizeRecommendation(profile.height, profile.gender || "남성", selectedType);
          }
        }
      } catch (error) {
        console.error("프로필 로드 중 오류 발생:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, [selectedType]);

  const requestSizeRecommendation = async (height: number, gender: string, type: string) => {
    try {
      console.log("Requesting size recommendation with:", { height, gender, type });
      
      const response = await fetch('https://jwmzjszdjlrqrhadbggr.supabase.co/functions/v1/size-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gender: gender === "남성" ? "men" : "women",
          height: height,
          type: type
        })
      });

      if (!response.ok) {
        throw new Error('Size recommendation request failed');
      }

      const data = await response.json();
      console.log("Raw response data:", data);
      setRawResponse(data);
      setRecommendation(data);
      onSizeChange(data.사이즈);
    } catch (error) {
      console.error("사이즈 추천 요청 중 오류 발생:", error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">사용자 정보를 불러오는 중...</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-8">
      <div className="space-y-6">
        <Card className="border-2 border-gray-100 shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Debug Info */}
              <div className="bg-gray-100 p-4 rounded-lg mb-4">
                <h4 className="text-sm font-semibold mb-2">디버그 정보</h4>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify({
                    selectedType,
                    userHeight,
                    userGender,
                    rawResponse
                  }, null, 2)}
                </pre>
              </div>

              {/* 사용자 정보 섹션 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">성별</h4>
                    <p className="text-lg mt-1">{userGender}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">키</h4>
                    <p className="text-lg mt-1">{userHeight ? `${userHeight}cm` : "정보 없음"}</p>
                  </div>
                </div>
              </div>

              {/* 추천 사이즈 정보 섹션 */}
              {recommendation && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">추천 사이즈 정보</h3>
                  <div className="space-y-4">
                    <div className="bg-brand/5 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500">추천 사이즈</span>
                          <p className="text-2xl font-bold text-brand mt-1">{recommendation.사이즈}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">의류 종류</span>
                          <p className="text-lg mt-1">{recommendation.옷_종류}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-4">상세 치수</h4>
                      <Table>
                        <TableBody className="divide-y">
                          {Object.entries(recommendation.그에_맞는_사이즈_표).map(([key, value]) => (
                            <TableRow key={key} className="hover:bg-gray-50/50">
                              <TableCell className="py-3 font-medium">{key}</TableCell>
                              <TableCell className="text-right py-3">
                                <span className="font-semibold">{value}</span>
                                <span className="text-gray-500 ml-1">cm</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 측정 기준 이미지를 위한 공간 */}
      <div className="min-h-[600px] bg-gray-50 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">측정 기준 이미지가 들어갈 공간입니다</p>
      </div>
    </div>
  );
};

export default SizeStep;
