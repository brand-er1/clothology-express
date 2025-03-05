
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

export const WelcomeNotification = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    const checkProfileCompletion = async () => {
      try {
        // 현재 로그인한 사용자 확인
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData.session) {
          return;
        }
        
        // 사용자의 프로필 정보 가져오기
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('height, weight, phone_number, created_at, updated_at')
          .eq('id', sessionData.session.user.id)
          .single();
        
        if (error) {
          console.error("프로필 조회 오류:", error);
          return;
        }
        
        // 프로필이 없거나 키, 몸무게, 전화번호 중 하나라도 비어있으면 알림 표시
        const isProfileIncomplete = !profile || 
          !profile.height || 
          !profile.weight || 
          !profile.phone_number;
        
        // 프로필이 방금 생성되었는지 확인 (소셜 로그인으로 첫 로그인)
        // created_at과 updated_at이 비슷하면 방금 생성된 계정
        const isNewProfile = profile && 
          profile.created_at && 
          profile.updated_at &&
          new Date(profile.created_at).getTime() - new Date(profile.updated_at).getTime() < 60000; // 1분 이내
        
        // 새 계정이고 프로필이 불완전하면 대화상자 표시
        if (isNewProfile && isProfileIncomplete) {
          setIsOpen(true);
        } 
        // 새 계정이 아니지만 프로필이 불완전하면 토스트 알림 표시
        else if (isProfileIncomplete) {
          setShowNotification(true);
        }
        
      } catch (error) {
        console.error("프로필 확인 오류:", error);
      }
    };
    
    checkProfileCompletion();
  }, []);
  
  const handleClose = () => {
    setShowNotification(false);
  };
  
  if (!showNotification) {
    return null;
  }
  
  return (
    <>
      {/* 상단 알림 배너 */}
      <div className="fixed top-16 inset-x-0 z-50 p-4">
        <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg shadow-lg p-4 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-gray-800">원활한 서비스 이용을 위해 프로필 정보를 완성해주세요.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/profile">
              <Button variant="default">
                마이페이지로 이동
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* 새 사용자를 위한 대화상자 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>프로필 정보 완성하기</DialogTitle>
            <DialogDescription>
              맞춤형 의류 제작을 위해 필요한 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-4">원활한 서비스 이용을 위해 다음 정보가 필요합니다:</p>
            <ul className="list-disc pl-5 mb-4 space-y-1">
              <li>키 (cm)</li>
              <li>몸무게 (kg)</li>
              <li>전화번호</li>
            </ul>
            <p>이 정보는 맞춤형 의류 제작 및 배송에 사용됩니다.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              나중에 하기
            </Button>
            <Link to="/profile">
              <Button>마이페이지로 이동</Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
