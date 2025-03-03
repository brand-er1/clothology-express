
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface SizeStepProps {
  selectedType: string;
  selectedMaterial: string;
  selectedDetail: string;
  generatedPrompt?: string;
  gender?: string;
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
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [requestAttempted, setRequestAttempted] = useState(false);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("사이즈 추천을 위해 로그인이 필요합니다.");
          setIsLoading(false);
          return;
        }
        
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("height, gender")
          .eq("id", user.id)
          .maybeSingle();
          
        if (profileError) {
          console.error("Profile error:", profileError);
          setError("프로필 정보를 불러오는데 실패했습니다.");
          setIsLoading(false);
          return;
        }
        
        if (!profile || !profile.height) {
          setError("사이즈 추천을 위한 키 정보가 없습니다.");
          setIsLoading(false);
          return;
        }
        
        setUserHeight(profile.height);
        setUserGender(profile.gender || "남성");
        
        // If we have height and type, request size recommendation
        if (profile.height && selectedType) {
          await requestSizeRecommendation(
            profile.height,
            profile.gender || "남성",
            selectedType,
            selectedMaterial,
            selectedDetail,
            generatedPrompt
          );
        } else {
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading profile:", err);
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
      setErrorDetails(null);
      setRequestAttempted(true);
      
      const payload = {
        gender,
        height,
        type,
        material,
        detail,
        prompt,
      };
      
      console.log("Sending size recommendation request with payload:", payload);
      
      // Use the supabase client's functions.invoke method
      const { data, error } = await supabase.functions.invoke("size-recommendation", {
        body: payload
      });
      
      if (error) {
        console.error("Edge function error:", error);
        setError("사이즈 추천 요청이 실패했습니다.");
        setErrorDetails(`오류 상세: ${error.message || "알 수 없는 오류"}`);
        toast({
          title: "사이즈 추천 오류",
          description: error.message || "사이즈 추천 요청 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      console.log("Size recommendation response:", data);
      
      if (!data || !data.사이즈) {
        const errorMsg = "서버에서 올바른 형식의 응답을 받지 못했습니다.";
        setError(errorMsg);
        setErrorDetails("응답에 필요한 사이즈 정보가 포함되어 있지 않습니다.");
        throw new Error(errorMsg);
      }
      
      setRecommendation(data as SizeRecommendation);
      if (onSizeChange && data.사이즈) {
        onSizeChange(data.사이즈);
      }
    } catch (err: any) {
      console.error("Size recommendation error:", err);
      if (!error) { // Only set if not already set by the Supabase error handler
        setError(err.message || "사이즈 추천 요청 중 오류가 발생했습니다.");
        toast({
          title: "사이즈 추천 오류",
          description: err.message || "사이즈 추천 요청 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
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

  // Handle retry
  const handleRetry = () => {
    if (!userHeight) {
      setError("사이즈 추천을 위한 키 정보가 없습니다.");
      return;
    }
    
    requestSizeRecommendation(
      userHeight,
      userGender,
      selectedType,
      selectedMaterial,
      selectedDetail,
      generatedPrompt
    );
  };

  // If loading, show loading indicator
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-4"></div>
        <p className="text-gray-600">사이즈 정보를 불러오는 중...</p>
      </div>
    );
  }

  // If there's an error, show error message with retry button
  if (error) {
    return (
      <div className="py-8 px-4 space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>사이즈 추천 오류</AlertTitle>
          <AlertDescription>
            {error}
            {errorDetails && (
              <div className="mt-2 text-xs font-mono bg-red-50 p-2 rounded">
                {errorDetails}
              </div>
            )}
          </AlertDescription>
        </Alert>
        
        <Button
          onClick={handleRetry}
          className="w-full"
          variant="outline"
        >
          다시 시도
        </Button>
        
        {/* Fallback to manual size selection */}
        <div className="mt-8">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">수동 사이즈 선택</h3>
              <p className="text-gray-600 mb-4">사이즈 추천에 실패했습니다. 수동으로 사이즈를 선택해주세요.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                  <Button
                    key={size}
                    variant={selectedSize === size ? "default" : "outline"}
                    onClick={() => handleSizeSelect(size)}
                    className="w-full"
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If no recommendation data, show message and retry button
  if (!recommendation) {
    return (
      <div className="text-center py-8 space-y-6">
        <p>사이즈 추천 데이터가 없습니다. 다시 시도해주세요.</p>
        <Button
          onClick={handleRetry}
          className="mt-4"
        >
          다시 시도
        </Button>
        
        {/* Fallback to manual size selection */}
        <div className="mt-8">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">수동 사이즈 선택</h3>
              <p className="text-gray-600 mb-4">원하시는 사이즈를 선택해주세요.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                  <Button
                    key={size}
                    variant={selectedSize === size ? "default" : "outline"}
                    onClick={() => handleSizeSelect(size)}
                    className="w-full"
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If we have a recommendation, show it
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
