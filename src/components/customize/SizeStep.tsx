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
  const [requestData, setRequestData] = useState<any>(null);
  const [responseData, setResponseData] = useState<any>(null);

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
      const request = {
        gender: gender === "남성" ? "men" : "women",
        height: height,
        type: type
      };
      
      setRequestData(request);
      console.log("요청 데이터:", request);
      
      const response = await fetch('https://jwmzjszdjlrqrhadbggr.supabase.co/functions/v1/size-recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Size recommendation request failed');
      }

      const data = await response.json();
      console.log("응답 데이터:", data);
      setResponseData(data);
      setRecommendation(data);
      onSizeChange(data.사이즈);
    } catch (error) {
      console.error("사이즈 추천 요청 중 오류 발생:", error);
      setResponseData({ error: error.message });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">사용자 정보를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-8 p-4">
      <Card className="border-2 border-gray-100 shadow-sm">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">API 요청/응답 데이터</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">요청 데이터:</h4>
                  <pre className="bg-white p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(requestData, null, 2)}
                  </pre>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">응답 데이터:</h4>
                  <pre className="bg-white p-3 rounded text-xs overflow-auto">
                    {JSON.stringify(responseData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">현재 상태 값</h3>
              <div className="space-y-2">
                <p><strong>선택된 타입:</strong> {selectedType}</p>
                <p><strong>사용자 키:</strong> {userHeight}cm</p>
                <p><strong>사용자 성별:</strong> {userGender}</p>
                <p><strong>현재 선택된 사이즈:</strong> {selectedSize}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SizeStep;
