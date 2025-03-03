
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { SizeTableItem } from "@/types/customize";

interface SizeStepProps {
  selectedSize: string;
  customMeasurements: Record<string, number>;
  sizeTableData: SizeTableItem[];
  onSizeChange: (size: string) => void;
  onCustomMeasurementChange: (label: string, value: string) => void;
  onSizeTableChange: (updatedItem: SizeTableItem) => void;
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  generatedPrompt?: string;
  gender?: string;
}

// 서버 응답 형식에 맞게 인터페이스 수정
interface SizeRecommendation {
  성별: string;
  키: number;
  사이즈: string;
  카테고리: string;
  핏: string;
  사이즈표: {
    어깨너비?: string;
    가슴단면?: string;
    허리단면?: string;
    소매길이?: string;
    총장?: string;
    엉덩이단면?: string;
    허벅지단면?: string;
    밑단?: string;
    인심?: string;
    "추천 키"?: string;
    "바지 길이"?: string;
    밑위?: string;
  };
}

// 각 의류 타입별 이미지 매핑
const clothingImages: Record<string, string> = {
  'short_sleeve': '/lovable-uploads/short_sleeve.png',
  'long_sleeve': '/lovable-uploads/long_sleeve.png', 
  'sweatshirt': '/lovable-uploads/sweatshirt.png',
  'jacket': '/lovable-uploads/jacket.png',
  'short_pants': '/lovable-uploads/short_pants.png',
  'long_pants': '/lovable-uploads/long_pants.png'
};

export const SizeStep = ({
  selectedSize,
  customMeasurements,
  sizeTableData,
  onSizeChange,
  onCustomMeasurementChange,
  onSizeTableChange,
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
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        
        if (!user) {
          console.log("사용자가 로그인하지 않았습니다.");
          setError("사이즈 추천을 위해 로그인이 필요합니다.");
          setIsLoading(false);
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
          setIsLoading(false);
          return;
        }

        if (profile) {
          setUserHeight(profile.height);
          setUserGender(profile.gender || "남성");
          if (profile.height && selectedType) {
            await requestSizeRecommendation(profile.height, profile.gender || "남성", selectedType, selectedMaterial, selectedDetail, generatedPrompt);
          } else {
            setIsLoading(false);
            setError("사이즈 추천을 위해 프로필에서 키 정보를 설정해주세요.");
          }
        } else {
          setError("사이즈 추천을 위해 프로필에서 키와 성별 정보를 설정해주세요.");
          setIsLoading(false);
        }
      } catch (error) {
        console.error("프로필 로드 중 오류 발생:", error);
        setError("프로필 정보를 불러오는 중 오류가 발생했습니다.");
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
      setError(null);
      
      // 타입 매핑
      const typeMapping: { [key: string]: string } = {
        'jacket': '자켓',
        'long_pants': '긴바지',
        'short_pants': '반바지',
        'short_sleeve': '반팔티셔츠',
        'long_sleeve': '긴팔티셔츠',
        'sweatshirt': '맨투맨'
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
      
      const { data, error } = await supabase.functions.invoke('size-recommendation2', {
        body: request
      });

      if (error) {
        console.error("사이즈 추천 요청 오류:", error);
        setError("사이즈 추천을 가져오는데 실패했습니다. 다시 시도해주세요.");
        setIsLoading(false);
        return;
      }

      console.log("사이즈 추천 응답 데이터:", data);
      
      if (data.error) {
        setError(data.error);
        setIsLoading(false);
        return;
      }
      
      // 응답 데이터 형식에 맞게 처리
      setRecommendation(data);
      
      // 사이즈가 비어있지 않은 경우에만 설정
      if (data.사이즈 && data.사이즈.trim() !== '') {
        onSizeChange(data.사이즈);
      } else {
        // 기본 사이즈 설정 (M)
        onSizeChange("M");
        toast({
          title: "기본 사이즈 적용",
          description: "추천 사이즈를 찾을 수 없어 기본 사이즈 M으로 설정했습니다.",
        });
      }
      
      // Create editable size table data from recommendation
      if (data.사이즈표) {
        const newSizeTableData: SizeTableItem[] = Object.entries(data.사이즈표).map(([key, value]) => ({
          key,
          value: value as string,
          editable: true
        }));
        
        // Update the parent component with size table data
        newSizeTableData.forEach(item => onSizeTableChange(item));
      }
      
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
      가슴단면: '가슴단면',
      허리단면: '허리단면',
      소매길이: '소매길이',
      총장: '총장',
      엉덩이단면: '엉덩이단면',
      허벅지단면: '허벅지단면',
      밑단: '밑단',
      인심: '인심',
      "추천 키": '추천 키',
      "바지 길이": '바지 길이',
      밑위: '밑위'
    };
    
    return keyMap[key] || key;
  };
  
  // Extract numeric value from measurement string (e.g., "42cm" -> 42)
  const extractNumericValue = (value: string): number => {
    const numericValue = parseFloat(value);
    return isNaN(numericValue) ? 0 : numericValue;
  };

  // Format measurement value to include "cm" suffix if not already present
  const formatMeasurementValue = (value: string): string => {
    if (value.includes("cm")) return value;
    return `${value}cm`;
  };
  
  // Handle size value change with numeric input validation
  const handleSizeValueChange = (key: string, newValue: string) => {
    // Extract numeric part only
    let numericValue = newValue.replace(/[^0-9.]/g, '');
    
    // Format with cm suffix
    const formattedValue = `${numericValue}cm`;
    
    const updatedItem: SizeTableItem = {
      key,
      value: formattedValue,
      editable: true
    };
    onSizeTableChange(updatedItem);
  };

  // Increment/decrement numeric value
  const adjustSizeValue = (key: string, currentValue: string, adjustment: number) => {
    const numericValue = extractNumericValue(currentValue);
    const newValue = Math.max(0, numericValue + adjustment);
    const formattedValue = `${newValue}cm`;
    
    const updatedItem: SizeTableItem = {
      key,
      value: formattedValue,
      editable: true
    };
    onSizeTableChange(updatedItem);
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

  // Check if we have size table data
  if (sizeTableData.length === 0) {
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

  // 이미지 경로 디버깅
  console.log("Selected Type:", selectedType);
  console.log("Image Path:", clothingImages[selectedType]);

  return (
    <div className="space-y-8 p-4">
      <Card className="border-2 border-gray-100 shadow-sm">
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xl font-semibold">추천 사이즈: 
                  <Badge className="ml-2 text-lg">{selectedSize || "M"}</Badge>
                </h3>
                <p className="text-gray-500 mt-1">
                  {recommendation?.성별 || userGender}, 
                  키 {recommendation?.키 || userHeight}cm
                  {recommendation?.카테고리 ? `, ${recommendation.카테고리}` : ''}
                </p>
                <p className="text-sm mt-2 text-blue-600">아래 사이즈 정보를 수정하여 맞춤 주문이 가능합니다.</p>
              </div>
              <div>
                {recommendation && recommendation.핏 && (
                  <Badge variant="outline" className="text-sm">{recommendation.핏} 핏</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              {/* 사이즈 표 정보 - 수정 가능하게 변경 */}
              <div className="bg-gray-50 rounded-lg p-4 flex-1">
                <h3 className="text-lg font-semibold mb-4">사이즈 세부 정보</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>측정 부위</TableHead>
                      <TableHead className="text-right">크기</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sizeTableData.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell className="font-medium">{translateKey(item.key)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                            <div className="relative flex items-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-r-none border-r-0"
                                onClick={() => adjustSizeValue(item.key, item.value, -1)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12h14"/>
                                </svg>
                                <span className="sr-only">감소</span>
                              </Button>
                              <Input
                                type="text"
                                value={extractNumericValue(item.value)}
                                onChange={(e) => handleSizeValueChange(item.key, e.target.value)}
                                className="w-14 h-8 text-right rounded-none"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-l-none border-l-0"
                                onClick={() => adjustSizeValue(item.key, item.value, 1)}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 5v14M5 12h14"/>
                                </svg>
                                <span className="sr-only">증가</span>
                              </Button>
                              <span className="ml-1 text-gray-500">cm</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 옷 이미지 표시 */}
              {clothingImages[selectedType] && (
                <div className="bg-white rounded-lg p-4 flex items-center justify-center md:w-1/3">
                  <div className="relative w-full">
                    <img 
                      src={clothingImages[selectedType]} 
                      alt={`${selectedType} 사이즈 가이드`}
                      className="w-full max-w-[280px] h-auto object-contain mx-auto"
                      onError={(e) => {
                        console.error("이미지 로드 오류:", e);
                        console.log("오류가 발생한 이미지 경로:", clothingImages[selectedType]);
                        (e.target as HTMLImageElement).src = "/lovable-uploads/40adfb8c-d6e9-4e33-899e-0e9db51c50f1.png";
                      }}
                    />
                    <p className="text-center text-xs text-gray-500 mt-2">사이즈 가이드</p>
                  </div>
                </div>
              )}
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
