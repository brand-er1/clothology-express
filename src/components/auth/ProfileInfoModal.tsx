
import React, { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface ProfileInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export const ProfileInfoModal = ({ isOpen, onClose, userId }: ProfileInfoModalProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    height: "",
    weight: "",
    gender: "남성",
  });

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
      // 수치 데이터 유효성 검증
      const height = parseFloat(formData.height);
      const weight = parseFloat(formData.weight);
      
      if (isNaN(height) || isNaN(weight)) {
        throw new Error("키와 몸무게는 유효한 숫자여야 합니다.");
      }

      // 프로필 업데이트
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_number: formData.phoneNumber || null,
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
      
      onClose();
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>필수 정보 입력</DialogTitle>
          <DialogDescription>
            맞춤 서비스를 위해 필요한 신체 정보를 입력해주세요.
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
              placeholder="전화번호를 입력해주세요"
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
            <Label htmlFor="height">키 (cm) *</Label>
            <Input
              id="height"
              name="height"
              type="number"
              value={formData.height}
              onChange={handleChange}
              required
              placeholder="키를 입력해주세요"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="weight">몸무게 (kg) *</Label>
            <Input
              id="weight"
              name="weight"
              type="number"
              value={formData.weight}
              onChange={handleChange}
              required
              placeholder="몸무게를 입력해주세요"
            />
          </div>
          
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "저장 중..." : "저장하고 계속하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
