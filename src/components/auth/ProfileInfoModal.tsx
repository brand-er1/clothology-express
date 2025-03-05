
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

interface ProfileInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileData?: any;
}

export const ProfileInfoModal = ({ open, onOpenChange, profileData }: ProfileInfoModalProps) => {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    height: "",
    weight: "",
    gender: "남성",
  });

  useEffect(() => {
    if (profileData) {
      setFormData({
        phoneNumber: profileData.phone_number || "",
        height: profileData.height?.toString() || "",
        weight: profileData.weight?.toString() || "",
        gender: profileData.gender || "남성",
      });
    }
  }, [profileData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      gender: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!userId) {
        throw new Error("인증 정보가 없습니다. 다시 로그인해주세요.");
      }

      // Validate data
      if (!formData.phoneNumber) {
        throw new Error("전화번호를 입력해주세요.");
      }

      const height = parseFloat(formData.height);
      const weight = parseFloat(formData.weight);
      
      if (isNaN(height) || isNaN(weight)) {
        throw new Error("키와 몸무게는 유효한 숫자여야 합니다.");
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_number: formData.phoneNumber,
          height: height,
          weight: weight,
          gender: formData.gender,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "프로필 정보 저장 완료",
        description: "필요한 모든 정보가 저장되었습니다.",
      });
      
      onOpenChange(false);
      navigate("/profile");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "오류 발생",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>프로필 정보 추가</DialogTitle>
          <DialogDescription>
            원활한 서비스 이용을 위해 아래 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">전화번호</Label>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="gender">성별</Label>
            <Select value={formData.gender} onValueChange={handleGenderChange}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="성별을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="남성">남성</SelectItem>
                <SelectItem value="여성">여성</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="height">키 (cm)</Label>
            <Input
              id="height"
              name="height"
              type="number"
              value={formData.height}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="weight">몸무게 (kg)</Label>
            <Input
              id="weight"
              name="weight"
              type="number"
              value={formData.weight}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              나중에 하기
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "저장 중..." : "정보 저장하기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
