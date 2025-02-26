
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";

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
  const [userHeight, setUserHeight] = useState<number | null>(null);
  const [userGender, setUserGender] = useState<string>("남성");
  const [isLoading, setIsLoading] = useState(true);

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
          console.log("프로필 로드됨:", profile);
        }
      } catch (error) {
        console.error("프로필 로드 중 오류 발생:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  if (isLoading) {
    return <div className="text-center py-8">사용자 정보를 불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-1">성별</h3>
                <p className="text-lg">{userGender}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">키</h3>
                <p className="text-lg">{userHeight ? `${userHeight}cm` : "정보 없음"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SizeStep;
