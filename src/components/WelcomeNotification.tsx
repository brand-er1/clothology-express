
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

export const WelcomeNotification = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);
  
  useEffect(() => {
    // 로컬 스토리지에서 "마지막으로 알림 숨김" 설정 확인
    const lastHidden = localStorage.getItem('profileNotificationHidden');
    const shouldShowNotification = !lastHidden || 
      (new Date().getTime() - new Date(lastHidden).getTime() > 24 * 60 * 60 * 1000);
    
    if (!shouldShowNotification) {
      console.log("24시간 이내에 알림이 숨겨졌습니다");
      return;
    }
    
    const checkProfileCompletion = async () => {
      try {
        // 현재 로그인한 사용자 확인
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData.session) {
          console.log("로그인된 사용자 없음");
          return;
        }
        
        console.log("로그인된 사용자 확인: ", sessionData.session.user.id);
        
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
        
        console.log("프로필 정보:", profile);
        
        // 전화번호, 키, 몸무게 중 하나라도 비어있는지 확인
        const isMissingInfo = !profile || 
          !profile.phone_number || 
          profile.height === null || 
          profile.weight === null;
        
        console.log("정보 누락 여부:", isMissingInfo);
        
        // 정보가 누락되었으면 대화상자 표시
        if (isMissingInfo) {
          console.log("프로필 정보 누락: 대화상자 표시");
          setIsOpen(true);
        }
        
      } catch (error) {
        console.error("프로필 확인 오류:", error);
      }
    };
    
    // 페이지 로드 시 바로 체크
    checkProfileCompletion();
    
    // 인증 상태 변경 시에도 체크
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("인증 상태 변경:", event);
      if (event === 'SIGNED_IN') {
        checkProfileCompletion();
      } else if (event === 'SIGNED_OUT') {
        setIsOpen(false);
      }
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleHideToday = () => {
    if (dontShowToday) {
      // 현재 시간을 저장
      localStorage.setItem('profileNotificationHidden', new Date().toISOString());
    }
    setIsOpen(false);
  };
  
  if (!isOpen) {
    return null;
  }
  
  return (
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
            <li>전화번호</li>
            <li>키 (cm)</li>
            <li>몸무게 (kg)</li>
          </ul>
          <p>이 정보는 맞춤형 의류 제작 및 배송에 사용됩니다.</p>
          
          <div className="flex items-center space-x-2 mt-4">
            <Checkbox 
              id="dontShowToday" 
              checked={dontShowToday} 
              onCheckedChange={(checked) => setDontShowToday(checked as boolean)}
            />
            <label
              htmlFor="dontShowToday"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              오늘 하루 표시하지 않기
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleHideToday}>
            나중에 하기
          </Button>
          <Link to="/profile">
            <Button>마이페이지로 이동</Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};
