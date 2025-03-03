
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SizeStepProps {
  selectedSize: string;
  customMeasurements: Record<string, number>;
  onSizeChange: (size: string) => void;
  onCustomMeasurementChange: (label: string, value: string) => void;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  generatedPrompt?: string;
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
    인심?: number;
  };
  원단?: string;
  디테일?: string;
  프롬프트?: string;
}

export const SizeStep = ({
  selectedSize,
  customMeasurements,
  onSizeChange,
  onCustomMeasurementChange,
  selectedType,
  selectedMaterial,
  selectedDetail,
  generatedPrompt = "",
  gender = "남성",
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
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        
        if (!user) {
          console.log("사용자가 로그인하지 않았습니다.");
          setError("사이즈 추천을 위해 로그인이 필요합니다.");
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('height, gender')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("프로필 로드 오류:", error);
          setError("프로필 정보를 불러오는데 실패했습니다.");
          return;
        }

        if (profile) {
          setUserHeight(profile.height);
          setUserGender(profile.gender || "남성");
          if (profile.height && selectedType) {
            await requestSizeRecommendation(profile.height, profile.gender || "남성", selectedType, selectedMaterial, selectedDetail, generatedPrompt);
          }
        } else {
          setError("사이즈 추천을 위해 프로필에서 키와 성별 정보를 설정해주세요.");
        }
      } catch (error) {
        console.error("프로필 로드 중 오류 발생:", error);
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
      // 타입 매핑
      const typeMapping: { [key: string]: string } = {
        'jacket': 'outer_jacket',
        'long_pants': 'long_pants',
        'short_pants': 'short_pants',
        'short_sleeve': 'short_sleeve',
        'long_sleeve': 'long_sleeve',
        'sweatshirt': 'sweatshirt'
      };

      const mappedType = typeMapping[type] || type;
      
      const request = {
        gender: gender,
        height: height,
        type: mappedType,
        material: material,
        detail: detail,
        prompt: prompt
      };
      
      console.log("사이즈 추천 요청 데이터:", request);
      
      // 여기서 size-recommendation2로 변경
      const response = await fetch('https://jwmzjszdjlrqrhadbggr.supabase.co/functions/v1/size-recommendation2', {
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
      console.log("사이즈 추천 응답 데이터:", data);
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setRecommendation(data);
      onSizeChange(data.사이즈);
      setError(null);
    } catch (error) {
      console.error("사이즈 추천 요청 중 오류 발생:", error);
      setError("사이즈 추천을 가져오는데 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  // 사이즈 표시 방식을 한글로 변환
  const translateKey = (key: string): string => {
    const keyMap: Record<string, string> = {
      어깨너비: '어깨너비',
      가슴둘레: '가슴둘레',
      허리둘레: '허리둘레',
      소매길이: '소매길이',
      총장: '총장',
      엉덩이둘레: '엉덩이둘레',
      허벅지둘레: '허벅지둘레',
      밑단_너비: '밑단 너비',
      인심: '인심'
    };
    
    return keyMap[key] || key;
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
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-red-700">사이즈 추천 오류</h3>
              <p className="text-gray-600">{error}</p>
              <Button 
                onClick={() => userHeight && requestSizeRecommendation(userHeight, userGender, selectedType, selectedMaterial, selectedDetail, generatedPrompt)}
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
          onClick={() => userHeight && requestSizeRecommendation(userHeight, userGender, selectedType, selectedMaterial, selectedDetail, generatedPrompt)}
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
                <h3 className="text-xl font-semibold">추천 사이즈: <Badge className="ml-2 text-lg">{recommendation.사이즈}</Badge></h3>
                <p className="text-gray-500 mt-1">
                  {recommendation.성별 === '남성' ? '남성' : '여성'}, 키 {recommendation.키}cm, {recommendation.옷_종류.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">사이즈 세부 정보</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>측정 부위</TableHead>
                    <TableHead className="text-right">크기 (cm)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(recommendation.그에_맞는_사이즈_표).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{translateKey(key)}</TableCell>
                      <TableCell className="text-right">{value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">선택한 상품 정보</h3>
              <div className="space-y-2">
                <p><strong>의류 종류:</strong> {selectedType}</p>
                <p><strong>원단:</strong> {selectedMaterial}</p>
                {selectedDetail && (
                  <p>
                    <strong>디테일:</strong> 
                    <span className="block mt-1 text-sm text-gray-600">{selectedDetail}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SizeStep;
